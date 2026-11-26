import { CATS } from '../records.js';
import { escapeHtml, escapeAttr } from '../../shared/dom.js';
import { photoSrc } from '../../shared/photoSrc.js';
import { noteTitle, youtubeThumb } from '../noteText.js';

export function catLabel(key) {
  const cat = CATS.find((c) => c.key === key);
  return cat ? cat.label : '';
}

// 카드·목록에 보이는 이름 — ?!는 제목 칸이 없어서 글의 첫 줄(noteText.noteTitle).
export function displayTitle(it) {
  return it.cat === 'note' ? noteTitle(it) : (it.title || '');
}

// 카드 아래 한 줄짜리 별점 — 별점을 안 매긴(0) 기록은 아무것도 안 보임.
export function ratingText(r) {
  return r ? '★ ' + r.toFixed(1) : '';
}

// 상세 창의 별 다섯 개 — 0.5 단위라 반쪽 별은 앞 별 위에 폭 50%로 겹쳐 그림
// (추가 창의 별점 위젯 modal/starPicker.js와 같은 방식).
const STAR_PATH = 'M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 19.771l-7.416 3.642 1.48-8.279L0 9.306l8.332-1.151z';
export function ratingStars(r) {
  const v = r || 0;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const pct = v >= i ? 100 : v >= i - 0.5 ? 50 : 0;
    html += `<span class="star"><svg class="bg" viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg>` +
      `<span class="fg" style="width:${pct}%"><svg viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg></span></span>`;
  }
  return `<span class="stars-view" aria-label="별점 ${v}점">${html}</span>`;
}

// 카테고리마다 인생작(코드에선 featured)을 부르는 이름 — 카테고리마다 3개까지 고를 수
// 있고, 고른 건 첫 화면 맨 앞에 황금 카드로 나옴(list/cardsView.js).
const FEATURE_LABEL = { book: '인생책', anime: '인생애니', movie: '인생영화', music: '최애음악' };
export function featureLabel(cat) {
  return FEATURE_LABEL[cat] || '인생작';
}

// 한글 낱말 끝에 받침이 있는지 — 조사(으로/로, 은/는)를 고르는 데 씀.
// ㄹ 받침 뒤엔 "로"가 붙어서 따로 알려줌.
function finalConsonant(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return 0;
  return code % 28; // 0 = 받침 없음, 8 = ㄹ
}
export function withEuro(word) { // 인생책으로 / 인생애니로
  const f = finalConsonant(word);
  return word + (f === 0 || f === 8 ? '로' : '으로');
}
export function withEunNeun(word) { // 인생책은 / 인생애니는
  return word + (finalConsonant(word) ? '은' : '는');
}
export function withEulReul(word) { // 인생책을 / 인생애니를
  return word + (finalConsonant(word) ? '을' : '를');
}

export function featureButtonLabel(cat, featured) {
  const label = featureLabel(cat);
  return featured ? `${label}에서 빼기` : withEuro(label);
}

// 기록의 표지. 사진이 있으면 그 사진 — 음악은 정사각형 앨범 아트라서
// 세로로 긴 카드에 잘리지 않게, 흐리게 늘인 같은 사진 위에 가운데 정사각형으로
// 올림. 사진이 없으면 제목 카드(카드 화면에선 cards.css가 회색 기본 그림으로 바꿈).
// 표지 오른쪽 위 카테고리 아이콘(네모 상자) — 드라마 OST처럼 표지만 봐선 무슨 기록인지 모를 때가
// 있어서(사용자 요청). 2026-11-17 아기자기하게 색을 넣음(사용자 요청): 책 = 산호색 표지 + 크림색 책장
// 단면 + 노란 책갈피, 영화·시리즈 = 노랑·흰 줄무늬 슬레이트, 음악 = 파란 음표, 애니 = 분홍 A.
// 상자 바탕색은 카테고리마다 연하게(css/cards.css의 .cat-icon[data-cat]).
const CAT_ICONS = {
  music: '<svg viewBox="0 0 24 24"><path d="M9 17.5V5.2l11-2.2v12.3" fill="none" stroke="#2B6FA3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M9 8.6l11-2.2" stroke="#2B6FA3" stroke-width="2" stroke-linecap="round"/>'
    + '<ellipse cx="6.2" cy="17.8" rx="3.2" ry="2.6" fill="#4AA3DF" stroke="#2B6FA3" stroke-width="1.4"/>'
    + '<ellipse cx="17.2" cy="15.6" rx="3.2" ry="2.6" fill="#4AA3DF" stroke="#2B6FA3" stroke-width="1.4"/>'
    + '<ellipse cx="5.2" cy="17" rx="1" ry=".6" fill="#FFFFFF" opacity=".8"/><ellipse cx="16.2" cy="14.8" rx="1" ry=".6" fill="#FFFFFF" opacity=".8"/></svg>',
  book: '<svg viewBox="0 0 24 24" stroke-linejoin="round">'
    + '<rect x="15.5" y="4.2" width="4.5" height="16" rx="1" fill="#FFF4DE" stroke="#7A4A36" stroke-width="1.3"/>'
    + '<path d="M16.6 7.5h2.4M16.6 10.5h2.4M16.6 13.5h2.4M16.6 16.5h2.4" stroke="#E8CFA8" stroke-width="1"/>'
    + '<rect x="4" y="3" width="13" height="18" rx="2" fill="#F28B6C" stroke="#7A4A36" stroke-width="1.3"/>'
    + '<rect x="4" y="3" width="3" height="18" rx="1.2" fill="#D9694F"/>'
    + '<rect x="9" y="7" width="6" height="3.2" rx=".8" fill="#FFF4DE"/>'
    + '<path d="M11.5 14.2l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z" fill="#FFD25A"/>'
    + '<path d="M13.5 3v6.5l1.3-1.1 1.3 1.1V3" fill="#FFD25A" stroke="#7A4A36" stroke-width="1"/></svg>',
  anime: '<svg viewBox="0 0 24 24"><text x="12" y="19" text-anchor="middle" font-size="19" font-weight="900" font-family="Arial Black, Arial, sans-serif" fill="#F06292" stroke="#B83B6A" stroke-width=".8">A</text></svg>',
  // ?! = 글자 그대로 "?!"(사용자 요청 — 애니의 A처럼 굵은 글자).
  note: '<svg viewBox="0 0 24 24"><text x="12" y="18.5" text-anchor="middle" font-size="17" font-weight="900" font-family="Arial Black, Arial, sans-serif" letter-spacing="-1" fill="#17181C">?!</text></svg>',
  movie: '<svg viewBox="0 0 24 24" stroke-linejoin="round">'
    + '<rect x="3" y="10" width="18" height="11" rx="2" fill="#3F4A5E" stroke="#232834" stroke-width="1.3"/>'
    + '<path d="M6 14h8M6 17h5" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>'
    + '<circle cx="17.3" cy="16.4" r="1.6" fill="#F2C14E"/>'
    + '<g transform="rotate(-14 3.5 9.5)"><rect x="3" y="5.6" width="18" height="4" rx="1" fill="#FFFFFF" stroke="#232834" stroke-width="1.3"/>'
    + '<path d="M6 5.6l-2.4 4M10.5 5.6l-2.4 4M15 5.6l-2.4 4M19.5 5.6l-2.4 4" stroke="#F2C14E" stroke-width="2.2"/></g>'
    + '<circle cx="4.2" cy="9.8" r="1" fill="#232834"/></svg>',
};
export function catIconHtml(cat) {
  const icon = CAT_ICONS[cat];
  return icon ? `<span class="cat-icon" data-cat="${cat}" role="img" aria-label="${catLabel(cat)}" title="${catLabel(cat)}">${icon}</span>` : '';
}

