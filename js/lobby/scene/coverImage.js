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
// crossOrigin='anonymous'로 요청하므로 S3 버킷에 CORS 설정이 없으면 이미지
// 로드 자체가 실패(onerror)해서 캔버스가 "오염"될 일이 없음 — 예전처럼
// getImageData로 오염 여부를 확인하면 캔버스마다 GPU→CPU 동기 읽기가 일어나
// 로딩 중 버벅임의 원인이 됐음.
// img.decode()로 디코딩을 메인 스레드 밖에서 끝내 두고 그려서, drawImage가
// 그 자리에서 큰 사진을 디코딩하느라 프레임이 멈추지 않게 함.
//
// 같은 캔버스를 연달아 다시 칠할 수 있음(로비가 캐시로 먼저 칠하고 서버 데이터로
// 한 번 더 칠함) — 사진 디코딩은 비동기라, 먼저 요청한 사진이 나중에 끝나면 새
// 그림을 옛 사진으로 덮어써버림. 캔버스마다 "마지막 요청"만 기억해서, 그보다
// 늦게 끝난 옛 요청은 그리지 않고 버림.
const latestPaint = new WeakMap();

// 사진 없이 바로 그리는 경로(빈 자리 그림 등)도 이걸 불러서, 아직 디코딩 중인
// 옛 사진이 나중에 그 위를 덮지 않게 함.
export function claimCanvas(ctx) {
  const token = {};
  latestPaint.set(ctx, token);
  return token;
}

export function paintRecordImage(ctx, record, { drawImage, drawFallback, onDone }) {
  const token = claimCanvas(ctx);
  const url = record && record.photo_url;
  if (!url) { drawFallback(); onDone(); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  const stillLatest = () => latestPaint.get(ctx) === token;
  img.decode()
    .then(() => { if (stillLatest()) drawImage(img); })
    .catch(() => { if (stillLatest()) drawFallback(); })
    .then(() => { if (stillLatest()) onDone(); });
}
