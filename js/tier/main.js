// 티어리스트 페이지(tier.html)의 시작점 — 기록 하나에 보드 하나, 위 칩으로 카테고리만 거름.
// 줄 배치 규칙은 board.js. 작품은 표지 아래 제목이 늘 보임(사용자 요청 — 표지만으론 뭔지 모를 때가 있고,
// 같은 앨범의 노래는 표지가 똑같아서).
//
// 내 기록이면 옮길 수 있음:
//   - 마우스: 끌어서 놓기(놓은 자리의 작품 앞에, 빈 곳이면 그 줄 맨 뒤)
//   - 손가락: 작품을 눌러 고른 뒤 옮길 줄(등급 칸이나 빈 곳)을 누름 — 끌기는 화면 스크롤과 겹쳐서.
// 옮길 때마다 바뀐 줄들을 서버에 저장(PUT .../tierlist). "별점순으로 초기화"는 지금 보이는 작품을
// 전부 자동 배치로 되돌림. 남의 기록이면 보기만.
import { initRoomNav } from '../shared/roomNav.js';
import { roomLink, roomTitle } from '../shared/room.js';
import { API_BASE } from '../shared/config.js';
import { escapeHtml, escapeAttr } from '../shared/dom.js';
import { photoSrc } from '../shared/photoSrc.js';
// 작품만 — 옷·일기는 티어리스트에 안 올림(별점이 없는 기록이라).
import { WORK_CATS as CATS, fetchRecords, isPrivateCat, setRoom } from '../library/records.js';
import { catIconHtml } from '../library/list/itemFormat.js';
import { TIERS, UNPLACED, buildRows, moveRecord } from './board.js';

const boardEl = document.getElementById('board');
const trayEl = document.getElementById('tray');
// 보드와 미배치 칸 둘 다에서 끌기·누르기를 받음.
const areas = [boardEl, trayEl];
const chipsEl = document.getElementById('tierChips');
const toolsEl = document.getElementById('tierTools');
const titleEl = document.getElementById('tierTitle');
const toastEl = document.getElementById('tierToast');
const navEl = document.querySelector('.site-nav');

let all = []; // 이 방의 기록 전부
let cat = new URLSearchParams(location.search).get('cat');
if (!CATS.some((c) => c.key === cat)) cat = 'all';
let rows = null; // 지금 보이는(거른) 기록의 줄 배치
let selectedId = null; // 손가락으로 고른 작품
// 한 줄에 작품이 많으면 처음엔 몇 개만(컴퓨터 2줄 ≈ 12개, 폰 3줄 = 6개) 보이고 "+N개 더 보기"로 펼침 —
// 수백 개가 되어도 보드가 한눈에 들어오게(사용자 결정). 펼친 줄은 다시 접을 수 있음.
const expanded = new Set();
const rowLimit = () => (typeof matchMedia === 'function' && matchMedia('(max-width:640px)').matches ? 6 : 12);
let readOnly = true;
let mine = null;

let toastTimer;
function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

const visible = () => (cat === 'all' ? all : all.filter((r) => r.cat === cat));

function itemHtml(r) {
  const cover = r.photo_url
    ? `<img src="${escapeAttr(photoSrc(r.photo_url))}" alt="" loading="lazy" crossorigin="anonymous">`
    : '<span class="t-noimg" aria-hidden="true"></span>';
  return `
    <div class="t-item${r.id === selectedId ? ' selected' : ''}" data-id="${r.id}" ${readOnly ? '' : 'draggable="true" tabindex="0" role="button"'} title="${escapeAttr(r.title)}">
      <div class="t-cover">${cover}${catIconHtml(r.cat)}</div>
      <div class="t-title">${escapeHtml(r.title)}</div>
    </div>`;
}

// 한 줄의 작품들 — 미배치 칸(옆에 붙어 따로 스크롤)은 다 보여 주고, 보드 줄은 접어서.
function itemsHtml(key) {
  const list = rows[key];
  if (!list.length) return key === UNPLACED && !readOnly ? '<span class="t-empty">별점이 없거나 아직 놓지 않은 작품이 여기 와요</span>' : '';
  const limit = rowLimit();
  if (key === UNPLACED || list.length <= limit) return list.map(itemHtml).join('');
  if (expanded.has(key)) return list.map(itemHtml).join('') + `<button type="button" class="t-more" data-more="${key}">접기</button>`;
  return list.slice(0, limit).map(itemHtml).join('') + `<button type="button" class="t-more" data-more="${key}">+${list.length - limit}개 더 보기</button>`;
}