// 보는 중·읽는 중 표시 문구(음악은 없음).
export function progressLabel(cat) {
  return cat === 'book' ? '읽는 중' : '보는 중';
}

export function coverHtml(it) {
  // 왼쪽 위 표시 — 인생작(황금), 보는 중·읽는 중(초록). 오른쪽 위는 카테고리 아이콘.
  const tags = [
    it.featured ? `<span class="badge">${featureLabel(it.cat)}</span>` : '',
    it.in_progress && it.cat !== 'music' ? `<span class="badge progress">${progressLabel(it.cat)}</span>` : '',
  ].join('');
  const badge = (tags ? `<span class="badges">${tags}</span>` : '') + catIconHtml(it.cat);
  if (it.cat === 'note') return noteCoverHtml(it, badge);
  if (it.photo_url) {
    const src = escapeAttr(photoSrc(it.photo_url));
    // crossorigin: 예전 3D 방이 같은 사진을 CORS로 받아 WebGL 텍스처로 썼고, CORS 없이
    // 받은 응답이 1년(immutable) 캐시에 남아 그쪽이 실패한 적이 있음(2026-10-25). 지금은
    // 3D 방이 없지만, 나중에 WebGL·canvas로 사진을 다룰 일이 생겨도 같은 문제가 없게 그대로 둠.
    if (it.cat === 'music') {
      return `<div class="cover square"><img class="bg" src="${src}" alt="" aria-hidden="true" loading="lazy" crossorigin="anonymous"><img class="fg" src="${src}" alt="" loading="lazy" crossorigin="anonymous">${badge}</div>`;
    }
    return `<div class="cover"><img src="${src}" alt="" loading="lazy" crossorigin="anonymous">${badge}</div>`;
  }
  return `
    <div class="cover title-card">
      <span class="tc-cat">${catLabel(it.cat)}</span>
      <span class="tc-title">${escapeHtml(it.title)}</span>
      ${it.creator ? `<span class="tc-creator">${escapeHtml(it.creator)}</span>` : ''}
      ${badge}
    </div>`;
}

// ?! 표지 — 유튜브 영상이면 썸네일 + 가운데 ▶(누르면 작은 플레이어, cardsView의 data-act="listen"),
// 아니면 글 앞부분만(빈 줄은 접어서). 썸네일은 i.ytimg.com이 CORS를 안 줄 수 있어서 crossorigin 없이.
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
function noteCoverHtml(it, badge) {
  // 사진이 있으면 사진(영상 링크도 있으면 그 위에 ▶).
  if (it.photo_url) {
    return `
    <div class="cover note-photo-cover">
      <img src="${escapeAttr(photoSrc(it.photo_url))}" alt="" loading="lazy" crossorigin="anonymous">
      ${it.listen_url ? `<button type="button" class="note-play" data-act="listen" aria-label="영상 보기" title="영상 보기">${PLAY_ICON}</button>` : ''}
      ${badge}
    </div>`;
  }
  const thumb = youtubeThumb(it.listen_url);
  if (thumb) {
    return `
    <div class="cover note-video">
      <img src="${escapeAttr(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <button type="button" class="note-play" data-act="listen" aria-label="영상 보기" title="영상 보기">${PLAY_ICON}</button>
      ${badge}
    </div>`;
  }
  // 글만 — 투명한 바탕에 글씨만(아이콘·종이 없이, css/notes.css — 사용자 요청 "메모지 느낌 말고").
  const text = (it.memo || '').replace(/\n\s*\n+/g, '\n').slice(0, 220);
  return `
    <div class="cover note-paper">
      <span class="np-text">${escapeHtml(text)}</span>
      ${it.listen_url ? '<span class="np-link">▶ 유튜브 재생목록</span>' : ''}
    </div>`;
}
