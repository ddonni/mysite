import { defaultAlbumDataUrl } from '../../shared/album.js';

export function ratingText(r) {
  r = r || 0;
  return '★' + r.toFixed(1);
}

// 모든 카테고리에 "대표작" 토글이 있음 — 책/애니/영화는 로비 가구 위에
// 대표작 3개가 걸리고, 음악은 첫 번째 대표곡이 턴테이블에서 돌아감.
export function featureButtonLabel(cat, featured) {
  return featured ? '대표작에서 빼기' : '대표작으로';
}

// 음악은 항상 앨범 이미지 자리를 보여줌 — 없으면 기본 이미지로 채움
// (책/애니/영화는 사진이 없으면 원래부터 썸네일 자체를 안 보여줌).
export function thumbSrcOf(it) {
  return it.photo_url || (it.cat === 'music' ? defaultAlbumDataUrl() : null);
}
