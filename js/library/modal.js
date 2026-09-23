// "새 기록 추가 / 기존 기록 고쳐 쓰기" 모달창을 담당하는 모듈.
// 카테고리 탭, 제목 입력, 저장 버튼 배선은 여기서 하지만, 별점/사진
// 첨부/제목 추천 목록은 각자 자기 상태를 스스로 관리하는 위젯
// (modal/starPicker.js, modal/photoPicker.js, modal/presetAutocomplete.js)
// 으로 빠져 있음 — 이 파일은 그 위젯들의 getValue()/getFile() 같은
// 결과만 모아서 폼을 채우고 비우고 저장하는 오케스트레이션만 함.
//
// 실제 서버 저장은 records.js의 uploadPhoto/saveRecord를 불러 씀.
import { CATS, PRESETS, uploadPhoto, saveRecord } from './records.js';
import { CREATOR_FIELD, isFood, todayISO } from './modal/categoryFields.js';
import { createStarPicker } from './modal/starPicker.js';
import { createPhotoPicker } from './modal/photoPicker.js';
import { createPresetAutocomplete } from './modal/presetAutocomplete.js';

export function createModal({ onSaved }) {
  const overlay = document.getElementById('overlay');
  const catTabsEl = document.getElementById('catTabs');
  const titleLabel = document.getElementById('titleLabel');
  const fTitle = document.getElementById('fTitle');
  const fCreator = document.getElementById('fCreator');
  const creatorLabel = document.getElementById('creatorLabel');
  const dateField = document.getElementById('dateField');
  const fDate = document.getElementById('fDate');
  const ratingLabel = document.getElementById('ratingLabel');
  const memoLabel = document.getElementById('memoLabel');
  const fMemo = document.getElementById('fMemo');
  const photoLabel = document.getElementById('photoLabel');
  const photoError = document.getElementById('photoError');
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

  // 카테고리를 바꿀 때마다 음식 전용 필드(날짜)를 보이거나 숨기고,
  // 제목/사진/별점/메모 라벨을 그 카테고리에 맞는 말로 바꿔줌 — 음식은
  // 제목이 "음식 이름(선택)"이 되고 사진이 "사진(필수)"이 됨.
  function updateFieldsForCat() {
    const food = isFood(currentCat);
    dateField.style.display = food ? '' : 'none';
    if (food && !fDate.value) fDate.value = todayISO(); // 비워두면 헷갈리니 기본값을 오늘로 채워둠
    titleLabel.textContent = food ? '음식 이름' : '제목';
    photoLabel.textContent = food ? '사진 (필수)' : '사진 (선택)';
    ratingLabel.textContent = food ? '맛 평가' : '별점';
    memoLabel.textContent = food ? '메모' : '한 줄 감상';
    titleError.style.display = 'none';
    photoError.style.display = 'none';
  }

  // ---- 카테고리 탭(책/애니/영화/음악/음식) ----
  CATS.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat.label;
    btn.dataset.key = cat.key;
    if (cat.key === currentCat) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentCat = cat.key;
      [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === cat.key));
      updateCreatorField();
      updateFieldsForCat();
      presetAutocomplete.refresh();
    });
    catTabsEl.appendChild(btn);
  });

  // ---- 모달 열기/닫기 ----
  function resetFormForAdd() {
    editingId = null;
    titleError.style.display = 'none';
    photoError.style.display = 'none';
    modalTitle.textContent = '새로운 기록';
    currentCat = 'book';
    [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
    updateCreatorField();
    updateFieldsForCat();
    fTitle.value = '';
    fCreator.value = '';
    fDate.value = '';
    fMemo.value = '';
    photoPicker.reset();
    starPicker.setValue(0);
    presetAutocomplete.hide();
  }

  document.getElementById('cancelBtn').addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

  // ---- 저장 ----
  async function handleSave() {
    const food = isFood(currentCat);
    const title = fTitle.value.trim();
    if (!food && !title) { titleError.style.display = 'block'; fTitle.focus(); return; }
    titleError.style.display = 'none';

    // 음식은 제목 대신 사진이 필수 — 수정 모드에서 이미 올려둔 사진을
    // 그대로 두는 것도 photoPicker.hasPhoto()가 true로 쳐줌.
    if (food && !photoPicker.hasPhoto()) { photoError.style.display = 'block'; return; }
    photoError.style.display = 'none';

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중…';
    try {
      let photo_url = photoPicker.getUrl();
      if (photoPicker.getFile()) {
        photo_url = await uploadPhoto(photoPicker.getFile());
      }
      await saveRecord({
        cat: currentCat,
        title: title || null,
        creator: fCreator.value.trim(),
        rating: starPicker.getValue(),
        memo: fMemo.value.trim(),
        photo_url,
        date: food ? (fDate.value || null) : null,
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
      photoError.style.display = 'none';
      editingId = item.id;
      modalTitle.textContent = '기록 고쳐 쓰기';
      currentCat = item.cat;
      [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
      updateCreatorField();
      updateFieldsForCat();
      fTitle.value = item.title || '';
      fCreator.value = item.creator || '';
      fDate.value = isFood(currentCat) ? (item.date || '') : '';
      fMemo.value = item.memo || '';
      photoPicker.setExisting(item.photo_url || null);
      starPicker.setValue(item.rating || 0);
      presetAutocomplete.hide();
      overlay.classList.add('open');
    },
  };
}
