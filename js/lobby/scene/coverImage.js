// 기록(책/애니/영화)의 사진을 캔버스 텍스처에 그리는 공용 로직 — 벽 액자,
// 영화 포스터, 애니 아크릴 스탠드가 전부 "사진이 있으면 꽉 채워 그리고,
// 없거나 못 불러오면 제목 카드로 대신"이라는 같은 규칙을 씀.

// img를 (x, y, w, h) 칸에 비율 유지한 채 꽉 채워(object-fit: cover) 그림.
export function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// 사진이 없는 기록을 위한 제목 카드 — 어두운 바탕에 제목을 몇 줄로 나눠
// 가운데 정렬. 제목이 너무 길면 3줄에서 자르고 말줄임표를 붙임.
export function drawTitleCard(ctx, x, y, w, h, title, accent) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#3a2c1f');
  g.addColorStop(1, '#1d1916');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = accent || 'rgba(199,154,75,0.9)';
  ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.6, Math.max(2, h * 0.008));

  const fontPx = Math.floor(w * 0.11);
  ctx.font = `600 ${fontPx}px Manrope, 'Apple SD Gothic Neo', sans-serif`;
  ctx.fillStyle = 'rgba(243,236,224,0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxW = w * 0.8;
  const lines = [];
  let line = '';
  for (const ch of title || '') {
    if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else { line += ch; }
  }
  if (line) lines.push(line);
  if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].slice(0, -1) + '…'; }
  const lineH = fontPx * 1.3;
  const top = y + h * 0.56 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, top + i * lineH));
}

// record의 사진을 불러와 drawImage(img)로 그리고, 사진이 없거나 로드/CORS에
// 실패하면 drawFallback()으로 대신 그림. 어느 쪽이든 다 그린 뒤 onDone()을
// 불러서 호출한 쪽이 texture.needsUpdate를 켜게 함.
//
// S3 버킷에 CORS 설정이 없는 이미지면 캔버스가 "오염"돼서 그 텍스처를
// GPU에 올리는 순간 에러가 남 — getImageData로 미리 오염 여부를 확인해서,
// 문제가 있으면 대체 그림으로 바꿈.
export function paintRecordImage(ctx, record, { drawImage, drawFallback, onDone }) {
  const url = record && record.photo_url;
  if (!url) { drawFallback(); onDone(); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      drawImage(img);
      ctx.getImageData(0, 0, 1, 1);
    } catch (e) {
      drawFallback();
    }
    onDone();
  };
  img.onerror = () => { drawFallback(); onDone(); };
  img.src = url;
}
