// "새 기록 추가 / 기존 기록 수정하기" 모달창을 담당하는 모듈.
// 카테고리 탭, 열기/닫기, 저장 버튼 배선은 여기서 하지만, 별점/사진 첨부는 각자 자기
// 상태를 스스로 관리하는 위젯(modal/starPicker.js, modal/photoPicker.js)으로, 제목·만든
// 사람 칸의 자동 완성과 책·음악·영화·애니 검색은 modal/recordSearch.js로 빠져 있음 —
// 이 파일은 그 결과만 모아서 폼을 채우고 비우고 저장하는 오케스트레이션만 함.
//
// 실제 서버 저장은 records.js의 uploadPhoto/saveRecord를 불러 씀.
import { CATS, uploadPhoto, saveRecord } from './records.js';
import { CREATOR_FIELD, TITLE_PLACEHOLDER } from './modal/categoryFields.js';
import { createStarPicker } from './modal/starPicker.js';
import { createPhotoPicker } from './modal/photoPicker.js';
import { createRecordSearch } from './modal/recordSearch.js';
import { shrinkImage } from './modal/shrinkImage.js';

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

  let currentCat = 'book';
  let editingId = null;
  const search = createRecordSearch({
    fTitle,
    fCreator,
    titleList: document.getElementById('titleList'),
    creatorList: document.getElementById('creatorList'),
    photoPicker,
    getCat: () => currentCat,
  });

  // 카테고리 탭이 바뀔 때마다 만든 사람 칸 라벨과 제목 칸 안내 글씨를 그 탭에 맞춤.
  function updateCreatorField() {
    const field = CREATOR_FIELD[currentCat] || CREATOR_FIELD.book;
    creatorLabel.textContent = field.label;
    fTitle.placeholder = TITLE_PLACEHOLDER[currentCat] || TITLE_PLACEHOLDER.book;
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
      search.refresh();
    });
    catTabsEl.appendChild(btn);
  });

  // ---- 모달 열기/닫기 ----
  // cat: 처음 골라둘 카테고리 — 보고 있던 탭(음악 탭이면 음악). 전체 탭이면 책.
  function resetFormForAdd(cat) {
    editingId = null;
    titleError.style.display = 'none';
    modalTitle.textContent = '새 기록';
    currentCat = CATS.some((c) => c.key === cat) ? cat : 'book';
    [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
    updateCreatorField();
    fTitle.value = '';
    fCreator.value = '';
    fMemo.value = '';
    search.reset();
    photoPicker.reset();
    starPicker.setValue(0);
  }

  // 창은 "취소"(또는 저장 성공)로만 닫힘 — 예전엔 창 바깥을 누르면 닫혀서,
  // 입력하다 실수로 바깥을 건드리면 쓰던 내용이 통째로 날아갔음.
  document.getElementById('cancelBtn').addEventListener('click', () => overlay.classList.remove('open'));

  // ---- 저장 ----
  async function handleSave() {
    if (saveBtn.disabled) return; // 저장 중에 또 눌려도(더블클릭 등) 두 번 저장하지 않게
    // 한글은 마지막 글자가 아직 "조합 중"일 수 있음 — 저장 버튼을 눌러도
    // 입력칸에서 포커스가 안 빠지는 브라우저(Mac Safari/Chrome, 폰 키보드 등)에선
    // 그 글자가 확정되기 전에 값을 읽어서 마지막 한 글자가 빠진 채 저장됐음.
    // 포커스를 빼서 조합을 확정시키고, 확정이 반영된 다음 틱에 값을 읽음.
    saveBtn.disabled = true;
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    await new Promise((r) => setTimeout(r, 0));

    const title = fTitle.value.trim();
    if (!title) {
      saveBtn.disabled = false;
      titleError.style.display = 'block';
      fTitle.focus();
      return;
    }
    titleError.style.display = 'none';

    saveBtn.textContent = '저장 중…';
    try {
      let photo_url = photoPicker.getUrl();
      if (photoPicker.getFile()) {
        photo_url = await uploadPhoto(await shrinkImage(photoPicker.getFile()));
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
    openAdd(cat) {
      resetFormForAdd(cat);
      overlay.classList.add('open');
    },

    // list.js에서 "수정하기"를 누르면 그 기록(item) 전체를 그대로
    // 넘겨받아서, 모달 폼에 기존 값을 채워 넣음.
    openEdit(item) {
      titleError.style.display = 'none';
      editingId = item.id;
      modalTitle.textContent = '기록 수정하기';
      currentCat = item.cat;
      [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
      updateCreatorField();
      fTitle.value = item.title || '';
      fCreator.value = item.creator || '';
      fMemo.value = item.memo || '';
      search.reset();
      photoPicker.setExisting(item.photo_url || null);
      starPicker.setValue(item.rating || 0);
      overlay.classList.add('open');
    },
  };
}
