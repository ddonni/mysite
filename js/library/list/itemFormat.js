import { CATS } from '../records.js';
import { escapeHtml, escapeAttr } from '../../shared/dom.js';

export function catLabel(key) {
  const cat = CATS.find((c) => c.key === key);
  return cat ? cat.label : '';
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

// 카테고리마다 인생작(코드에선 featured)을 부르는 이름 — 책/애니/영화는 방의
// 가구 위에 3개까지 걸리고, 음악은 첫 번째 최애음악이 턴테이블에서 돌아감.
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
// 올림. 사진이 없으면 방의 제목 카드처럼 카테고리 색 표지에 제목을 씀.
export function coverHtml(it) {
  const badge = it.featured ? `<span class="badge">${featureLabel(it.cat)}</span>` : '';
  if (it.photo_url) {
    const src = escapeAttr(it.photo_url);
    if (it.cat === 'music') {
      return `<div class="cover square"><img class="bg" src="${src}" alt="" aria-hidden="true"><img class="fg" src="${src}" alt="" loading="lazy">${badge}</div>`;
    }
    return `<div class="cover"><img src="${src}" alt="" loading="lazy">${badge}</div>`;
  }
  return `
    <div class="cover title-card">
      <span class="tc-cat">${catLabel(it.cat)}</span>
      <span class="tc-title">${escapeHtml(it.title)}</span>
      ${it.creator ? `<span class="tc-creator">${escapeHtml(it.creator)}</span>` : ''}
      ${badge}
    </div>`;
}