function render() {
  rows = buildRows(visible());
  const rowHtml = (key, label, color) => `
    <section class="t-row${key === UNPLACED ? ' unplaced' : ''}" data-tier="${key}">
      <div class="t-label" style="${color ? `--tier:${color}` : ''}">${label}</div>
      <div class="t-items">${itemsHtml(key)}</div>
    </section>`;
  boardEl.innerHTML = TIERS.map((t) => rowHtml(t.key, t.key, t.color)).join('');
  trayEl.innerHTML = rowHtml(UNPLACED, `미배치 <span class="n">${rows[UNPLACED].length}</span>`, null);
  areas.forEach((el) => el.classList.toggle('editable', !readOnly));
}

function renderChips() {
  const chips = [{ key: 'all', label: '전체' }, ...CATS];
  chipsEl.innerHTML = chips.map((c) => {
    const n = c.key === 'all' ? all.length : all.filter((r) => r.cat === c.key).length;
    return `<button type="button" class="chip" data-cat="${c.key}" aria-pressed="${c.key === cat}">${c.label}${n ? ` <span class="n">${n}</span>` : ''}</button>`;
  }).join('');
}
chipsEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b || b.dataset.cat === cat) return;
  cat = b.dataset.cat;
  selectedId = null;
  const url = new URL(location.href);
  if (cat === 'all') url.searchParams.delete('cat'); else url.searchParams.set('cat', cat);
  history.replaceState(null, '', url);
  renderChips();
  render();
});

// ---- 저장 ----
function save(placements) {
  if (!placements.length) return Promise.resolve();
  return fetch(`${API_BASE}/api/rooms/${encodeURIComponent(mine.code)}/tierlist`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Room-Token': mine.token },
    body: JSON.stringify({ items: placements }),
  }).then((res) => { if (!res.ok) throw new Error('tierlist save failed'); });
}

function move(id, toKey, beforeId = null) {
  if (beforeId === id) return;
  const res = moveRecord(rows, id, toKey, beforeId);
  if (!res.placements.length) return;
  // 화면부터 바꾸고(바로 반응하게) 저장 — 실패하면 서버 값으로 되돌림.
  const byId = new Map(res.placements.map((p) => [p.id, p]));
  all = all.map((r) => (byId.has(r.id) ? { ...r, tier: byId.get(r.id).tier, tier_pos: byId.get(r.id).pos } : r));
  selectedId = null;
  render();
  save(res.placements).catch(() => { toast('저장하지 못했어요. 다시 불러올게요.'); load(); });
}

// ---- 마우스: 끌어서 놓기 ----
let dragId = null;
function dropTarget(e) {
  const row = e.target.closest('.t-row');
  if (!row) return null;
  const item = e.target.closest('.t-item');
  let beforeId = null;
  if (item) {
    const b = item.getBoundingClientRect();
    // 작품의 오른쪽 절반에 놓으면 그 뒤로 — 바로 다음 작품 앞에.
    const after = e.clientX > b.left + b.width / 2;
    const ref = after ? item.nextElementSibling : item;
    beforeId = ref && ref.dataset.id ? Number(ref.dataset.id) : null;
  }
  return { row, toKey: row.dataset.tier, beforeId };
}
areas.forEach((area) => area.addEventListener('dragstart', (e) => {
  const item = e.target.closest('.t-item');
  if (readOnly || !item) return;
  dragId = Number(item.dataset.id);
  item.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(dragId));
}));
const clearDropMarks = () => document.querySelectorAll('.dragging, .drop-on').forEach((el) => el.classList.remove('dragging', 'drop-on'));
document.addEventListener('dragend', () => { dragId = null; clearDropMarks(); stopAutoScroll(); });
areas.forEach((area) => area.addEventListener('dragover', (e) => {
  if (dragId == null) return;
  const t = dropTarget(e);
  if (!t) return;
  e.preventDefault();
  document.querySelectorAll('.drop-on').forEach((el) => { if (el !== t.row) el.classList.remove('drop-on'); });
  t.row.classList.add('drop-on');
}));

