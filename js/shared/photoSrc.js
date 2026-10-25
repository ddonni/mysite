// 기록 사진(photo_url)을 화면에 띄울 때 쓸 주소. 사진은 어디서든
// crossOrigin='anonymous'로 받는데(로비 WebGL 텍스처 + 같은 사진의 캐시를 맞추려고,
// list/itemFormat.js 설명), 책 검색으로 고른 카카오 표지는 그 서버가 CORS 헤더를
// 안 줘서 그대로는 못 불러옴 — 그 주소만 백엔드 GET /api/cover를 거치게 바꿈.
// 저장되는 photo_url은 카카오 원래 주소 그대로(바꾸는 건 보여줄 때만).
import { API_BASE } from './config.js';

// 백엔드 book_search.COVER_HOSTS와 같아야 함.
const RELAY_HOSTS = ['t1.daumcdn.net', 'search1.kakaocdn.net'];

export function photoSrc(url) {
  if (!url) return url;
  let host;
  try { host = new URL(url).hostname; } catch (e) { return url; }
  return RELAY_HOSTS.includes(host) ? `${API_BASE}/api/cover?url=${encodeURIComponent(url)}` : url;
}
