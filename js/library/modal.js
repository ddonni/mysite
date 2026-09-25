// "새 기록 추가 / 기존 기록 고쳐 쓰기" 모달창을 담당하는 모듈.
// 카테고리 탭, 제목 입력, 저장 버튼 배선은 여기서 하지만, 별점/사진
// 첨부/제목 추천 목록은 각자 자기 상태를 스스로 관리하는 위젯
// (modal/starPicker.js, modal/photoPicker.js, modal/presetAutocomplete.js)
// 으로 빠져 있음 — 이 파일은 그 위젯들의 getValue()/getFile() 같은
// 결과만 모아서 폼을 채우고 비우고 저장하는 오케스트레이션만 함.
//
// 실제 서버 저장은 records.js의 uploadPhoto/saveRecord를 불러 씀.
import { CATS, PRESETS, uploadPhoto, saveRecord } from './records.js';
import { CREATOR_FIELD } from './modal/categoryFields.js';
import { createStarPicker } from './modal/starPicker.js';
import { createPhotoPicker } from './modal/photoPicker.js';
import { createPresetAutocomplete } from './modal/presetAutocomplete.js';

export function createModal({ onSaved }) {
  const overlay = document.getElementById('overlay');
  const catTabsEl = document.getElementById('catTabs');
  const fTitle = document.getElementById('fTitle');
  const fCreator = document.getElementById('fCreator');
  const creatorLabel = document.getElementById('creatorLabel');
  const fMemo = document.getElementById('fMemo');
  const saveBtn = document.getElementById('saveBtn');
  const titleError = document.getElementById('titleError');
  const modalTitle = document.getElementById('modalTitle');

  const starPicker = createStarPicker(document.getElementById('starPicker'));
  const photoPicker = createPhotoPicker({
    input: document.getElementById('fPhoto'),
    preview: document.getElementById('photoPreview'),
    removeBtn: document.getElementById('removePhoto'),
    dropZone: document.getElementById('photoDrop'),
    dropText: document.getElementById('photoDropText'),
  });
  const presetAutocomplete = createPresetAutocomplete(
    { input: fTitle, listEl: document.getElementById('presetList') },
    PRESETS,
    () => currentCat,
  );

  let currentCat = 'book';
  let editingId = null;

  function updateCreatorField() {
    const field = CREATOR_FIELD[currentCat] || CREATOR_FIELD.book;
    creatorLabel.textContent = field.label;
  }

  // ---- 카테고리 탭(책/애니/영화/음악) ----
  CATS.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat.label;
    btn.dataset.key = cat.key;
    if (cat.key === currentCat) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentCat = cat.key;
      [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === cat.key));
      updateCreatorField();
      presetAutocomplete.refresh();
    });
    catTabsEl.appendChild(btn);
  });

  // ---- 모달 열기/닫기 ----
  function resetFormForAdd() {
    editingId = null;
    titleError.style.display = 'none';
    modalTitle.textContent = '새 기록';
    currentCat = 'book';
    [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
    updateCreatorField();
    fTitle.value = '';
    fCreator.value = '';
    fMemo.value = '';
    photoPicker.reset();
    starPicker.setValue(0);
    presetAutocomplete.hide();
  }

  document.getElementById('cancelBtn').addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

  // ---- 저장 ----
  async function handleSave() {
    const title = fTitle.value.trim();
    if (!title) { titleError.style.display = 'block'; fTitle.focus(); return; }
    titleError.style.display = 'none';

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중…';
    try {
      let photo_url = photoPicker.getUrl();
      if (photoPicker.getFile()) {
        photo_url = await uploadPhoto(photoPicker.getFile());
      }
      await saveRecord({
        cat: currentCat,
        title,
        creator: fCreator.value.trim(),
        rating: starPicker.getValue(),
        memo: fMemo.value.trim(),
        photo_url,
      }, editingId);

      onSaved(); // main.js가 목록을 다시 불러와 화면에 반영함
      overlay.classList.remove('open');
    } catch (err) {
      alert('저장에 실패했어요. 잠시 후 다시 시도해주세요.');
      console.error(err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  }
  saveBtn.addEventListener('click', handleSave);

  return {
    openAdd() {
      resetFormForAdd();
      overlay.classList.add('open');
    },

    // list.js에서 "고쳐 쓰기"를 누르면 그 기록(item) 전체를 그대로
    // 넘겨받아서, 모달 폼에 기존 값을 채워 넣음.
    openEdit(item) {
      titleError.style.display = 'none';
      editingId = item.id;
      modalTitle.textContent = '기록 고치기';
      currentCat = item.cat;
      [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
      updateCreatorField();
      fTitle.value = item.title || '';
      fCreator.value = item.creator || '';
      fMemo.value = item.memo || '';
      photoPicker.setExisting(item.photo_url || null);
      starPicker.setValue(item.rating || 0);
      presetAutocomplete.hide();
      overlay.classList.add('open');
    },
  };
}
