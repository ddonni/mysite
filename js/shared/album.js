// 노래에 앨범 이미지가 없을 때 대신 쓰는 기본 이미지(로비의 턴테이블 LP
// 라벨·LP 슬리브용). 실제 이미지 파일을 두는 대신 캔버스로 그려서 씀.
// 기록 보관소는 사진이 없으면 카테고리 색 제목 카드를 따로 그림.

// ctx에 정사각형(w x h, 보통 w===h) 기본 앨범 아트를 그림: 어두운 배경
// 위에 동그란 음표 아이콘 하나.
export function drawDefaultAlbumArt(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#3a2c1f');
  g.addColorStop(1, '#201d1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,253,250,0.35)';
  ctx.lineWidth = Math.max(1, w * 0.01);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.32, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#c79a4b';
  const cx = w * 0.44, cy = h * 0.58, noteR = w * 0.07;
  ctx.beginPath();
  ctx.ellipse(cx, cy, noteR, noteR * 0.8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.22, cy - h * 0.06, noteR, noteR * 0.8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx + noteR * 0.85, cy - h * 0.34, w * 0.018, h * 0.34);
  ctx.fillRect(cx + w * 0.22 + noteR * 0.85, cy - h * 0.06 - h * 0.34, w * 0.018, h * 0.34);
  ctx.fillRect(cx + noteR * 0.85, cy - h * 0.34, w * 0.22 - noteR * 0.85, h * 0.05);
}
