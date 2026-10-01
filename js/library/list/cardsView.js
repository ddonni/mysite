import { escapeHtml } from '../../shared/dom.js';
import { catLabel, coverHtml, ratingText } from './itemFormat.js';

// 기록 하나 = 표지 카드 하나. 누르면 onOpen(it)으로 알려서 상세 창을 열지는
// 호출하는 쪽(list.js)이 정함.
// showPlayingBadge: false면 표지 오른쪽 위 "재생 중" 배지를 빼고 그림 — 재생
// 상태를 왼쪽 위 재생 표시(withPlayToggle)가 대신 보여줄 때.
function renderCard(it, { onOpen, showCat, playingId, showPlayingBadge = true }) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.dataset.cat = it.cat;
  const rating = ratingText(it.rating);
  // "전체" 탭에선 무슨 기록인지 알 수 있게 카테고리 색 점 + 이름을 붙임.
  const sub = [showCat ? `<i class="dot"></i>${catLabel(it.cat)}` : '', it.creator ? escapeHtml(it.creator) : '']
    .filter(Boolean).join(' · ');
  card.innerHTML = `
    ${coverHtml(it, { playing: showPlayingBadge && it.id === playingId })}
    <span class="card-title">${escapeHtml(it.title)}</span>
    ${sub ? `<span class="card-sub">${sub}</span>` : ''}
    ${rating ? `<span class="card-rating">${rating}</span>` : ''}
  `;
  card.addEventListener('click', () => onOpen(it));
  return card;
}

// 음악 카드 표지 왼쪽 위의 재생 표시 — 한 자리에서 상태만 바뀜(누를 때마다
// 표시가 다른 위치로 옮겨 다니면 헷갈려서): 돌고 있는 곡은 꽉 찬 "▶ 재생 중"
// (누를 수 없음), 나머지는 테두리만 있는 "▶ 재생" 버튼(누르면 상세 창 없이 바로
// 턴테이블에 올림). 카드 자체가 <button>이라 그 안에 버튼을 넣을 수 없어서,
// 카드와 표시를 감싸개(.card-wrap)에 나란히 두고 표시만 표지 위로 띄움.
function withPlayToggle(card, it, { playing, onPlay }) {
  const wrap = document.createElement('div');
  wrap.className = 'card-wrap';
  wrap.appendChild(card);
  let toggle;
  if (playing) {
    toggle = document.createElement('span');
    toggle.className = 'play-btn on';
    toggle.textContent = '▶ 재생 중';
  } else {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'play-btn';
    toggle.textContent = '▶ 재생';
    toggle.setAttribute('aria-label', `${it.title} 턴테이블에 올리기`);
    toggle.addEventListener('click', () => onPlay(it));
  }
  wrap.appendChild(toggle);
  return wrap;
}

// 카드 여러 장을 containerEl에 채움. 비어 있으면 emptyText 한 줄만.
// playingId: 방의 턴테이블에서 도는 곡의 id — 그 카드에 "재생 중" 표시.
// onPlay: 주면 음악 카드마다 왼쪽 위에 재생 표시(withPlayToggle)를 붙이고, 오른쪽 위
//         "재생 중" 배지는 뺌(내 방의 최애음악 줄).
export function renderCards(containerEl, list, { onOpen, showCat, emptyText, playingId, onPlay }) {
  containerEl.innerHTML = '';
  if (list.length === 0 && emptyText) {
    containerEl.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }
  list.forEach((it) => {
    const toggled = !!onPlay && it.cat === 'music';
    const card = renderCard(it, { onOpen, showCat, playingId, showPlayingBadge: !toggled });
    containerEl.appendChild(toggled ? withPlayToggle(card, it, { playing: it.id === playingId, onPlay }) : card);
  });
}
