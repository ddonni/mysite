// ?!를 창(팝업) 없이 쓰고 고치는 입력 칸(2026-11-26 사용자 요청 "쓸 때 팝업이 안 떴으면").
//   - 격자 맨 앞 "+ ?!" → 그 칸이 한 줄을 다 차지하는 입력 칸으로(openNoteDraft — list.js가 부름).
//   - 카드 뒷면 "수정" → 그 카드 자리가 같은 입력 칸으로(cardsView.js가 mountNoteEditor를 씀).
// 입력 칸 하나에 글·유튜브 링크를 쓰거나 붙여 넣고, 사진은 붙여넣기·끌어다 놓기·"사진" 버튼으로 한 장.
// (페이지 아무 데서나 붙여넣기는 만들었다가 뺐음 — 사용자가 원한 건 입력 칸에 붙여넣기였음.)
import { saveRecord, uploadPhoto } from './records.js';
import { NOTE_MAX, joinNote, notePartsFrom } from './noteText.js';
import { shrinkImage } from './modal/shrinkImage.js';
import { photoSrc } from '../shared/photoSrc.js';

// parts = notePartsFrom(...)의 { memo, listen_url, photo_url }. id를 주면 그 ?!를 고침.
export function saveNote(parts, id) {
  return saveRecord({ cat: 'note', title: '', memo: parts.memo, listen_url: parts.listen_url, photo_url: parts.photo_url }, id);
}

const imageIn = (files) => [...(files || [])].find((f) => f && f.type && f.type.startsWith('image/'));

// root 안에 입력 칸 + 사진 미리보기 + [사진] [취소] [저장]. item을 주면 그 ?!의 값으로 채움(고치기).
// onSave(parts) → Promise(실패하면 안내하고 그대로), onCancel(): 취소·Esc.
export function mountNoteEditor(root, { item = null, onSave, onCancel, hint = '' }) {
  root.innerHTML = `
    <div class="note-editor">
      <textarea class="note-input" maxlength="${NOTE_MAX}" rows="4" aria-label="?! 내용"
        placeholder="아무거나 적거나 붙여 넣어요. 사진·유튜브 링크도 돼요."></textarea>
      <div class="note-photo" hidden>
        <img alt="">
        <button type="button" class="note-photo-x" aria-label="사진 빼기" title="사진 빼기">×</button>
      </div>
      <div class="note-editor-bar">
        <label class="back-btn ghost note-photo-btn">사진<input type="file" accept="image/*" hidden></label>
        <span class="note-editor-hint"></span>
        <button type="button" class="back-btn ghost" data-ed="cancel">취소</button>
        <button type="button" class="back-btn" data-ed="save" disabled>저장</button>
      </div>
    </div>`;
  const input = root.querySelector('textarea');
  const photoBox = root.querySelector('.note-photo');
  const photoImg = photoBox.querySelector('img');
  const hintEl = root.querySelector('.note-editor-hint');
  const saveBtn = root.querySelector('[data-ed="save"]');
  let photoUrl = item ? item.photo_url || null : null; // 저장할 주소(올리기가 끝난 것)
  let preview = photoUrl ? photoSrc(photoUrl) : null; // 보여 줄 그림(올리는 중엔 이 기기의 파일)
  let uploading = false;
  let saving = false;
  input.value = item ? joinNote(item) : '';
  hintEl.textContent = hint;

  function paint() {
    photoBox.hidden = !preview;
    if (preview) photoImg.src = preview;
    saveBtn.disabled = uploading || saving || !notePartsFrom(input.value, photoUrl);
  }

  // 사진 한 장 — 바로 줄여서 올리고(새 기록 창과 같은 shrinkImage), 그동안은 저장을 막음.
  async function attach(file) {
    uploading = true;
    preview = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null;
    hintEl.textContent = '사진 올리는 중…';
    paint();
    try {
      photoUrl = await uploadPhoto(await shrinkImage(file));
      if (!preview) preview = photoSrc(photoUrl); // 이 기기 파일로 미리 못 보여 줬으면 올린 주소로
      hintEl.textContent = hint;
    } catch (e) {
      photoUrl = null;
      preview = null;
      hintEl.textContent = '사진을 올리지 못했어요. 다시 해 보세요.';
    }
    uploading = false;
    paint();
  }

  function save() {
    const parts = notePartsFrom(input.value, photoUrl);
    if (!parts || saveBtn.disabled) return;
    saving = true;
    paint();
    Promise.resolve(onSave(parts)).catch(() => {
      saving = false;
      hintEl.textContent = '저장에 실패했어요. 잠시 후 다시 해 보세요.';
      paint();
    });
  }

  input.addEventListener('input', paint);
  // 입력 칸에 그림을 붙여 넣으면 사진으로(글·링크는 칸에 그대로 들어감).
  input.addEventListener('paste', (e) => {
    const file = imageIn(e.clipboardData && e.clipboardData.files);
    if (!file) return;
    e.preventDefault();
    attach(file);
  });
  root.addEventListener('dragover', (e) => { e.preventDefault(); });
  root.addEventListener('drop', (e) => {
    const file = imageIn(e.dataTransfer && e.dataTransfer.files);
    if (!file) return;
    e.preventDefault();
    attach(file);
  });
  root.querySelector('input[type="file"]').addEventListener('change', (e) => {
    const file = imageIn(e.target.files);
    e.target.value = '';
    if (file) attach(file);
  });
  root.querySelector('.note-photo-x').addEventListener('click', () => { photoUrl = null; preview = null; paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  });
  saveBtn.addEventListener('click', save);
  root.querySelector('[data-ed="cancel"]').addEventListener('click', onCancel);
  paint();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

// 격자 맨 앞 칸(slot)을 입력 칸으로 — 한 줄을 다 차지해서 폰에서도 넉넉하게. onSave(parts) → Promise
// (저장되면 목록이 새로 그려져서 칸도 원래대로), onClose(): 취소했을 때 칸을 되돌림.
export function openNoteDraft(slot, { onSave, onClose }) {
  slot.classList.add('drafting');
  slot.innerHTML = '<div class="note-draft"></div>';
  mountNoteEditor(slot.firstElementChild, { onSave, onCancel: onClose, hint: '나만 봐요 · Ctrl+Enter 저장' });
}
