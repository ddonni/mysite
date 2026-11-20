// 일기 사진 여러 장(2026-11-20 사용자 요청 "드래그로도, 여러 장") — 일기 쓰기 페이지의 사진 칸.
//   - 넣기: "+ 사진"(여러 장 고르기) · 페이지 어디에든 끌어다 놓기 · 복사한 사진 붙여넣기(Ctrl+V).
//   - 순서: 첫 장이 카드 표지("표지" 표시). 사진을 끌어서 순서를 바꾸거나 "표지로"를 누름. ×로 뺌.
//   - 올리기는 저장할 때(uploadAll) — 쓰다가 뺀 사진이 서버에 쌓이지 않게. 한 번 올린 건 다시 안 올림
//     (저장이 중간에 실패해서 다시 눌러도).
// 최대 장수는 백엔드 schemas.DIARY_PHOTOS_MAX와 같아야 함.
import { photoSrc } from '../shared/photoSrc.js';

export const PHOTOS_MAX = 20;

// 받을 수 있는 사진 파일만(SVG는 서버가 안 받음 — 안에 스크립트를 넣을 수 있어서), 남은 자리만큼.
export function acceptImages(files, room) {
  return [...(files || [])].filter((f) => f && f.type && f.type.startsWith('image/') && f.type !== 'image/svg+xml').slice(0, Math.max(0, room));
}

// from번째를 to번째 자리로 옮긴 새 배열.
export function movePhoto(list, from, to) {
  if (from === to || from < 0 || from >= list.length) return list.slice();
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

const hasFiles = (e) => !!(e.dataTransfer && [...e.dataTransfer.types].includes('Files'));

// gridEl: 사진 칸들, input: 파일 고르기(multiple), dropEl: 끌어올 때 화면에 뜨는 안내, noteEl: 알림 한 줄.
// onChange(): 사진이 바뀔 때마다(넣기·빼기·순서).
export function createPhotoList({ gridEl, input, dropEl, noteEl, onChange = () => {} }) {
  let items = []; // { key, url?, file?, preview }
  let seq = 0;
  let dragFrom = -1;

  function note(text) {
    noteEl.textContent = text;
    noteEl.hidden = !text;
  }

  function render() {
    gridEl.innerHTML = '';
    gridEl.hidden = !items.length;
    items.forEach((it, i) => {
      const tile = document.createElement('figure');
      tile.className = 'd-tile';
      tile.draggable = true;
      tile.dataset.index = String(i);
      const img = document.createElement('img');
      img.alt = '';
      if (it.file) img.src = it.preview;
      else { img.crossOrigin = 'anonymous'; img.src = photoSrc(it.url); }
      tile.appendChild(img);
      tile.insertAdjacentHTML('beforeend', `
        ${i === 0 ? '<span class="d-tile-cover">표지</span>' : '<button type="button" class="d-tile-first" data-act="first">표지로</button>'}
        <button type="button" class="d-tile-remove" data-act="remove" aria-label="${i + 1}번째 사진 빼기">×</button>`);
      gridEl.appendChild(tile);
    });
  }

  function changed() {
    render();
    onChange();
  }

  function add(files) {
    const room = PHOTOS_MAX - items.length;
    const ok = acceptImages(files, room);
    const all = [...(files || [])].length;
    if (!ok.length && all) { note(room <= 0 ? `사진은 ${PHOTOS_MAX}장까지 넣을 수 있어요.` : '사진 파일만 넣을 수 있어요.'); return; }
    note(ok.length < all ? (room < all ? `사진은 ${PHOTOS_MAX}장까지라 ${ok.length}장만 넣었어요.` : '사진이 아닌 파일은 뺐어요.') : '');
    ok.forEach((file) => items.push({ key: ++seq, file, preview: URL.createObjectURL(file) }));
    changed();
  }

  function removeAt(i) {
    const [gone] = items.splice(i, 1);
    if (gone && gone.file) URL.revokeObjectURL(gone.preview);
    note('');
    changed();
  }

  input.addEventListener('change', () => { add(input.files); input.value = ''; });

  gridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const i = Number(btn.closest('.d-tile').dataset.index);
    if (btn.dataset.act === 'remove') removeAt(i);
    else if (btn.dataset.act === 'first') { items = movePhoto(items, i, 0); changed(); }
  });

  // 사진 칸끼리 끌어서 순서 바꾸기(파일을 끌어오는 것과는 dataTransfer 종류로 구분).
  gridEl.addEventListener('dragstart', (e) => {
    const tile = e.target.closest('.d-tile');
    if (!tile) return;
    dragFrom = Number(tile.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragFrom));
    tile.classList.add('dragging');
  });
  gridEl.addEventListener('dragend', () => {
    dragFrom = -1;
    gridEl.querySelectorAll('.dragging, .over').forEach((t) => t.classList.remove('dragging', 'over'));
  });
  gridEl.addEventListener('dragover', (e) => {
    if (dragFrom < 0) return;
    const tile = e.target.closest('.d-tile');
    if (!tile) return;
    e.preventDefault();
    gridEl.querySelectorAll('.over').forEach((t) => t.classList.remove('over'));
    tile.classList.add('over');
  });
  gridEl.addEventListener('drop', (e) => {
    if (dragFrom < 0) return;
    const tile = e.target.closest('.d-tile');
    e.preventDefault();
    e.stopPropagation();
    if (tile) { items = movePhoto(items, dragFrom, Number(tile.dataset.index)); dragFrom = -1; changed(); }
  });

  // 페이지 어디에든 파일을 끌어다 놓으면 추가. dragenter/leave가 자식마다 오가서 수를 셈.
  let depth = 0;
  document.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; depth++; dropEl.hidden = false; });
  document.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) dropEl.hidden = true; });
  document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    dropEl.hidden = true;
    add(e.dataTransfer.files);
  });
  // 복사한 사진 붙여넣기 — 글을 붙여넣을 때는 그대로 글(사진 파일이 있을 때만 가로챔).
  document.addEventListener('paste', (e) => {
    const files = [...((e.clipboardData && e.clipboardData.files) || [])];
    if (!acceptImages(files, PHOTOS_MAX).length) return;
    e.preventDefault();
    add(files);
  });

  render();
  return {
    // 고칠 때 저장된 사진들.
    setUrls(urls) {
      items = (urls || []).map((url) => ({ key: ++seq, url }));
      render();
    },
    count: () => items.length,
    // 아직 안 올린 사진을 올리고(upload(file) → url) 순서대로 주소 목록을 돌려줌.
    async uploadAll(upload) {
      for (const it of items) {
        if (!it.url) it.url = await upload(it.file);
      }
      return items.map((it) => it.url);
    },
  };
}
