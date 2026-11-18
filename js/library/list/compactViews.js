// 한눈에 보기 — "촘촘히"(표지만 작게 빽빽이)와 "목록"(한 줄에 한 작품). 2026-11-18 피드백 "카드로는 모든
// 작품을 한눈에 볼 수 없다"로 추가. 카드 보기(cardsView.js)는 그대로 두고, 위 줄의 보기 전환 버튼으로 고름.
// 두 보기에서 작품을 누르면 그 작품의 카드가 화면 가운데에 크게(뒷면이 보이게) 떠서 — 감상 보기·수정·삭제·
// 인생작·공감·듣기를 카드 보기와 똑같이 씀(createCardDialog).
import { escapeHtml, escapeAttr } from '../../shared/dom.js';
import { photoSrc } from '../../shared/photoSrc.js';
import { catLabel, catIconHtml, featureLabel, progressLabel, ratingStars } from './itemFormat.js';
import { renderCards } from './cardsView.js';

function coverImg(it) {
  return it.photo_url
    ? `<img src="${escapeAttr(photoSrc(it.photo_url))}" alt="" loading="lazy" crossorigin="anonymous">`
    : `<span class="noimg" aria-hidden="true">${escapeHtml((it.title || '').slice(0, 1))}</span>`;
}

const inProgress = (it) => it.in_progress && it.cat !== 'music';

// 촘촘히 — 표지만. 인생작은 금테, 보는 중은 초록 점, 오른쪽 위 작은 카테고리 아이콘. 제목은 마우스를 올리면.
function denseHtml(it) {
  const label = `${it.title}${it.creator ? ` — ${it.creator}` : ''}`;
  return `
    <button type="button" class="dense-item${it.featured ? ' rare' : ''}" data-id="${it.id}" data-cat="${it.cat}"
      title="${escapeAttr(label)}" aria-label="${escapeAttr(`${catLabel(it.cat)} ${label}`)}">
      ${coverImg(it)}
      ${catIconHtml(it.cat)}
      ${inProgress(it) ? `<span class="dense-progress" aria-label="${progressLabel(it.cat)}"></span>` : ''}
      <span class="dense-title" aria-hidden="true">${escapeHtml(it.title)}</span>
    </button>`;
}

// 목록 — 작은 표지 · 제목/만든 사람 · 카테고리 · 별점 · 날짜.
function rowHtml(it) {
  const tags = [
    it.featured ? `<span class="row-tag rare">${featureLabel(it.cat)}</span>` : '',
    inProgress(it) ? `<span class="row-tag progress">${progressLabel(it.cat)}</span>` : '',
  ].join('');
  return `
    <button type="button" class="row-item" data-id="${it.id}" data-cat="${it.cat}">
      <span class="row-cover">${coverImg(it)}</span>
      <span class="row-main">
        <span class="row-title">${escapeHtml(it.title)}${tags}</span>
        <span class="row-sub">${it.creator ? escapeHtml(it.creator) : ''}</span>
      </span>
      <span class="row-cat"><i class="dot"></i>${catLabel(it.cat)}</span>
      <span class="row-rating">${it.rating ? ratingStars(it.rating) : ''}</span>
      <span class="row-date">${it.date ? it.date.replace(/-/g, '.') : ''}</span>
    </button>`;
}

// view: 'dense' | 'list'. onOpen(it): 작품을 눌렀을 때(카드 크게 보기).
export function renderCompact(containerEl, list, { view, emptyText, onOpen }) {
  containerEl.innerHTML = '';
  if (!list.length) {
    if (emptyText) containerEl.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }
  containerEl.innerHTML = list.map(view === 'list' ? rowHtml : denseHtml).join('');
  const byId = new Map(list.map((it) => [String(it.id), it]));
  containerEl.querySelectorAll('[data-id]').forEach((el) => {
    el.addEventListener('click', () => onOpen(byId.get(el.dataset.id)));
  });
}

// 카드 크게 보기 — 카드 하나를 가운데 띄우고 바로 뒷면을 보여 줌. 수정·삭제·인생작은 창을 닫고 원래
// 동작으로(목록이 다시 그려지니까), 공감·듣기는 창을 연 채로. 바깥·×·Esc로 닫힘.
export function createCardDialog({ onEdit, onDelete, onFeature, onListen, onLike, readOnly }) {
  const dialog = document.getElementById('cardDialog');
  const holder = dialog && dialog.querySelector('.card-dialog-slot');
  if (!dialog || !holder) return { open() {} };
  let returnFocus = null;

  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    holder.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }
  const closing = (fn) => (fn ? (...args) => { close(); return fn(...args); } : fn);

  function open(it) {
    if (!it) return;
    returnFocus = document.activeElement;
    renderCards(holder, [it], {
      readOnly,
      onEdit: closing(onEdit),
      onDelete: closing(onDelete),
      onFeature: closing(onFeature),
      onListen,
      onLike,
    });
    const card = holder.querySelector('.card');
    if (card) card.setAttribute('aria-pressed', 'true'); // 바로 뒷면(감상·버튼)
    dialog.hidden = false;
    document.body.classList.add('modal-open');
    dialog.querySelector('.card-dialog-close').focus();
  }

  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.querySelector('.card-dialog-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { open, close };
}
