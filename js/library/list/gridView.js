import { escapeHtml } from '../../shared/dom.js';
import { thumbSrcOf } from './itemFormat.js';

// '이미지만 보기' — 애초에 보여줄 사진이 없는 기록(사진 안 올린
// 책/애니/영화)은 이 화면에서는 그냥 뺌(목록 보기로 가면 그대로 있음).
// 카드를 누르면 onOpenItem(it)으로 알려서 lightbox를 열지 말지는
// 호출하는 쪽(list.js)이 정함.
export function renderGrid(listEl, list, { onOpenItem }) {
  listEl.innerHTML = '';
  const withPhoto = list
    .map((it) => ({ it, thumb: thumbSrcOf(it) }))
    .filter((x) => x.thumb);
  if (withPhoto.length === 0) {
    listEl.innerHTML = '<div class="empty">사진이 있는 기록이 없어요. 목록 보기로 바꾸면 전체가 보여요.</div>';
    return;
  }
  withPhoto.forEach(({ it, thumb }) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'thumb-card';
    card.innerHTML = `
      <img src="${thumb}" alt="">
      <span class="thumb-title">${it.featured ? '⭐ ' : ''}${escapeHtml(it.title)}</span>
    `;
    card.addEventListener('click', () => onOpenItem(it));
    listEl.appendChild(card);
  });
}
