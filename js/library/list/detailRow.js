import { escapeHtml } from '../../shared/dom.js';
import { ratingText, featureButtonLabel, thumbSrcOf } from './itemFormat.js';

// 기록 하나의 상세 내용 — 목록 아코디언과 그리드의 사진 팝업(lightbox.js)
// 둘 다 이 함수를 그대로 재사용해서, "고쳐 쓰기/삭제/대표작" 같은
// 동작이 두 화면에서 다르게 굴러가지 않게 함. 콜백/readOnly는 호출하는
// 쪽이 전부 명시적으로 넘겨줌 — 이 모듈은 목록의 다른 상태(activeTab,
// openId 등)를 전혀 몰라도 됨.
export function renderDetailRow(it, { onEdit, onDelete, onFeature, onCancelDelete, readOnly }) {
  const det = document.createElement('div');
  det.className = 'detail-row';
  const thumbSrc = thumbSrcOf(it);
  det.innerHTML = `
    ${thumbSrc ? `<img class="thumb" src="${thumbSrc}">` : ''}
    <div class="body">
      <div class="detail-title">
        ${it.featured ? '⭐ ' : ''}${escapeHtml(it.title)}
        ${it.creator ? `<span class="creator">${escapeHtml(it.creator)}</span>` : ''}
        <span class="rating">${ratingText(it.rating)}</span>
      </div>
      <div class="memo ${it.memo ? '' : 'empty-memo'}">${it.memo ? escapeHtml(it.memo) : '남긴 감상이 없어요.'}</div>
      ${readOnly ? '' : `
      <div class="actions" id="actions-${it.id}">
        <span data-act="edit">고쳐 쓰기</span>
        <span data-act="delete">삭제</span>
        ${featureButtonLabel(it.cat, it.featured) ? `<span data-act="feature">${featureButtonLabel(it.cat, it.featured)}</span>` : ''}
      </div>`}
    </div>
  `;
  if (readOnly) return det; // 남의 방을 보는 중엔 수정/삭제 버튼 자체가 없음
  det.querySelector('[data-act="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    onEdit(it); // 이미 item 전체를 갖고 있으니, id가 아니라 통째로 넘겨줌
  });
  det.querySelector('[data-act="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    // 실수 삭제 방지: 바로 지우지 않고 "정말요?" 확인 버튼으로 한 번 더 물어봄.
    const actionsEl = det.querySelector(`#actions-${it.id}`);
    actionsEl.innerHTML = `
      <span style="color:var(--accent);">정말 삭제할까요?</span>
      <span data-act="confirm-delete">예, 삭제</span>
      <span data-act="cancel-delete">아니오</span>
    `;
    actionsEl.querySelector('[data-act="confirm-delete"]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      onDelete(it.id);
    });
    actionsEl.querySelector('[data-act="cancel-delete"]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      onCancelDelete();
    });
  });
  const featureBtn = det.querySelector('[data-act="feature"]');
  if (featureBtn) {
    featureBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onFeature(it);
    });
  }
  return det;
}
