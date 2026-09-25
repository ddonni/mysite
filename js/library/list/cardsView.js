import { escapeHtml } from '../../shared/dom.js';
import { catLabel, coverHtml, ratingText } from './itemFormat.js';

// 기록 하나 = 표지 카드 하나. 누르면 onOpen(it)으로 알려서 상세 창을 열지는
// 호출하는 쪽(list.js)이 정함.
function renderCard(it, { onOpen, showCat, playingId }) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.dataset.cat = it.cat;
  const rating = ratingText(it.rating);
  // "전체" 탭에선 무슨 기록인지 알 수 있게 카테고리 색 점 + 이름을 붙임.
  const sub = [showCat ? `<i class="dot"></i>${catLabel(it.cat)}` : '', it.creator ? escapeHtml(it.creator) : '']
    .filter(Boolean).join(' · ');
  card.innerHTML = `
    ${coverHtml(it, { playing: it.id === playingId })}
    <span class="card-title">${escapeHtml(it.title)}</span>
    ${sub ? `<span class="card-sub">${sub}</span>` : ''}
    ${rating ? `<span class="card-rating">${rating}</span>` : ''}
  `;
  card.addEventListener('click', () => onOpen(it));
  return card;
}

// 카드 여러 장을 containerEl에 채움. 비어 있으면 emptyText 한 줄만.
// playingId: 방의 턴테이블에서 도는 곡의 id — 그 카드에 "재생 중" 표시.
export function renderCards(containerEl, list, { onOpen, showCat, emptyText, playingId }) {
  containerEl.innerHTML = '';
  if (list.length === 0 && emptyText) {
    containerEl.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }
  list.forEach((it) => containerEl.appendChild(renderCard(it, { onOpen, showCat, playingId })));
}
