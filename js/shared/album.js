// 노래에 앨범 이미지가 없을 때 대신 쓰는 기본 이미지. 실제 이미지 파일을
// 두는 대신, 다른 곳(로비 3D 장면 등)처럼 캔버스로 그려서 씀 — 에셋 없이
// 어디서든 (라이브러리 목록의 <img>든, 턴테이블의 텍스처든) 재사용 가능.

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

// 위 그림을 오프스크린 캔버스에 그려서, <img src>로 바로 쓸 수 있는
// data URL로 돌려줌 (라이브러리 목록/모달 미리보기용).
let cachedDataUrl = null;
export function defaultAlbumDataUrl() {
  if (cachedDataUrl) return cachedDataUrl;
  const c = document.createElement('canvas');
  c.width = 200; c.height = 200;
  drawDefaultAlbumArt(c.getContext('2d'), 200, 200);
  cachedDataUrl = c.toDataURL('image/png');
  return cachedDataUrl;
}
