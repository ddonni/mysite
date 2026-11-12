import { escapeHtml } from '../../shared/dom.js';
import { catLabel, coverHtml, featureLabel, featureButtonLabel, ratingStars, withEuro } from './itemFormat.js';

// 기록 하나 = 카드 한 장(css/cards.css). 앞면은 표지 + 종류·별점·제목, 누르면 뒤집혀서
// 뒷면에 한 줄 감상·만든 사람·별점과 버튼(내 기록이면 수정·삭제와 오른쪽 위 인생작 별, 유튜브 링크가
// 있는 음악은 "▶ 듣기"). 예전엔 "자세히"로 상세 창을 따로 열었는데 수정이 거기 숨어 있어서 못 찾았음
// (사용자 피드백) — 뒷면에서 바로 하게 바꾸고 상세 창은 없앰.
// 인생작(featured)은 황금 카드 — 마우스를 따라 기울고 홀로그램 빛·반짝이가 붙음.
//
// 뒷면 안에 버튼이 있어서 카드 자체는 <button>이 아니라 role="button"인 div(버튼 안에
// 버튼을 넣을 수 없음). 뒷면 버튼을 눌렀을 땐 카드가 다시 뒤집히지 않게 막음.

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPARKLES = [[8, 18], [82, 10], [88, 40], [12, 50], [50, 4]];

// 지금 "삭제할까요?"/"인생책으로 할까요?"를 묻고 있는 카드(한 번에 하나) — 대답하지 않고 카드를
// 다시 뒤집거나 다른 곳을 누르면 물음을 거두고 수정·삭제 버튼으로 되돌림(사용자 요청).
let asking = null; // { card, reset }
function stopAsking() {
  if (!asking) return;
  const { reset } = asking;
  asking = null;
  reset();
}
if (typeof document !== 'undefined') {
  // 캡처 단계에서 봐야 카드 안 클릭(뒤집기)보다 먼저 판단할 수 있음.
  document.addEventListener('click', (e) => {
    if (asking && !asking.card.contains(e.target)) stopAsking();
  }, true);
}

// 뒷면 아래 버튼 줄. 삭제는 바로 지우지 않고 이 자리에서 한 번 더 물음(confirmDeleteHtml).
function backButtons(it, { onListen, readOnly }) {
  const btns = [];
  if (!readOnly) {
    btns.push('<button type="button" class="back-btn" data-act="edit">수정</button>');
    btns.push('<button type="button" class="back-btn ghost" data-act="delete">삭제</button>');
  }
  if (it.cat === 'music' && it.listen_url && onListen) btns.push('<button type="button" class="back-btn ghost" data-act="listen">▶ 듣기</button>');
  return btns.join('');
}
const confirmDeleteHtml = `
  <span class="confirm-text">삭제할까요?</span>
  <button type="button" class="back-btn danger" data-act="confirm-delete">삭제</button>
  <button type="button" class="back-btn ghost" data-act="cancel-delete">아니요</button>`;

// 인생작 별을 눌렀을 때도 바로 바꾸지 않고 버튼 줄 자리에서 한 번 물음(삭제와 같은 방식).
function confirmFeatureHtml(it) {
  const label = featureLabel(it.cat);
  const q = it.featured ? `${label}에서 뺄까요?` : `${withEuro(label)} 할까요?`;
  return `
  <span class="confirm-text feature">${q}</span>
  <button type="button" class="back-btn" data-act="confirm-feature">예</button>
  <button type="button" class="back-btn ghost" data-act="cancel-feature">아니요</button>`;
}

// 뒷면 오른쪽 위 인생작 별(내 기록만) — 채워진 별이면 인생작. 누르면 넣을지/뺄지 물음.
function featureStarHtml(it) {
  const label = featureButtonLabel(it.cat, it.featured); // "인생책으로" / "인생책에서 빼기"
  return `<button type="button" class="feat-btn" data-act="feature" aria-pressed="${!!it.featured}" aria-label="${label}" title="${label}">${it.featured ? '★' : '☆'}</button>`;
}

function cardHtml(it, { onListen, readOnly }) {
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
        <div class="back-head"><span class="type">${type}${rare ? ` · ${featureLabel(it.cat)}` : ''}</span>${readOnly ? '' : featureStarHtml(it)}</div>
        <div class="q${it.memo ? '' : ' empty-memo'}">${it.memo ? `“${escapeHtml(it.memo)}”` : '아직 감상을 적지 않았어요.'}</div>
        ${it.creator ? `<div class="who">${escapeHtml(it.creator)}</div>` : ''}
        ${stars}
        <div class="back-actions">${backButtons(it, { onListen, readOnly })}</div>
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

function makeSlot(it, { onEdit, onDelete, onFeature, onListen, readOnly }) {
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
  card.innerHTML = cardHtml(it, { onListen, readOnly });
  // 인생작의 홀로그램 빛은 표지 위에만(아래 글자 칸엔 안 덮이게).
  if (it.featured) card.querySelector('.cover').insertAdjacentHTML('beforeend', '<div class="foil" aria-hidden="true"></div>');

  const actions = () => card.querySelector('.back-actions');
  const restoreButtons = () => { actions().innerHTML = backButtons(it, { onListen, readOnly }); };
  const ask = (html, focusAct) => {
    stopAsking(); // 다른 카드가 묻고 있었으면 그건 거둠
    actions().innerHTML = html;
    actions().querySelector(`[data-act="${focusAct}"]`).focus();
    asking = { card, reset: restoreButtons };
  };
  const flip = () => {
    if (asking && asking.card === card) stopAsking();
    card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true'));
  };
  card.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) { flip(); return; }
    e.stopPropagation();
    switch (act.dataset.act) {
      case 'edit': onEdit(it); break;
      case 'feature': ask(confirmFeatureHtml(it), 'cancel-feature'); break;
      case 'confirm-feature': asking = null; onFeature(it); break;
      case 'listen': onListen(it); break;
      case 'delete': ask(confirmDeleteHtml, 'cancel-delete'); break;
      case 'confirm-delete': asking = null; onDelete(it.id); break;
      case 'cancel-delete':
      case 'cancel-feature': stopAsking(); break;
      default: break;
    }
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
// onEdit(it)/onDelete(id)/onFeature(it): 내 기록의 뒷면 버튼(readOnly면 안 그림).
// onListen: 주면 유튜브 링크가 있는 음악 카드 뒷면에 "▶ 듣기".
export function renderCards(containerEl, list, { emptyText, onEdit, onDelete, onFeature, onListen, readOnly = false }) {
  containerEl.innerHTML = '';
  if (list.length === 0) {
    if (emptyText) containerEl.innerHTML = `<div class="empty">${emptyText}</div>`;
    return [];
  }
  const slots = list.map((it) => makeSlot(it, { onEdit, onDelete, onFeature, onListen, readOnly }));
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
