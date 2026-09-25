import { escapeHtml } from '../../shared/dom.js';
import { catLabel, coverHtml, featureButtonLabel, ratingStars } from './itemFormat.js';

// 카드를 누르면 뜨는 상세 창 — 큰 표지, 제목/만든 사람/별점/날짜, 한 줄 감상,
// 그리고(내 방일 때만) 고쳐 쓰기·인생작·삭제 버튼. 버튼을 누르면 창을 닫고
// 원래 콜백(main.js가 정함)으로 넘김 — 수정 창이 뜨거나 목록이 다시 그려지는
// 동안 이 창이 남아 있으면 헷갈림. "정말 삭제할까요?" 확인만 창 안에서 처리함.
export function createDetail(dialogEl, { onEdit, onDelete, onFeature, readOnly }) {
  if (!dialogEl) return { open() {}, close() {} };
  const inner = dialogEl.querySelector('.detail-card');
  let returnFocus = null;

  function actionsHtml(it) {
    if (readOnly) return '';
    return `
      <div class="detail-actions">
        <button type="button" class="act" data-act="edit">고쳐 쓰기</button>
        <button type="button" class="act" data-act="feature">${featureButtonLabel(it.cat, it.featured)}</button>
        <button type="button" class="act danger" data-act="delete">삭제</button>
      </div>`;
  }

  // playing: 이 곡이 지금 방의 턴테이블에서 도는 곡인지.
  function open(it, { playing = false } = {}) {
    if (dialogEl.hidden) returnFocus = document.activeElement;
    inner.dataset.cat = it.cat;
    inner.innerHTML = `
      <button type="button" class="detail-close" aria-label="닫기">×</button>
      <div class="detail-cover">${coverHtml(it, { playing })}</div>
      <div class="detail-body">
        <div class="detail-cat"><i class="dot"></i>${catLabel(it.cat)}${it.date ? ` · ${it.date.replace(/-/g, '.')}` : ''}</div>
        ${playing ? '<div class="detail-playing">▶ 지금 방의 턴테이블에서 돌고 있어요</div>' : ''}
        <h2 class="detail-title">${escapeHtml(it.title)}</h2>
        ${it.creator ? `<div class="detail-creator">${escapeHtml(it.creator)}</div>` : ''}
        ${it.rating ? `<div class="detail-rating">${ratingStars(it.rating)}<span>${it.rating.toFixed(1)}</span></div>` : ''}
        <p class="detail-memo ${it.memo ? '' : 'empty-memo'}">${it.memo ? escapeHtml(it.memo) : '남긴 감상이 없어요.'}</p>
        ${actionsHtml(it)}
      </div>
    `;
    inner.querySelector('.detail-close').addEventListener('click', close);
    wireActions(it, { playing });
    dialogEl.hidden = false;
    inner.querySelector('.detail-close').focus();
  }

  function wireActions(it, opts) {
    if (readOnly) return;
    const actions = inner.querySelector('.detail-actions');
    actions.querySelector('[data-act="edit"]').addEventListener('click', () => { close(); onEdit(it); });
    actions.querySelector('[data-act="feature"]').addEventListener('click', () => { close(); onFeature(it); });
    actions.querySelector('[data-act="delete"]').addEventListener('click', () => {
      // 실수 삭제 방지: 바로 지우지 않고 한 번 더 물어봄.
      actions.innerHTML = `
        <span class="confirm-text">정말 삭제할까요?</span>
        <button type="button" class="act danger" data-act="confirm-delete">예, 삭제</button>
        <button type="button" class="act" data-act="cancel-delete">아니오</button>
      `;
      actions.querySelector('[data-act="confirm-delete"]').addEventListener('click', () => { close(); onDelete(it.id); });
      actions.querySelector('[data-act="cancel-delete"]').addEventListener('click', () => open(it, opts));
    });
  }

  function close() {
    if (dialogEl.hidden) return;
    dialogEl.hidden = true;
    inner.innerHTML = '';
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }

  dialogEl.addEventListener('click', (e) => { if (e.target === dialogEl) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  return { open, close };
}
