// 사진 첨부 위젯: 드래그해서 놓거나 클릭해서 선택. FileReader는 미리보기용일
// 뿐이고, 실제 업로드는 modal.js가 저장 시점에 getFile()로 받아서 따로 함
// (수정하면서 사진을 안 건드렸다면 다시 업로드할 필요가 없어서).
//
// 방금 고른(아직 업로드 전인) File과 서버에 이미 올라가 있는 URL(수정
// 모드)을 이 위젯이 직접 들고 있음 — modal.js는 getFile()/getUrl()로만
// 물어보면 됨.
export function createPhotoPicker({ input, preview, removeBtn, dropZone, dropText }) {
  let file = null;
  let url = null;

  function showExisting(existingUrl) {
    if (existingUrl) {
      preview.src = existingUrl;
      preview.style.display = 'block';
      removeBtn.style.display = 'inline-block';
      dropText.textContent = '새 사진으로 바꾸려면 클릭';
    } else {
      preview.style.display = 'none';
      removeBtn.style.display = 'none';
      dropText.textContent = '드래그하거나 클릭해서 선택';
    }
  }

  function handleFile(f) {
    if (!f || !f.type.startsWith('image/')) return;
    file = f;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = 'block';
      removeBtn.style.display = 'inline-block';
      dropText.textContent = f.name;
    };
    reader.readAsDataURL(f);
  }

  input.addEventListener('change', () => handleFile(input.files[0]));
  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragging'); });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragging'); });
  });
  dropZone.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  removeBtn.addEventListener('click', () => {
    file = null; url = null; input.value = '';
    showExisting(null);
  });

  return {
    getFile: () => file,
    getUrl: () => url,
    // 수정 모드 진입 시 기존 사진 URL을 채워 넣음(없으면 빈 상태로).
    setExisting(existingUrl) {
      file = null;
      url = existingUrl || null;
      input.value = '';
      showExisting(url);
    },
    // 새로 추가 모드로 돌아갈 때 완전히 비움.
    reset() {
      file = null; url = null; input.value = '';
      showExisting(null);
    },
  };
}
