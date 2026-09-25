import { defaultAlbumDataUrl } from '../../shared/album.js';

export function ratingText(r) {
  r = r || 0;
  return '★' + r.toFixed(1);
}

// 음악은 대표작 자리가 없고(턴테이블은 항상 최신곡) "대표작" 토글도 없음.
export function featureButtonLabel(cat, featured) {
  if (cat === 'music') return null;
  return featured ? '대표작 해제' : '대표작으로';
}

// 음악은 항상 앨범 이미지 자리를 보여줌 — 없으면 기본 이미지로 채움
// (책/애니/영화는 사진이 없으면 원래부터 썸네일 자체를 안 보여줌).
export function thumbSrcOf(it) {
  return it.photo_url || (it.cat === 'music' ? defaultAlbumDataUrl() : null);
}
