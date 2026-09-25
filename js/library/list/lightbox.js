import { renderDetailRow } from './detailRow.js';

// 사진 하나를 크게 보여주는 팝업 — 그리드에서 카드를 누르면 뜸. 내용은
// 목록 아코디언과 똑같은 renderDetailRow를 재사용해서, "고쳐 쓰기/삭제/
// 대표작" 같은 동작이 두 화면에서 다르게 굴러가지 않게 함. 고쳐
// 쓰기/삭제확정/대표작은 팝업을 닫고 나서 원래 콜백으로 넘김(수정
// 모달이 뜨거나 목록이 다시 그려지는 동안 팝업이 남아있으면 헷갈림) —
// "삭제할까요?" 확인만 팝업 안에서 그대로 처리함.
export function createLightbox(lightboxEl, { onEdit, onDelete, onFeature, readOnly }) {
  if (!lightboxEl) return { open() {}, close() {} };
  const inner = lightboxEl.querySelector('.thumb-lightbox-inner');

  function open(it) {
    inner.innerHTML = '';
    const det = renderDetailRow(it, {
      readOnly,
      onEdit: (item) => { close(); onEdit(item); },
      onDelete: (id) => { close(); onDelete(id); },
      onFeature: (item) => { close(); onFeature(item); },
      onCancelDelete: () => open(it),
    });
    inner.appendChild(det);
    lightboxEl.hidden = false;
  }
  function close() {
    lightboxEl.hidden = true;
    inner.innerHTML = '';
  }

  lightboxEl.addEventListener('click', (e) => { if (e.target === lightboxEl) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightboxEl.hidden) close();
  });

  return { open, close };
}
