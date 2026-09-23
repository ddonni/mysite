import { PAGE_BG, drawStroke } from '../../shared/strokes.js';

// 캔버스 레이아웃(화면 크기에 맞춰 종이 크기 잡기)과 전체 다시 그리기만
// 담당 — 어떤 획들을 그릴지는 모르고 getStrokes()를 불러서 그때그때
// 물어봄(스트로크 저장/병합은 strokeBuffer.js 몫). 손가락으로 긋는 중
// 실시간 미리보기는 canvas.js가 ctx에 직접 그림(여긴 "다시 그리기"만).
export function createRenderer({ canvasEl, pageWrap, ctx, dpr, getStrokes }) {
  let dispW = 0, dispH = 0; // 캔버스의 "CSS 픽셀" 기준 크기 (실제 canvas.width/height는 dpr배 더 큼 — 고해상도 화면 대응)

  function renderAll() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAGE_BG;
    ctx.fillRect(0, 0, dispW, dispH);
    getStrokes().forEach((st) => drawStroke(ctx, st, dispW, dispH));
  }

  // 화면 크기에 맞춰 캔버스 크기를 다시 잡음. 가로가 긴 스케치북
  // 비율(A4를 눕힌 가로:세로)을 유지하면서 화면에 꽉 차게 — 종이
  // 한 장이 화면 안에 딱 들어오는 느낌을 주려는 것.
  function layout() {
    const PAGE_W = 1414, PAGE_H = 1000;
    const padX = 30;
    // 위아래 여백을 좌우보다 넉넉히 둬서, 페이지가 화면을 꽉 채워도
    // 좌상단의 .site-nav(페이지 이동 네비바)를 가리지 않게 함.
    const padY = 70;
    const availW = window.innerWidth - padX * 2;
    const availH = window.innerHeight - padY * 2;
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

  return {
    layout,
    renderAll,
    // canvas.js가 포인터 좌표를 0~1로 정규화할 때 씀 — 매번 함수를
    // 부르지 않고 속성처럼 읽게 getter로 노출(호출 비용 없이 항상 최신값).
    get width() { return dispW; },
    get height() { return dispH; },
  };
}
