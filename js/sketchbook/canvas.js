// "지금 화면에 뭐가 그려져 있는가" 만 담당하는 모듈.
//
// 이 파일은 일부러 "몇 페이지째인지"는 전혀 모름 — 페이지 번호는
// pager.js만 알고 있음. 대신 이 파일은 딱 이런 일만 함:
//   - 캔버스 크기를 화면에 맞게 잡고 (layout)
//   - 손가락/펜/마우스 입력을 받아서 선을 그리고 (pointer 이벤트)
//   - "지금 그려진 내용이 바뀌었다" 를 밖으로 알려줌 (onChange 콜백)
//
// 그 "바뀐 내용을 어디에 저장할지"는 pager.js가 결정해서
// setOnChange()로 나중에 연결해줌. 이렇게 나누면 이 파일은 "페이지"라는
// 개념을 몰라도 되고, pager.js는 "그림을 어떻게 그리는지"를 몰라도 됨 —
// 서로의 세부사항에 얽매이지 않게(관심사 분리).

const PAGE_BG = '#fffdfa';
const MAX_STROKES = 300; // 한 페이지에 너무 많은 획이 쌓이면 오래된 것부터 버림
const MIN_POINT_DIST = 0.004; // 이 거리(0~1 정규화 좌표 기준)보다 가까운 점은 저장 안 함 — 데이터 용량 절약
const PALETTE = ['#2b2b2e', '#33456b', '#365c3f', '#9c3f34', '#c1712f'];
const SIZES = [2, 5, 10];

