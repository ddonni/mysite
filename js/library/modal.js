// "새 기록 추가 / 기존 기록 수정하기" 모달창을 담당하는 모듈.
// 카테고리 탭, 열기/닫기, 저장 버튼 배선은 여기서 하지만, 별점/사진 첨부는 각자 자기
// 상태를 스스로 관리하는 위젯(modal/starPicker.js, modal/photoPicker.js)으로, 제목·만든
// 사람 칸의 자동 완성과 책·음악·영화·애니 검색은 modal/recordSearch.js로 빠져 있음 —
// 이 파일은 그 결과만 모아서 폼을 채우고 비우고 저장하는 오케스트레이션만 함.
//
// 창은 두 화면: 새 기록은 검색 화면(modal/searchView.js)부터 — 결과를 고르면 값이 채워진
// 입력 칸으로 넘어가 별점·감상을 쓰고 저장하면 다시 검색 화면(결과가 남아 있어 이어서 넣음).
// 결과 줄의 "+ 넣기"도 같음. 검색에 없으면 "+ 직접 쓰기"로 빈 입력 칸.
// 수정은 입력 칸만.
//
// 실제 서버 저장은 records.js의 uploadPhoto/saveRecord/deleteRecord를 불러 씀.
import { CATS, uploadPhoto, saveRecord, deleteRecord, fetchScreenCreator, fetchMusicListen } from './records.js';
import { normalizeYouTube, getPlayer } from '../shared/youtube.js';
import { CREATOR_FIELD, TITLE_PLACEHOLDER } from './modal/categoryFields.js';
import { createStarPicker } from './modal/starPicker.js';
import { createPhotoPicker } from './modal/photoPicker.js';
import { createRecordSearch } from './modal/recordSearch.js';
import { createSearchView } from './modal/searchView.js';
import { shrinkImage } from './modal/shrinkImage.js';
import { fitToViewport } from './modal/fitViewport.js';

