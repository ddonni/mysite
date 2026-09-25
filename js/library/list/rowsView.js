import { CATS } from '../records.js';
import { escapeHtml } from '../../shared/dom.js';
import { ratingText } from './itemFormat.js';
import { renderDetailRow } from './detailRow.js';

// 목록 보기(아코디언). 지금 어느 항목이 펼쳐졌는지(openId)는 이 함수가
// 안 들고, 호출하는 쪽(list.js)이 들고 있다가 매번 넘겨줌 — 행을 누르면
// onToggleOpen(id)으로만 알리고, 실제로 openId를 바꾸고 다시 그리는 건
// 그쪽 몫(이 함수는 상태 없이 "지금 상태를 그리기"만 함).
export function renderRows(listEl, list, { activeTab, openId, onToggleOpen, onEdit, onDelete, onFeature, readOnly, rerender }) {
  listEl.innerHTML = '';
  if (list.length === 0) {
    listEl.innerHTML = `<div class="empty">${activeTab === 'all' ? '아직 기록이 없어요. 오른쪽 위 + 기록하기로 첫 기록을 남겨보세요.' : '아직 이 카테고리엔 기록이 없어요. 오른쪽 위 + 기록하기로 남겨보세요.'}</div>`;
    return;
  }
  list.forEach((it) => {
    const cat = CATS.find((c) => c.key === it.cat);
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <span class="cat">${cat ? cat.label : ''}</span>
      <span class="title">${it.featured ? '⭐ ' : ''}${escapeHtml(it.title)}${it.creator ? `<span class="creator">${escapeHtml(it.creator)}</span>` : ''}</span>
      <span class="rating">${ratingText(it.rating)}</span>
      <span class="date">${it.date || ''}</span>
    `;
    row.addEventListener('click', () => onToggleOpen(it.id));
    listEl.appendChild(row);

    if (openId === it.id) {
      listEl.appendChild(renderDetailRow(it, {
        onEdit, onDelete, onFeature, readOnly,
        // "아니오"(삭제 취소)를 누르면 펼침 상태(openId)는 그대로 두고
        // 지금 화면만 다시 그려서 확인 버튼을 원래 액션 버튼으로 되돌림.
        onCancelDelete: rerender,
      }));
    }
  });
}
