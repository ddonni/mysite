// 한눈에 보기 — "촘촘히"(표지만 작게 빽빽이)와 "목록"(한 줄에 한 작품). 2026-11-18 피드백 "카드로는 모든
// 작품을 한눈에 볼 수 없다"로 추가. 카드 보기(cardsView.js)는 그대로 두고, 위 줄의 보기 전환 버튼으로 고름.
// 두 보기에서 작품을 누르면 그 작품의 카드가 화면 가운데에 크게(뒷면이 보이게) 떠서 — 감상 보기·수정·삭제·
// 인생작·공감·듣기를 카드 보기와 똑같이 씀(createCardDialog).
import { escapeHtml, escapeAttr } from '../../shared/dom.js';
import { photoSrc } from '../../shared/photoSrc.js';
import { catLabel, catIconHtml, displayTitle, featureLabel, progressLabel, ratingStars } from './itemFormat.js';
import { youtubeThumb } from '../noteText.js';
import { paintOverflow, renderCards } from './cardsView.js';

function coverImg(it) {
  if (it.cat === 'note') {
    // ?! — 사진이면 사진, 영상이면 유튜브 썸네일, 아니면 투명한 바탕에 글 첫 글자.
    if (it.photo_url) return `<img src="${escapeAttr(photoSrc(it.photo_url))}" alt="" loading="lazy" crossorigin="anonymous">`;
    const thumb = youtubeThumb(it.listen_url);
    return thumb
      ? `<img src="${escapeAttr(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<span class="noimg note" aria-hidden="true">${escapeHtml(displayTitle(it).slice(0, 1))}</span>`;
  }
  return it.photo_url
    ? `<img src="${escapeAttr(photoSrc(it.photo_url))}" alt="" loading="lazy" crossorigin="anonymous">`
    : `<span class="noimg" aria-hidden="true">${escapeHtml((it.title || '').slice(0, 1))}</span>`;
}

const inProgress = (it) => it.in_progress && it.cat !== 'music';

// 촘촘히 — 표지만. 인생작은 금테, 보는 중은 초록 점, 오른쪽 위 작은 카테고리 아이콘. 제목은 마우스를 올리면.
function denseHtml(it) {
  const label = `${displayTitle(it)}${it.creator ? ` — ${it.creator}` : ''}`;
  return `
    <button type="button" class="dense-item${it.featured ? ' rare' : ''}" data-id="${it.id}" data-cat="${it.cat}"
      title="${escapeAttr(label)}" aria-label="${escapeAttr(`${catLabel(it.cat)} ${label}`)}">
      ${coverImg(it)}
      ${catIconHtml(it.cat)}
      ${inProgress(it) ? `<span class="dense-progress" aria-label="${progressLabel(it.cat)}"></span>` : ''}
      <span class="dense-title" aria-hidden="true">${escapeHtml(displayTitle(it))}</span>
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
        <span class="row-title">${escapeHtml(displayTitle(it))}${tags}</span>
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
export function createCardDialog({ onEdit, onDelete, onFeature, onListen, onLike, onSaveNote, readOnly }) {
  const dialog = document.getElementById('cardDialog');
  const holder = dialog && dialog.querySelector('.card-dialog-slot');
  if (!dialog || !holder) return { open() {} };
  let returnFocus = null;
  // 옆 작품으로 넘기기(내 방 벽에서 열었을 때 — 사용자 요청): 양옆 화살표 버튼·키보드 ←/→. seq = 벽에 걸린 순서,
  // 끝에서 넘기면 처음으로. 촘촘히·목록에서 연 창엔 없음.
  let seq = null;
  let at = -1;
  let showFront = false;
  const navBtn = (cls, label, ch) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `card-dialog-nav ${cls}`;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.textContent = ch;
    b.hidden = true;
    dialog.appendChild(b);
    return b;
  };
  const prevBtn = navBtn('prev', '이전 작품', '‹');
  const nextBtn = navBtn('next', '다음 작품', '›');

  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    holder.innerHTML = '';
    seq = null;
    document.body.classList.remove('modal-open');
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }
  const closing = (fn) => (fn ? (...args) => { close(); return fn(...args); } : fn);

  // 카드 한 장을 창에 그림(열 때·옆으로 넘길 때).
  function show(it) {
    renderCards(holder, [it], {
      readOnly,
      onEdit: closing(onEdit),
      onDelete: closing(onDelete),
      onFeature: closing(onFeature),
      onListen,
      onLike,
      // ?!는 창 안에서 그대로 고치고, 저장되면 닫음.
      onSaveNote: onSaveNote && ((note, parts) => onSaveNote(note, parts).then((r) => { close(); return r; })),
    });
    const card = holder.querySelector('.card');
    if (card && !showFront) card.setAttribute('aria-pressed', 'true'); // 바로 뒷면(감상·버튼)
    paintOverflow(card); // 보이고 나서야 높이를 잴 수 있음
  }

  // front: 앞면부터(내 방 벽의 작품 — 사용자 요청). 아니면 뒷면부터(촘촘히·목록에서 감상·버튼을 바로).
  // list: 주면 그 순서로 옆 작품 넘기기(내 방 벽).
  function open(it, { front = false, list = null } = {}) {
    if (!it) return;
    returnFocus = document.activeElement;
    showFront = front;
    seq = list && list.length > 1 ? list : null;
    at = seq ? seq.findIndex((x) => x.id === it.id) : -1;
    if (at < 0) seq = null;
    prevBtn.hidden = nextBtn.hidden = !seq;
    dialog.hidden = false;
    document.body.classList.add('modal-open');
    show(it);
    dialog.querySelector('.card-dialog-close').focus();
  }

  function step(delta) {
    if (!seq || dialog.hidden) return;
    at = (at + delta + seq.length) % seq.length;
    show(seq[at]);
  }
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.querySelector('.card-dialog-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (dialog.hidden || !seq || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  return { open, close };
}