// onSaved(): 기록을 저장·삭제한 뒤(목록을 다시 불러오라고). getItems(): 지금 방의 기록 —
// 검색 결과에서 이미 기록한 걸 표시하려고.
export function createModal({ onSaved, getItems = () => [] }) {
  const overlay = document.getElementById('overlay');
  const catTabsEl = document.getElementById('catTabs');
  const searchEl = document.getElementById('searchView');
  const formEl = document.getElementById('formView');
  const fTitle = document.getElementById('fTitle');
  const fCreator = document.getElementById('fCreator');
  const creatorLabel = document.getElementById('creatorLabel');
  const fMemo = document.getElementById('fMemo');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const titleError = document.getElementById('titleError');
  const modalTitle = document.getElementById('modalTitle');
  // 음악만 보이는 유튜브 링크 칸.
  const listenField = document.getElementById('listenField');
  const fListen = document.getElementById('fListen');
  const listenTry = document.getElementById('listenTry');
  const listenHint = document.getElementById('listenHint');
  const listenError = document.getElementById('listenError');

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
  // 입력 칸을 검색 화면에서 열었는지 — 그러면 취소·저장 뒤 검색 화면으로 돌아감.
  let fromSearch = false;
  // 고른 영화·애니의 감독(음악은 유튜브 주소)을 따로 물어보는 요청 번호 — 그새 다른 걸
  // 고르면 늦은 답은 버림.
  let creatorLookup = 0;
  const search = createRecordSearch({
    fTitle,
    fCreator,
    titleList: document.getElementById('titleList'),
    creatorList: document.getElementById('creatorList'),
    photoPicker,
    getCat: () => currentCat,
    onPicked: (pick) => fillListen(pick),
  });
  const searchView = createSearchView({
    getCat: () => currentCat,
    getItems,
    onPick: (c) => openForm({ candidate: c }),
    onManual: (q) => openForm({ title: q }),
    onUndo: (record) => deleteRecord(record.id).then(() => onSaved()),
  });
  // 폰 키보드에 창 아래쪽이 가려지지 않게(modal/fitViewport.js).
  const fit = fitToViewport({
    overlay,
    group: overlay.querySelector('.title-group'),
    actions: formEl.querySelector('.modal-actions'),
  });

  // 카테고리 탭이 바뀔 때마다 만든 사람 칸 라벨과 제목 칸 안내 글씨를 그 탭에 맞춤.
  function updateCreatorField() {
    const field = CREATOR_FIELD[currentCat] || CREATOR_FIELD.book;
    creatorLabel.textContent = field.label;
    fTitle.placeholder = TITLE_PLACEHOLDER[currentCat] || TITLE_PLACEHOLDER.book;
    listenField.hidden = currentCat !== 'music';
  }

  // ---- 유튜브 링크 칸 ----
  function updateListenTry() {
    listenTry.disabled = !normalizeYouTube(fListen.value);
  }
  fListen.addEventListener('input', () => {
    listenLookup++; // 직접 고쳤으면 찾던 링크는 버림
    listenError.style.display = 'none';
    listenHint.textContent = '';
    updateListenTry();
  });
  listenTry.addEventListener('click', () => {
    const url = normalizeYouTube(fListen.value);
    if (url) getPlayer().play({ title: fTitle.value.trim(), creator: fCreator.value.trim(), listen_url: url });
  });
  function setListen(url, hint = '') {
    fListen.value = url || '';
    listenHint.textContent = hint;
    listenError.style.display = 'none';
    updateListenTry();
  }

  function selectCatTab(cat) {
    currentCat = CATS.some((c) => c.key === cat) ? cat : 'book';
    [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
    updateCreatorField();
  }

  // ---- 카테고리 탭(책/애니/영화/음악) ----
  CATS.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat.label;
    btn.dataset.key = cat.key;
    if (cat.key === currentCat) btn.classList.add('active');
    btn.addEventListener('click', () => {
      selectCatTab(cat.key);
      if (formEl.hidden) searchView.refresh();
      else search.refresh();
    });
    catTabsEl.appendChild(btn);
  });

  // ---- 모달 열기/닫기 ----
  // 열려 있는 동안 뒤 페이지(body)는 스크롤을 막음 — 폰에서 창 끝까지 당기면 그 당김이
  // 뒤 페이지로 넘어가 창이 통째로 밀리고 뒤가 보였음(창 쪽은 CSS overscroll-behavior).
  function setOpen(open) {
    overlay.classList.toggle('open', open);
    document.body.classList.toggle('modal-open', open);
    if (open) fit.update();
  }

  function showView(form) {
    searchEl.hidden = form;
    formEl.hidden = !form;
    if (overlay.classList.contains('open')) fit.update();
  }

  // 입력 칸만 비움(카테고리는 그대로).
  function clearFields() {
    titleError.style.display = 'none';
    fTitle.value = '';
    fCreator.value = '';
    fMemo.value = '';
    setListen('');
    listenLookup++;
    search.reset();
    photoPicker.reset();
    starPicker.setValue(0);
    creatorLookup++;
  }

  // 영화·애니 검색 결과엔 감독이 없을 때가 있어서 고른 것만 따로 물어봄(못 찾으면 '').
  const creatorOf = (c) => (c.screen && !c.creator
    ? fetchScreenCreator(c.screen.media, c.screen.id).catch(() => '')
    : Promise.resolve(c.creator || ''));

  // 검색 화면에서 입력 칸으로 — candidate(고른 결과)면 그 값으로, title(직접 쓰기)이면 제목만.
  function openForm({ candidate, title }) {
    clearFields();
    editingId = null;
    fromSearch = true;
    modalTitle.textContent = '새 기록';
    cancelBtn.textContent = '← 검색으로';
    showView(true);
    if (!candidate) {
      fTitle.value = title || '';
      fTitle.focus();
      return;
    }
    fTitle.value = candidate.title;
    fCreator.value = candidate.creator || '';
    if (candidate.cover) photoPicker.setExisting(candidate.cover);
    if (candidate.screen && !candidate.creator) {
      const lookup = ++creatorLookup;
      creatorOf(candidate).then((name) => {
        if (lookup === creatorLookup && name && !fCreator.value.trim()) fCreator.value = name;
      });
    }
    fillListen(candidate);
  }

  // 음악 검색 결과를 골랐을 때(검색 화면·제목 칸 둘 다) 유튜브 링크 칸 — 노래 목록에서
  // 고르면 주소가 이미 있고, 앨범 줄이면 그 앨범에서 이 노래(제목 칸 값)를 찾아 봄.
  // 다른 결과를 고르면 앞의 링크는 바뀜. 늦게 온 답은 그사이 칸을 고쳤으면 버림.
  let listenLookup = 0;
  function fillListen(c) {
    if (currentCat !== 'music') return;
    const lookup = ++listenLookup;
    const found = '검색 결과에서 찾은 링크예요. 다른 영상이면 바꿔 넣어 주세요.';
    if (c.listen) { setListen(c.listen, found); return; }
    setListen('');
    if (!c.albumId) return;
    listenHint.textContent = '틀 수 있는 링크를 찾는 중…';
    fetchMusicListen(c.albumId, fTitle.value.trim() || c.title).then((url) => {
      if (lookup !== listenLookup || fListen.value.trim()) return;
      if (url) setListen(url, found);
      else listenHint.textContent = '링크를 못 찾았어요. 유튜브에서 복사해 넣을 수 있어요.';
    });
  }

  function backToSearch() {
    editingId = null;
    clearFields();
    showView(false);
    searchView.focus();
  }

  // 창은 "취소"(또는 저장 성공)로만 닫힘 — 예전엔 창 바깥을 누르면 닫혀서,
  // 입력하다 실수로 바깥을 건드리면 쓰던 내용이 통째로 날아갔음. 검색 화면에서 연
  // 입력 칸의 취소는 검색 화면으로 돌아감.
  cancelBtn.addEventListener('click', () => (fromSearch ? backToSearch() : setOpen(false)));
  document.getElementById('searchCloseBtn').addEventListener('click', () => setOpen(false));

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

    // 음악의 유튜브 링크 — 비었으면 없음, 쓴 게 유튜브 주소가 아니면 저장하지 않고 알려 줌.
    const listenRaw = currentCat === 'music' ? fListen.value.trim() : '';
    const listen_url = listenRaw ? normalizeYouTube(listenRaw) : null;
    if (listenRaw && !listen_url) {
      saveBtn.disabled = false;
      listenError.style.display = 'block';
      fListen.focus();
      return;
    }

    saveBtn.textContent = '저장 중…';
    try {
      let photo_url = photoPicker.getUrl();
      if (photoPicker.getFile()) {
        photo_url = await uploadPhoto(await shrinkImage(photoPicker.getFile()));
      }
      const saved = await saveRecord({
        cat: currentCat,
        title,
        creator: fCreator.value.trim(),
        rating: starPicker.getValue(),
        memo: fMemo.value.trim(),
        photo_url,
        listen_url,
      }, editingId);

      onSaved(); // main.js가 목록을 다시 불러와 화면에 반영함
      if (fromSearch) {
        backToSearch();
        searchView.saved({ cat: currentCat, title, ...saved });
      } else {
        setOpen(false);
      }
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
    // cat: 처음 골라둘 카테고리 — 보고 있던 탭(음악 탭이면 음악). 전체 탭이면 책.
    openAdd(cat) {
      editingId = null;
      fromSearch = false;
      modalTitle.textContent = '새 기록';
      selectCatTab(cat);
      clearFields();
      searchView.reset();
      showView(false);
      setOpen(true);
      searchView.focus();
    },

    // list.js에서 "수정하기"를 누르면 그 기록(item) 전체를 그대로
    // 넘겨받아서, 모달 폼에 기존 값을 채워 넣음.
    openEdit(item) {
      titleError.style.display = 'none';
      editingId = item.id;
      fromSearch = false;
      modalTitle.textContent = '기록 수정하기';
      cancelBtn.textContent = '취소';
      selectCatTab(item.cat);
      fTitle.value = item.title || '';
      fCreator.value = item.creator || '';
      fMemo.value = item.memo || '';
      setListen(item.listen_url || '');
      search.reset();
      photoPicker.setExisting(item.photo_url || null);
      starPicker.setValue(item.rating || 0);
      showView(true);
      setOpen(true);
    },
  };
}
