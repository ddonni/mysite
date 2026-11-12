import { escapeHtml } from '../../shared/dom.js';
import { catLabel, coverHtml, featureLabel, ratingStars } from './itemFormat.js';

// 기록 하나 = 카드 한 장(css/cards.css). 앞면은 표지 + 종류·별점·제목, 누르면 뒤집혀서
// 뒷면에 한 줄 감상·만든 사람·별점과 버튼("자세히" = 상세 창, 유튜브 링크가 있는 음악은 "▶ 듣기").
// 인생작(featured)은 황금 카드 — 마우스를 따라 기울고 홀로그램 빛·반짝이가 붙음.
//
// 뒷면 안에 버튼이 있어서 카드 자체는 <button>이 아니라 role="button"인 div(버튼 안에
// 버튼을 넣을 수 없음). 뒷면 버튼을 눌렀을 땐 카드가 다시 뒤집히지 않게 막음.

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPARKLES = [[8, 18], [82, 10], [88, 40], [12, 50], [50, 4]];

// 뒷면 아래 버튼 줄.
function backActionsHtml(it, { onListen }) {
  const btns = ['<button type="button" class="back-btn" data-act="open">자세히</button>'];
  if (it.cat === 'music' && it.listen_url && onListen) btns.push('<button type="button" class="back-btn" data-act="listen">▶ 듣기</button>');
  return `<div class="back-actions">${btns.join('')}</div>`;
}

function cardHtml(it, { onListen }) {
  const rare = !!it.featured;
  const type = catLabel(it.cat);
  const stars = it.rating ? ratingStars(it.rating) : '';
  return `
    <div class="inner">
      <div class="face front">
        ${coverHtml(it)}
        <div class="info">
          <div class="row"><span class="type">${type}</span>${stars}</div>
          <div class="card-title">${escapeHtml(it.title)}</div>
        </div>
      </div>
      <div class="face back">
        <div class="type">${type}${rare ? ` · ${featureLabel(it.cat)}` : ''}</div>
        <div class="q${it.memo ? '' : ' empty-memo'}">${it.memo ? `“${escapeHtml(it.memo)}”` : '아직 감상을 적지 않았어요.'}</div>
        ${it.creator ? `<div class="who">${escapeHtml(it.creator)}</div>` : ''}
        ${stars}
        ${backActionsHtml(it, { onListen })}
      </div>
    </div>`;
}

// 인생작 카드: 마우스 위치에 따라 기울고 홀로그램 빛이 따라 움직임.
function attachTilt(slot) {
  const tilt = slot.querySelector('.tilt');
  const foil = slot.querySelector('.foil');
  slot.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return; // 손가락으로 훑을 땐 안 기울임(스크롤과 겹침)
    const b = tilt.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    tilt.style.setProperty('--ry', `${(x - 0.5) * 18}deg`);
    tilt.style.setProperty('--rx', `${(0.5 - y) * 18}deg`);
    if (foil) { foil.style.setProperty('--mx', `${x * 100}%`); foil.style.setProperty('--my', `${y * 100}%`); }
  });
  slot.addEventListener('pointerleave', () => {
    tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg');
    if (foil) { foil.style.removeProperty('--mx'); foil.style.removeProperty('--my'); }
  });
}

function makeSlot(it, { onOpen, onListen }) {
  const slot = document.createElement('div');
  slot.className = 'slot' + (it.featured ? ' rare' : '');
  slot.dataset.cat = it.cat;
  slot.dataset.id = it.id;

  const card = document.createElement('div');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-pressed', 'false');
  card.setAttribute('aria-label', `${it.title} 기록 뒤집기`);
  card.innerHTML = cardHtml(it, { onListen });
  // 인생작의 홀로그램 빛은 표지 위에만(아래 글자 칸엔 안 덮이게).
  if (it.featured) card.querySelector('.cover').insertAdjacentHTML('beforeend', '<div class="foil" aria-hidden="true"></div>');

  const flip = () => card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true'));
  card.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) { flip(); return; }
    e.stopPropagation();
    if (act.dataset.act === 'open') onOpen(it);
    else if (act.dataset.act === 'listen') onListen(it);
  });
  card.addEventListener('keydown', (e) => {
    if (e.target !== card || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    flip();
  });

  if (!it.featured) {
    slot.appendChild(card);
    return slot;
  }
  const sparkles = SPARKLES
    .map(([x, y], i) => `<span class="sparkle" style="left:${x}%;top:${y}%;animation-delay:${i * 0.45}s" aria-hidden="true">✦</span>`).join('');
  slot.innerHTML = `<div class="tilt"><div class="frame">${sparkles}</div></div>`;
  slot.querySelector('.frame').appendChild(card);
  if (!reduceMotion()) attachTilt(slot);
  return slot;
}

// 카드 여러 장을 containerEl에 채우고 그 카드(.slot)들을 돌려줌 — 나눠주기(deal)에 씀.
// 비어 있으면 emptyText 한 줄만.
// onListen: 주면 유튜브 링크가 있는 음악 카드 뒷면에 "▶ 듣기".
export function renderCards(containerEl, list, { onOpen, emptyText, onListen }) {
  containerEl.innerHTML = '';
  if (list.length === 0) {
    if (emptyText) containerEl.innerHTML = `<div class="empty">${emptyText}</div>`;
    return [];
  }
  const slots = list.map((it) => makeSlot(it, { onOpen, onListen }));
  containerEl.append(...slots);
  return slots;
}

// 촤라락 — 화면 아래 가운데 덱(.deck)에서 카드가 한 장씩 날아가 제자리에 놓임.
// 움직임 줄이기를 켠 사람에겐 안 함.
let deckTimer;
export function deal(slots, deckEl = document.querySelector('.deck')) {
  if (!slots.length || !deckEl || reduceMotion() || typeof Element.prototype.animate !== 'function') return;
  deckEl.classList.add('on');
  clearTimeout(deckTimer);
  deckTimer = setTimeout(() => deckEl.classList.remove('on'), Math.min(slots.length, 24) * 50 + 500);
  const d = deckEl.getBoundingClientRect();
  const dx0 = d.left + d.width / 2, dy0 = d.top + d.height / 2;
  const vh = window.innerHeight;
  let i = 0;
  slots.forEach((s) => {
    const b = s.getBoundingClientRect();
    if (b.top > vh) return; // 화면 밖(아래) 카드는 그냥 둠 — 수백 장이어도 첫 화면만 날아옴
    const dx = dx0 - (b.left + b.width / 2), dy = dy0 - (b.top + b.height / 2);
    const rot = (Math.random() * 40 - 20).toFixed(1);
    s.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(.35)`, opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
    ], { duration: 650, delay: i * 50, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
    i++;
  });
}
