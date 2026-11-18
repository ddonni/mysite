// 스트로크 하나를 캔버스 2D 컨텍스트에 그리는 공용 로직.
// sketchbook 페이지 자체(js/sketchbook/canvas.js)와 로비의 이젤 미리보기
// 텍스처(js/lobby/scene.js)가 똑같은 그리기 규칙을 써야 해서 여기로 뺌.

export const PAGE_BG = '#fffdfa';

// st.points는 0~1 사이 정규화 좌표라서, 그릴 캔버스의 실제 픽셀
// 크기(w, h)를 받아서 그 안에서의 위치로 환산함.
export function drawStroke(ctx, st, w, h) {
  if (!st.points || !st.points.length) return;
  ctx.globalCompositeOperation = st.eraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle = st.color || 'rgba(0,0,0,1)';
  ctx.fillStyle = st.color || 'rgba(0,0,0,1)';
  ctx.lineWidth = st.width;
  if (st.points.length === 1) {
    // 점 하나만 찍고 뗀 경우(콕 찍기) — 선이 아니라 동그라미로 그림.
    const pt = st.points[0];
    ctx.beginPath();
    ctx.arc(pt[0] * w, pt[1] * h, st.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return;
  }
  ctx.beginPath();
  ctx.moveTo(st.points[0][0] * w, st.points[0][1] * h);
  for (let i = 1; i < st.points.length; i++) {
    ctx.lineTo(st.points[i][0] * w, st.points[i][1] * h);
  }
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}
