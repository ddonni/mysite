import { defaultAlbumDataUrl } from '../../shared/album.js';

export function ratingText(r) {
  r = r || 0;
  return '★' + r.toFixed(1);
}

// 음악은 로비 액자 후보가 아니라 턴테이블 전용이라 "인생작품" 토글이
// 없음. 음식도 마찬가지로 액자가 아니라 냉장고 문에 걸리므로, 같은
// 토글을 "인생 음식"이라는 별도 문구로 씀.
export function featureButtonLabel(cat, featured) {
  if (cat === 'music') return null;
  const word = cat === 'food' ? '인생 음식' : '인생작품';
  return featured ? `${word} 해제` : `${word}으로`;
}

// 음악은 항상 앨범 이미지 자리를 보여줌 — 없으면 기본 이미지로 채움
// (책/애니/영화는 사진이 없으면 원래부터 썸네일 자체를 안 보여줌).
export function thumbSrcOf(it) {
  return it.photo_url || (it.cat === 'music' ? defaultAlbumDataUrl() : null);
}
