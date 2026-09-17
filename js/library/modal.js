// "새 기록 추가 / 기존 기록 고쳐 쓰기" 모달창을 담당하는 모듈.
// 카테고리 탭, 제목 입력(+추천 목록), 별점, 사진 첨부, 저장 버튼까지
// 이 모달 안의 모든 상호작용이 여기 모여있음.
//
// 실제 서버 저장은 records.js의 uploadPhoto/saveRecord를 불러 씀 —
// 이 파일은 "폼에 뭘 입력했는지 읽어서 그 함수들에 넘겨주고, 결과에
// 따라 모달 UI를 어떻게 바꿀지"만 신경 씀.
import { CATS, PRESETS, uploadPhoto, saveRecord } from './records.js';

export function createModal({ onSaved }) {
  const overlay = document.getElementById('overlay');
  const catTabsEl = document.getElementById('catTabs');
  const presetListEl = document.getElementById('presetList');
  const fTitle = document.getElementById('fTitle');
  const fCreator = document.getElementById('fCreator');
  const fMemo = document.getElementById('fMemo');
  const starPicker = document.getElementById('starPicker');
  const fPhoto = document.getElementById('fPhoto');
  const photoPreview = document.getElementById('photoPreview');
  const removePhotoBtn = document.getElementById('removePhoto');
  const photoDrop = document.getElementById('photoDrop');
  const photoDropText = document.getElementById('photoDropText');
  const saveBtn = document.getElementById('saveBtn');
  const titleError = document.getElementById('titleError');
  const modalTitle = document.getElementById('modalTitle');

  let currentCat = 'book';
  let currentRating = 0;
  let editingId = null;
  // currentPhotoFile: 방금 새로 고른, 아직 업로드 전인 File 객체.
  // currentPhotoUrl: 서버에 이미 올라가 있는 사진 URL (수정 모드일 때).
  // 이 둘을 따로 두는 이유: 저장 시점에 "사진을 안 건드림 / 새 걸로
  // 바꿈 / 아예 지움" 세 가지 경우를 구분해야 하기 때문.
  let currentPhotoFile = null;
  let currentPhotoUrl = null;

  // ---- 카테고리 탭(책/애니/영화) ----
  CATS.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat.label;
    btn.dataset.key = cat.key;
    if (cat.key === currentCat) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentCat = cat.key;
      [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === cat.key));
      renderPresetList(fTitle.value.trim());
    });
    catTabsEl.appendChild(btn);
  });

  // ---- 제목 입력 시 추천 목록 ----
  function renderPresetList(filter = '') {
    presetListEl.innerHTML = '';
    if (!filter) { presetListEl.style.display = 'none'; return; }
    const list = (PRESETS[currentCat] || []).filter((t) => t.toLowerCase().includes(filter.toLowerCase()));
    if (list.length === 0) { presetListEl.style.display = 'none'; return; }
    presetListEl.style.display = 'block';
    list.forEach((title) => {
      const el = document.createElement('div');
      el.className = 'preset-item';
      el.textContent = title;
      el.addEventListener('click', () => { fTitle.value = title; presetListEl.style.display = 'none'; });
      presetListEl.appendChild(el);
    });
  }
  fTitle.addEventListener('input', () => renderPresetList(fTitle.value.trim()));
  fTitle.addEventListener('focus', () => { if (fTitle.value.trim()) renderPresetList(fTitle.value.trim()); });
  document.addEventListener('click', (e) => {
    if (e.target !== fTitle && !presetListEl.contains(e.target)) presetListEl.style.display = 'none';
  });

  // ---- 별점 (0.5칸 단위, SVG 별 두 장을 겹쳐서 채워지는 비율로 표현) ----
  const STAR_PATH = 'M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 19.771l-7.416 3.642 1.48-8.279L0 9.306l8.332-1.151z';
  function starSvg() { return `<svg viewBox="0 0 24 24"><path d="${STAR_PATH}"></path></svg>`; }
  function buildStarsMarkup() {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<div class="star" data-i="${i}"><span class="bg">${starSvg()}</span><span class="fg">${starSvg()}</span></div>`;
    }
    return html;
  }
  starPicker.innerHTML = buildStarsMarkup();
  starPicker.querySelectorAll('.star').forEach((s) => {
    s.addEventListener('click', (e) => {
      const rect = s.getBoundingClientRect();
      const isHalf = (e.clientX - rect.left) < rect.width / 2; // 별의 왼쪽 절반을 누르면 반 개, 오른쪽이면 한 개
      const i = parseInt(s.dataset.i);
      currentRating = isHalf ? i - 0.5 : i;
      updateStars();
    });
  });
  function updateStars() {
    starPicker.querySelectorAll('.star').forEach((s) => {
      const i = parseInt(s.dataset.i);
      const fg = s.querySelector('.fg');
      let pct = 0;
      if (currentRating >= i) pct = 100;
      else if (currentRating >= i - 0.5) pct = 50;
      fg.style.width = pct + '%';
    });
  }

  // ---- 사진 첨부: 드래그해서 놓거나 클릭해서 선택. FileReader는 모달
  // 안 미리보기용일 뿐이고, 실제 업로드는 저장 버튼을 눌렀을 때(그리고
  // 새 파일을 골랐을 때만) 일어남 — 수정하면서 사진을 안 건드렸다면
  // 다시 업로드할 필요가 없기 때문. ----
  function handlePhotoFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    currentPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreview.src = e.target.result;
      photoPreview.style.display = 'block';
      removePhotoBtn.style.display = 'inline-block';
      photoDropText.textContent = file.name;
    };
    reader.readAsDataURL(file);
  }
  fPhoto.addEventListener('change', () => handlePhotoFile(fPhoto.files[0]));
  ['dragenter', 'dragover'].forEach((evt) => {
    photoDrop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); photoDrop.classList.add('dragging'); });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    photoDrop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); photoDrop.classList.remove('dragging'); });
  });
  photoDrop.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handlePhotoFile(file);
  });
  removePhotoBtn.addEventListener('click', () => {
    currentPhotoFile = null;
    currentPhotoUrl = null;
    fPhoto.value = '';
    photoPreview.style.display = 'none';
    removePhotoBtn.style.display = 'none';
    photoDropText.textContent = '드래그하거나 클릭해서 선택';
  });

  // ---- 모달 열기/닫기 ----
  function resetFormForAdd() {
    editingId = null;
    titleError.style.display = 'none';
    modalTitle.textContent = '새로운 기록';
    currentCat = 'book';
    currentRating = 0;
    [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
    fTitle.value = '';
    fCreator.value = '';
    fMemo.value = '';
    currentPhotoFile = null;
    currentPhotoUrl = null;
    fPhoto.value = '';
    photoPreview.style.display = 'none';
    removePhotoBtn.style.display = 'none';
    photoDropText.textContent = '드래그하거나 클릭해서 선택';
    updateStars();
    presetListEl.style.display = 'none';
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
      let photo_url = currentPhotoUrl;
      if (currentPhotoFile) {
        photo_url = await uploadPhoto(currentPhotoFile);
      }
      await saveRecord({
        cat: currentCat,
        title,
        creator: fCreator.value.trim(),
        rating: currentRating,
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
      modalTitle.textContent = '기록 고쳐 쓰기';
      currentCat = item.cat;
      currentRating = item.rating || 0;
      [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
      fTitle.value = item.title;
      fCreator.value = item.creator || '';
      fMemo.value = item.memo || '';
      currentPhotoFile = null;
      currentPhotoUrl = item.photo_url || null;
      fPhoto.value = '';
      if (currentPhotoUrl) {
        photoPreview.src = currentPhotoUrl;
        photoPreview.style.display = 'block';
        removePhotoBtn.style.display = 'inline-block';
        photoDropText.textContent = '새 사진으로 바꾸려면 클릭';
      } else {
        photoPreview.style.display = 'none';
        removePhotoBtn.style.display = 'none';
        photoDropText.textContent = '드래그하거나 클릭해서 선택';
      }
      updateStars();
      presetListEl.style.display = 'none';
      overlay.classList.add('open');
    },
  };
}