// 끄는 중 화면 위·아래 끝(EDGE px 안)에 가면 저절로 스크롤 — 보드가 화면보다 길 때도 끝까지 옮길 수 있게.
const EDGE = 90;
let scrollSpeed = 0;
let scrollFrame = 0;
function stopAutoScroll() { scrollSpeed = 0; cancelAnimationFrame(scrollFrame); scrollFrame = 0; }
document.addEventListener('dragover', (e) => {
  if (dragId == null) return;
  const y = e.clientY;
  scrollSpeed = y < EDGE ? -Math.ceil((EDGE - y) / 6) : y > innerHeight - EDGE ? Math.ceil((y - (innerHeight - EDGE)) / 6) : 0;
  if (scrollSpeed && !scrollFrame) {
    const step = () => {
      if (!scrollSpeed || dragId == null) { scrollFrame = 0; return; }
      window.scrollBy(0, scrollSpeed);
      scrollFrame = requestAnimationFrame(step);
    };
    scrollFrame = requestAnimationFrame(step);
  }
});
areas.forEach((area) => area.addEventListener('drop', (e) => {
  if (dragId == null) return;
  const t = dropTarget(e);
  if (!t) return;
  e.preventDefault();
  const id = dragId;
  dragId = null;
  stopAutoScroll();
  move(id, t.toKey, t.beforeId);
}));

// ---- 손가락(그리고 키보드): 고른 뒤 줄을 누르기 ----
areas.forEach((area) => area.addEventListener('click', (e) => {
  const more = e.target.closest('[data-more]');
  if (more) {
    const key = more.dataset.more;
    if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
    render();
    return;
  }
  if (readOnly) return;
  const item = e.target.closest('.t-item');
  if (item) {
    const id = Number(item.dataset.id);
    selectedId = selectedId === id ? null : id;
    document.querySelectorAll('.t-item.selected').forEach((el) => el.classList.remove('selected'));
    if (selectedId != null) { item.classList.add('selected'); toast('옮길 줄을 누르세요'); }
    return;
  }
  const row = e.target.closest('.t-row');
  if (row && selectedId != null) move(selectedId, row.dataset.tier);
}));
areas.forEach((area) => area.addEventListener('keydown', (e) => {
  if (readOnly || (e.key !== 'Enter' && e.key !== ' ')) return;
  const item = e.target.closest('.t-item');
  if (!item) return;
  e.preventDefault();
  item.click();
}));

// ---- 별점순으로 초기화 ----
function renderTools() {
  if (readOnly) { toolsEl.innerHTML = ''; return; }
  toolsEl.innerHTML = `
    <span class="t-hint">끌어서 옮기거나, 작품을 누른 뒤 옮길 줄을 누르세요.</span>
    <button type="button" class="t-reset">별점순으로 초기화</button>`;
  toolsEl.querySelector('.t-reset').addEventListener('click', () => {
    const list = visible().filter((r) => r.tier != null);
    if (!list.length) { toast('이미 별점순으로 놓여 있어요'); return; }
    if (!confirm(`직접 옮긴 ${list.length}개를 별점순으로 초기화할까요?`)) return;
    save(list.map((r) => ({ id: r.id, tier: null, pos: null })))
      .then(() => { toast('별점순으로 초기화했어요'); return load(); })
      .catch(() => toast('저장하지 못했어요'));
  });
}

function load() {
  return fetchRecords()
    .then((items) => { all = items.filter((r) => !isPrivateCat(r.cat)); renderChips(); render(); })
    .catch(() => { boardEl.innerHTML = '<div class="empty">기록을 불러오지 못했어요. 새로고침해 보세요.</div>'; });
}

initRoomNav({ navEl, currentPage: 'tier' }).then((ctx) => {
  mine = ctx.mine;
  readOnly = ctx.readOnly;
  setRoom(ctx.viewingCode, readOnly ? null : mine.token);
  document.body.classList.toggle('read-only', readOnly);
  document.getElementById('tierBack').href = roomLink('./', ctx.viewingCode, mine.code);
  renderTools();
  if (readOnly) {
    fetch(`${API_BASE}/api/rooms/${encodeURIComponent(ctx.viewingCode)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => { if (info) titleEl.textContent = `${roomTitle(info.name)}의 티어리스트`.replace('기록의 티어리스트', '티어리스트'); })
      .catch(() => {});
  }
  return load();
});