// 이 브라우저 탭을 구분하는 임의의 ID. "되돌리기(undo)"를 누르면 내가
// 그린 획만 지워야 하는데, 실시간 동기화 중인 다른 사람의 획까지 같이
// 지우면 안 되니까 — 획마다 이 ID를 author로 붙여서 "이건 내 획이다"를
// 구분함.
const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function createCanvas({ toast }) {
  const canvasEl = document.getElementById('canvas');
  const pageWrap = document.getElementById('pageWrap');
  const ctx = canvasEl.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  let dispW = 0, dispH = 0; // 캔버스의 "CSS 픽셀" 기준 크기 (실제 canvas.width/height는 dpr배 더 큼 — 고해상도 화면 대응)

  // 지금 이 페이지에 그려진 획들. 서버(혹은 로컬 저장소)에 이미 저장된
  // 것(serverStrokes)과, 아직 저장 중이라 서버가 모를 수도 있는 것
  // (pendingLocal)으로 나눠 관리함. 화면에는 둘을 합쳐서(mergedStrokes)
  // 그림.
  let serverStrokes = [];
  let pendingLocal = [];

  // loadPage()가 호출될 때마다 1씩 늘어나는 "세대" 번호. 예를 들어
  // "1페이지 저장 중"에 사용자가 후루룩 "2페이지로" 넘겨버리면, 뒤늦게
  // 도착한 1페이지 저장 완료 응답이 2페이지의 상태를 덮어쓰면 안 됨 —
  // save() 시점의 세대와 응답이 도착했을 때의 세대가 다르면 그 응답은
  // 무시함. (reconcileSaved에서 이 값을 비교함)
  let generation = 0;

  // 페이지가 바뀌었을 때 밖(pager.js)에 알리기 위한 콜백. 처음엔 아무
  // 일도 안 하는 빈 함수로 시작하고, main.js가 pager를 만든 뒤에
  // setOnChange로 진짜 함수를 연결해줌.
  let onChange = () => {};

  const tool = {
    color: '#2b2b2e',
    size: 4,
    erasing: false,
    drawing: false,
    curStroke: null,
    lastPt: null,
  };

  function mergedStrokes() {
    // 같은 id를 가진 획은 pendingLocal 쪽(더 최신)을 우선해서 하나만
    // 남기고, 처음 등장한 순서를 유지함 (그려진 순서가 곧 화면에
    // 그려지는 순서라서 순서가 중요함).
    const byId = {};
    const order = [];
    serverStrokes.forEach((s) => { if (!byId[s.id]) order.push(s.id); byId[s.id] = s; });
    pendingLocal.forEach((s) => { if (!byId[s.id]) order.push(s.id); byId[s.id] = s; });
    return order.map((id) => byId[id]);
  }

  function drawFullStroke(st) {
    if (!st.points || !st.points.length) return;
    ctx.globalCompositeOperation = st.eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = st.color || 'rgba(0,0,0,1)';
    ctx.fillStyle = st.color || 'rgba(0,0,0,1)';
    ctx.lineWidth = st.width;
    if (st.points.length === 1) {
      // 점 하나만 찍고 뗀 경우(콕 찍기) — 선이 아니라 동그라미로 그림.
      const pt = st.points[0];
      ctx.beginPath();
      ctx.arc(pt[0] * dispW, pt[1] * dispH, st.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    ctx.beginPath();
    ctx.moveTo(st.points[0][0] * dispW, st.points[0][1] * dispH);
    for (let i = 1; i < st.points.length; i++) {
      ctx.lineTo(st.points[i][0] * dispW, st.points[i][1] * dispH);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  function renderAll() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAGE_BG;
    ctx.fillRect(0, 0, dispW, dispH);
    mergedStrokes().forEach(drawFullStroke);
  }

  // 화면 크기에 맞춰 캔버스 크기를 다시 잡음. A4 비율(가로:세로)을
  // 유지하면서 화면에 꽉 차게 — 종이 한 장이 화면 안에 딱 들어오는
  // 느낌을 주려는 것.
  function layout() {
    const PAGE_W = 1000, PAGE_H = 1414;
    const padding = 30;
    const availW = window.innerWidth - padding * 2;
    const availH = window.innerHeight - padding * 2;
    const ratio = PAGE_W / PAGE_H;
    let w = availW, h = w / ratio;
    if (h > availH) { h = availH; w = h * ratio; }
    pageWrap.style.width = w + 'px';
    pageWrap.style.height = h + 'px';
    dispW = w; dispH = h;
    canvasEl.width = Math.round(w * dpr);
    canvasEl.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    renderAll();
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    // 창 크기가 바뀌는 동안 매 프레임마다 layout()을 다시 하면
    // 느려지니까, 크기 변경이 잠깐 멈춘 뒤(120ms) 한 번만 다시 계산함.
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });

  function pointerPos(e) {
    const rect = canvasEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function widthForPressure(p) {
    // 펜 태블릿처럼 필압(pressure)을 지원하는 입력이면 힘 준 만큼
    // 굵게. 필압이 없는 입력(마우스 등)은 그냥 기본 굵기.
    const base = tool.size;
    if (!p || p <= 0) return base;
    return Math.max(1, base * (0.5 + p * 1.1));
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    tool.drawing = true;
    canvasEl.setPointerCapture(e.pointerId);
    const pos = pointerPos(e);
    tool.lastPt = pos;
    tool.curStroke = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      color: tool.erasing ? null : tool.color,
      eraser: tool.erasing,
      width: tool.size,
      author: sessionId,
      // 좌표는 0~1 사이 "정규화된" 값으로 저장함 — 화면 크기가 달라도
      // (핸드폰이든 모니터든) 같은 위치에 그림이 그려지게 하기 위함.
      points: [[+(pos.x / dispW).toFixed(4), +(pos.y / dispH).toFixed(4)]],
    };
    ctx.globalCompositeOperation = tool.erasing ? 'destination-out' : 'source-over';
    ctx.fillStyle = tool.erasing ? 'rgba(0,0,0,1)' : tool.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, widthForPressure(e.pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function onPointerMove(e) {
    if (!tool.drawing || !tool.curStroke) return;
    const pos = pointerPos(e);
    ctx.globalCompositeOperation = tool.erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = tool.erasing ? 'rgba(0,0,0,1)' : tool.color;
    ctx.lineWidth = widthForPressure(e.pressure);
    ctx.beginPath();
    ctx.moveTo(tool.lastPt.x, tool.lastPt.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    tool.lastPt = pos;

    const fx = pos.x / dispW, fy = pos.y / dispH;
    const last = tool.curStroke.points[tool.curStroke.points.length - 1];
    const dx = fx - last[0], dy = fy - last[1];
    if (dx * dx + dy * dy >= MIN_POINT_DIST * MIN_POINT_DIST) {
      tool.curStroke.points.push([+fx.toFixed(4), +fy.toFixed(4)]);
    }
  }

  function onPointerUp() {
    if (!tool.drawing) return;
    tool.drawing = false;
    const st = tool.curStroke;
    tool.curStroke = null;
    if (!st) return;
    pendingLocal.push(st);
    save();
  }

  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  function save() {
    // 지금 이 순간의 "합쳐진 획 목록"을 저장하러 보냄. 저장이 오래
    // 걸리는 동안 사용자가 페이지를 넘겨버릴 수도 있으니, 지금
    // 세대(generation)를 기억해뒀다가 응답이 왔을 때 세대가 그대로인
        // 경우에만 결과를 반영함.
    const gen = generation;
    let combined = mergedStrokes();
    if (combined.length > MAX_STROKES) combined = combined.slice(combined.length - MAX_STROKES);
    const savedIds = combined.map((s) => s.id);

    onChange(combined, gen, savedIds);
  }

  return {
    // main.js가 pager를 만든 뒤에, "바뀐 내용을 실제로 저장하는 방법"을
    // 여기 연결해줌. (combined, gen, savedIds) => void 형태.
    setOnChange(fn) { onChange = fn; },

    layout,

    // pager.js가 "저장이 끝났다"고 알려주면, pendingLocal 중 이미 저장된
    // 것들을 걷어내고 serverStrokes를 갱신함. gen이 그 사이에 페이지
    // 전환으로 바뀌었으면 (더 이상 유효하지 않은 응답이므로) 무시함.
    reconcileSaved(gen, savedStrokes, savedIds) {
      if (gen !== generation) return;
      serverStrokes = savedStrokes;
      pendingLocal = pendingLocal.filter((s) => savedIds.indexOf(s.id) === -1);
    },

    saveFailed(err) {
      if (err && err.code === 'page not found') {
        toast('저장에 실패했어요 — 페이지를 새로고침해 보세요');
      }
      // 그 외의 네트워크 에러는 조용히 넘어감 — 다음 획을 그릴 때 다시
      // save()가 불리면서 지금 상태를 그대로 이어서 저장하기 때문에,
      // 잠깐 동기화가 늦어질 뿐 그림이 사라지진 않음.
    },

    // 다른 페이지로 이동하거나(strokes=서버에서 받아온 내용), 아직
    // 로딩 전이라 일단 화면을 비워둘 때(strokes=[]) 둘 다 이 함수로 처리.
    loadPage(strokes) {
      generation++;
      serverStrokes = strokes;
      pendingLocal = [];
      renderAll();
    },

    // 다른 사람(또는 다른 탭)이 같은 페이지에 실시간으로 그린 내용이
    // 도착했을 때. 지금 내가 한창 선을 긋는 중이면 화면을 다시 그리지
    // 않음 — 안 그러면 그리던 선이 뚝뚝 끊겨 보임.
    applyRemote(strokes) {
      if (tool.drawing) return;
      serverStrokes = strokes;
      renderAll();
    },

    clearPage() {
      serverStrokes = [];
      pendingLocal = [];
      renderAll();
      save();
    },

    undo() {
      // 내가 그린 획 중 가장 최근 것을 하나 지움. 아직 저장 안 된
      // pendingLocal 쪽을 먼저 보고, 없으면 이미 저장된 serverStrokes
      // 쪽에서 찾음.
      for (let i = pendingLocal.length - 1; i >= 0; i--) {
        if (pendingLocal[i].author === sessionId) {
          pendingLocal.splice(i, 1);
          renderAll();
          save();
          return;
        }
      }
      for (let j = serverStrokes.length - 1; j >= 0; j--) {
        if (serverStrokes[j].author === sessionId) {
          serverStrokes.splice(j, 1);
          renderAll();
          save();
          return;
        }
      }
      toast('되돌릴 내 획이 없어요');
    },

    toggleEraser() {
      tool.erasing = !tool.erasing;
      return tool.erasing;
    },
    setColor(hex) {
      tool.color = hex;
      tool.erasing = false;
    },
    setSize(px) { tool.size = px; },

    getDataUrl() {
      try { return canvasEl.toDataURL('image/png'); } catch (e) { return null; }
    },

    palette: PALETTE,
    sizes: SIZES,
    defaultColor: tool.color,
    defaultSize: tool.size,
  };
}
