// 표지의 대표색 — 탑 안쪽·바닥에 고이는 빛 색(covers.js가 표지를 그리며 16px로 줄여 넘겨줌). 칙칙한 평균색
// 대신 선명한 색을 고르고 빛답게 밝기·채도를 끌어올림. 표지가 없거나 못 읽으면(CORS 실패 등) 카테고리 색.
// (처음엔 구슬 색이었음 — 2026-11-18 책·포스터로 바꾼 뒤엔 빛 색으로만 씀.)

// 표지가 없을 때의 카테고리 색 — 카드 홈 카테고리 아이콘 계열을 밝게(표지 없는 기록의 바탕색도).
export const CAT_GLOW = {
  book: [0.98, 0.72, 0.36],
  anime: [0.98, 0.52, 0.72],
  movie: [0.98, 0.42, 0.38],
  music: [0.38, 0.82, 0.88],
};
const DEFAULT_GLOW = [0.95, 0.85, 0.6];
export function catGlow(cat) { return CAT_GLOW[cat] || DEFAULT_GLOW; }

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
}

// pixels: RGBA 바이트 배열(getImageData().data). 돌려주는 값은 0~1 RGB(sRGB) — 이미 "빛" 색으로
// 다듬은 것. 그냥 평균을 내면 빨강·파랑이 섞인 포스터가 회색이 돼서(처음엔 거의 다 은색이었음), 색상(hue)을
// 12칸으로 나눠 "선명한 픽셀이 가장 많이 몰린 칸"의 색을 씀. 선명한 픽셀이 거의 없으면(흑백 표지) 은빛.
const BINS = 12;
export function vibrantColor(pixels) {
  const bins = Array.from({ length: BINS }, () => [0, 0, 0, 0]);
  let n = 0, ar = 0, ag = 0, ab = 0, vivid = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
    n++; ar += r; ag += g; ab += b;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.2 || max < 0.18) continue;
    let h;
    if (max === r) h = ((g - b) / (max - min) + 6) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    const w = sat * sat * max;
    const bin = bins[Math.floor((h / 6) * BINS) % BINS];
    bin[0] += r * w; bin[1] += g * w; bin[2] += b * w; bin[3] += w;
    vivid += w;
  }
  if (!n) return null;
  if (vivid / n < 0.012) return glowify([ar / n, ag / n, ab / n]);
  const top = bins.reduce((a, b) => (b[3] > a[3] ? b : a));
  return glowify([top[0] / top[3], top[1] / top[3], top[2] / top[3]]);
}

// 평균색을 빛 색으로 — 거의 무채색(흑백 표지)은 은빛, 아니면 채도를 올리고 밝기를 가운데로.
export function glowify([r, g, b]) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (s < 0.12) return hslToRgb(h, s * 0.5, 0.78);
  return hslToRgb(h, Math.min(1, Math.max(0.6, s * 1.25)), Math.min(0.68, Math.max(0.55, l)));
}
