// 일기 쓰기 페이지(diary.html, 2026-11-20 사용자 요청 "일기를 쓸 때만 블로그처럼 쓰는 페이지") — 넓은 종이 한 장에
// 날짜 · 제목(선택) · 사진(선택, 여러 장 — photos.js) · 본문. 보는 건 첫 화면 카드(다른 기록과 날짜순으로 섞임)에서.
//   - diary → 새 일기, diary?id=12 → 그 일기 고치기(카드 뒷면 "수정"·새 기록 창의 "일기" 탭이 여기로 보냄).
//   - 늘 **내 방**에만 씀(남의 방 일기는 서버가 아예 안 줌). 저장하면 첫 화면으로 돌아감.
//   - 새 일기는 쓰는 중에 이 브라우저에 임시 저장(draft.js — 글만, 사진 파일은 못 남김), 저장하지 않고 떠나려 하면
//     한 번 물음.
import { getMyRoom } from '../shared/room.js';
import { fetchRecords, saveRecord, setRoom, uploadPhoto } from '../library/records.js';
import { createPhotoList } from './photos.js';
import { shrinkImage } from '../library/modal/shrinkImage.js';
import { clearDraft, countChars, diaryRecord, readDraft, todayIso, writeDraft } from './draft.js';

const $ = (id) => document.getElementById(id);
const paper = $('dPaper');
const fDate = $('dDate');
const fTitle = $('dTitle');
const fBody = $('dBody');
const saveBtn = $('dSave');
const statusEl = $('dStatus');
const errorEl = $('dError');
const countEl = $('dCount');

const editingId = Number(new URLSearchParams(location.search).get('id')) || null;
let dirty = false; // 열고 나서 고친 게 있는지(저장하지 않고 떠날 때 물음)
let saving = false;

const photos = createPhotoList({
  gridEl: $('dPhotoGrid'),
  input: $('dPhotoInput'),
  dropEl: $('dDrop'),
  noteEl: $('dPhotoNote'),
  onChange: () => { dirty = true; errorEl.hidden = true; },
});

// 본문 칸은 글이 늘면 같이 길어짐(페이지가 스크롤됨 — 칸 안에 스크롤이 생기지 않게).
function grow() {
  fBody.style.height = 'auto';
  fBody.style.height = `${fBody.scrollHeight}px`;
}

function paintCount() {
  countEl.textContent = `${countChars(fBody.value).toLocaleString()}자`;
}

let draftTimer;
function changed() {
  dirty = true;
  errorEl.hidden = true;
  paintCount();
  if (editingId) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    writeDraft({ title: fTitle.value, memo: fBody.value, date: fDate.value });
    statusEl.textContent = '임시 저장됨';
  }, 600);
}

[fTitle, fBody, fDate].forEach((el) => el.addEventListener('input', changed));
fBody.addEventListener('input', grow);
// 제목에서 Enter → 본문으로.
fTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); fBody.focus(); }
});

window.addEventListener('beforeunload', (e) => {
  if (!dirty || saving) return;
  e.preventDefault();
  e.returnValue = '';
});

function fail(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

async function save() {
  if (saveBtn.disabled) return;
  // 한글 마지막 글자 조합을 확정시키고 읽음(기록 창과 같은 이유 — modal.js handleSave).
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  await new Promise((r) => setTimeout(r, 0));
  if (!diaryRecord({ memo: fBody.value })) {
    fail('일기를 적어 주세요.');
    fBody.focus();
    return;
  }
  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중…';
  try {
    if (photos.count()) saveBtn.textContent = '사진 올리는 중…';
    const urls = await photos.uploadAll(async (file) => uploadPhoto(await shrinkImage(file)));
    await saveRecord(diaryRecord({ title: fTitle.value, memo: fBody.value, date: fDate.value, photos: urls }), editingId);
    if (!editingId) clearDraft();
    saving = true;
    location.href = './';
  } catch (err) {
    console.error(err);
    fail('저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    saveBtn.disabled = false;
    saveBtn.textContent = '저장';
  }
}
saveBtn.addEventListener('click', save);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
});

function ready() {
  paper.removeAttribute('aria-busy');
  saveBtn.disabled = false;
  paintCount();
  grow();
}

getMyRoom().then(async (mine) => {
  setRoom(mine.code, mine.token);
  fDate.value = todayIso();
  if (!editingId) {
    document.title = '일기 쓰기';
    const draft = readDraft();
    if (draft) {
      fTitle.value = draft.title || '';
      fBody.value = draft.memo || '';
      if (draft.date) fDate.value = draft.date;
      statusEl.textContent = '쓰던 일기를 불러왔어요';
    }
    ready();
    (fTitle.value ? fBody : fTitle).focus();
    return;
  }
  // 고치기 — 기록 하나만 주는 API는 없어서 목록에서 찾음(내 기록이라 토큰이 실려 일기도 옴).
  document.title = '일기 고치기';
  const list = await fetchRecords().catch(() => null);
  const rec = Array.isArray(list) ? list.find((r) => r.id === editingId && r.cat === 'diary') : null;
  if (!rec) {
    fail(list ? '이 일기를 찾지 못했어요.' : '일기를 불러오지 못했어요. 새로고침해 보세요.');
    paper.removeAttribute('aria-busy');
    return;
  }
  fDate.value = rec.date || todayIso();
  fTitle.value = rec.title || '';
  fBody.value = rec.memo || '';
  photos.setUrls(rec.photos && rec.photos.length ? rec.photos : (rec.photo_url ? [rec.photo_url] : []));
  ready();
  fBody.focus();
}).catch(() => fail('내 기록을 불러오지 못했어요. 새로고침해 보세요.'));
