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

// 음악 카드 위에 겹치는 "▶ 재생" 버튼 — 상세 창을 안 열고 바로 턴테이블에
// 올림. 카드 자체가 <button>이라 그 안에 버튼을 넣을 수 없어서, 카드와 버튼을
// 감싸개(.card-wrap)에 나란히 두고 버튼만 표지 위로 띄움.
function withPlayButton(card, it, onPlay) {
  const wrap = document.createElement('div');
  wrap.className = 'card-wrap';
  wrap.appendChild(card);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'play-btn';
  btn.textContent = '▶ 재생';
  btn.setAttribute('aria-label', `${it.title} 턴테이블에 올리기`);
  btn.addEventListener('click', () => onPlay(it));
  wrap.appendChild(btn);
  return wrap;
}

// 카드 여러 장을 containerEl에 채움. 비어 있으면 emptyText 한 줄만.
// playingId: 방의 턴테이블에서 도는 곡의 id — 그 카드에 "재생 중" 표시.
// onPlay: 주면 지금 안 돌고 있는 음악 카드마다 "▶ 재생" 버튼을 붙임(내 방의 최애음악 줄).
export function renderCards(containerEl, list, { onOpen, showCat, emptyText, playingId, onPlay }) {
  containerEl.innerHTML = '';
  if (list.length === 0 && emptyText) {
    containerEl.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }
  list.forEach((it) => {
    const card = renderCard(it, { onOpen, showCat, playingId });
    const playable = onPlay && it.cat === 'music' && it.id !== playingId;
    containerEl.appendChild(playable ? withPlayButton(card, it, onPlay) : card);
  });
}
