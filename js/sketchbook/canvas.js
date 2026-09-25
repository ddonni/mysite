// "지금 화면에 뭐가 그려져 있는가" 만 담당하는 모듈.
//
// 이 파일은 일부러 "몇 페이지째인지"는 전혀 모름 — 페이지 번호는
// pager.js만 알고 있음. 대신 이 파일은 딱 이런 일만 함:
//   - 손가락/펜/마우스 입력을 받아서 실시간으로 선을 그리고 (pointer 이벤트)
//   - "지금 그려진 내용이 바뀌었다" 를 밖으로 알려줌 (onChange 콜백)
// 획을 저장/병합하는 데이터 로직은 canvas/strokeBuffer.js가, 캔버스
// 크기 잡기/전체 다시 그리기는 canvas/renderer.js가 맡음 — 이 파일은
// 그 둘을 실제 포인터 입력과 연결하는 접착부 역할만 함.
//
// 그 "바뀐 내용을 어디에 저장할지"는 pager.js가 결정해서
// setOnChange()로 나중에 연결해줌. 이렇게 나누면 이 파일은 "페이지"라는
// 개념을 몰라도 되고, pager.js는 "그림을 어떻게 그리는지"를 몰라도 됨 —
// 서로의 세부사항에 얽매이지 않게(관심사 분리).

import { createStrokeBuffer } from './canvas/strokeBuffer.js';
import { createRenderer } from './canvas/renderer.js';

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

  const buffer = createStrokeBuffer();
  const renderer = createRenderer({ canvasEl, pageWrap, ctx, dpr, getStrokes: () => buffer.merged() });

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
      points: [[+(pos.x / renderer.width).toFixed(4), +(pos.y / renderer.height).toFixed(4)]],
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

    const fx = pos.x / renderer.width, fy = pos.y / renderer.height;
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
    buffer.addPending(st);
    save();
  }

  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  function save() {
    const { strokes, gen, ids } = buffer.snapshotForSave();
    onChange(strokes, gen, ids);
  }

  return {
    // main.js가 pager를 만든 뒤에, "바뀐 내용을 실제로 저장하는 방법"을
    // 여기 연결해줌. (combined, gen, savedIds) => void 형태.
    setOnChange(fn) { onChange = fn; },

    layout: renderer.layout,

    // pager.js가 "저장이 끝났다"고 알려주면 버퍼에 반영함.
    reconcileSaved(gen, savedStrokes, savedIds) {
      buffer.reconcile(gen, savedStrokes, savedIds);
    },

    saveFailed(err) {
      if (err && err.code === 'page not found') {
        toast('저장하지 못했어요. 새로고침해 보세요.');
      }
      // 그 외의 네트워크 에러는 조용히 넘어감 — 다음 획을 그릴 때 다시
      // save()가 불리면서 지금 상태를 그대로 이어서 저장하기 때문에,
      // 잠깐 동기화가 늦어질 뿐 그림이 사라지진 않음.
    },

    // 다른 페이지로 이동하거나(strokes=서버에서 받아온 내용), 아직
    // 로딩 전이라 일단 화면을 비워둘 때(strokes=[]) 둘 다 이 함수로 처리.
    loadPage(strokes) {
      buffer.loadPage(strokes);
      renderer.renderAll();
    },

    // 다른 사람(또는 다른 탭)이 같은 페이지에 실시간으로 그린 내용이
    // 도착했을 때. 지금 내가 한창 선을 긋는 중이면 화면을 다시 그리지
    // 않음 — 안 그러면 그리던 선이 뚝뚝 끊겨 보임.
    applyRemote(strokes) {
      if (tool.drawing) return;
      buffer.applyRemote(strokes);
      renderer.renderAll();
    },

    clearPage() {
      buffer.clear();
      renderer.renderAll();
      save();
    },

    undo() {
      if (buffer.removeLastByAuthor(sessionId)) {
        renderer.renderAll();
        save();
      } else {
        toast('되돌릴 획이 없어요');
      }
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

    palette: PALETTE,
    sizes: SIZES,
    defaultColor: tool.color,
    defaultSize: tool.size,
  };
}
