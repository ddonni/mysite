// 화면 위쪽의 카테고리 칩(전체/책/애니/영화/음악)과 그 아래 카드 격자를 그리는 모듈.
// "지금 어느 칩인지"만 상태로 들고, 카드를 어떻게 그리는지(뒷면의 수정·삭제·인생작 버튼 포함)는
// list/cardsView.js에 맡김.
//
// "기록을 어떻게 서버와 주고받는지"는 모르고, 건네받은 items 배열을 화면에
// 뿌리기만 함. 뒷면의 "수정"/"삭제"/인생작 별을 눌렀을 때 실제로 무슨
// 일이 일어날지는 createList를 부른 쪽(main.js)이 onEdit/onDelete/onFeature
// 콜백으로 정해줌.
import { CATS, WORK_CATS, isPrivateCat } from './records.js';
import { renderCards, deal } from './list/cardsView.js';
import { renderCompact, createCardDialog } from './list/compactViews.js';
import { renderRoom } from './list/roomView.js';
import { droppedNote, openNoteDraft } from './quickNote.js';

// 보기 방식 — 'cards'(뒤집는 카드, 기본) · 'dense'(촘촘히) · 'list'(목록). 고른 건 이 브라우저에 기억함.
export const VIEWS = ['cards', 'dense', 'list'];
const VIEW_KEY = 'mysite:view';
function storedView() {
  try { const v = localStorage.getItem(VIEW_KEY); return VIEWS.includes(v) ? v : 'cards'; } catch (e) { return 'cards'; }
}

const EMPTY_ALL = '아직 기록이 없어요.';
const EMPTY_CAT = '아직 이 카테고리엔 기록이 없어요.';
const EMPTY_READONLY = '아직 기록이 없어요.';
const EMPTY_NOTE = '아직 비어 있어요. 글 한 줄이든 유튜브 링크든 아무거나 넣어 보세요.';

// 칩 — 전체 · 작품만 · 책 · 애니 · 영화·시리즈 · 음악 · ?!(2026-11-26). "전체"는 ?!까지 날짜순으로
// 섞고, "작품만"은 책·애니·영화·음악만. 남의 기록엔 ?!가 안 오니(백엔드가 뺌) 작품만·?! 칩도 없음.
export const WORKS_TAB = 'works';
export function tabsFor(readOnly) {
  if (readOnly) return [{ key: 'all', label: '전체' }, ...WORK_CATS];
  return [{ key: 'all', label: '전체' }, { key: WORKS_TAB, label: '작품만' }, ...CATS];
}
export function itemsForTab(items, tab) {
  if (tab === 'all') return items;
  if (tab === WORKS_TAB) return items.filter((i) => !isPrivateCat(i.cat));
  return items.filter((i) => i.cat === tab);
}

// 카드 순서는 무작위(2026-11-26 사용자 요청 — 날짜순 기록장이 아니라 취향을 모아 둔 방이라). 페이지를 열 때마다
// 새로 섞이고, 연 동안은 그대로(seed — 칩·보기를 바꾸거나 기록을 고쳐도 자리가 안 뒤바뀜). 이번에 연 뒤 새로 넣은
// 것(known에 없는 id)은 맨 앞에 최신순 — 방금 넣은 게 어디 갔는지 찾지 않게.
function mix(n) { // 32비트 정수 섞기(같은 입력이면 늘 같은 값)
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}
export function shuffleForGrid(list, seed, known = null) {
  const isNew = (it) => known && !known.has(it.id);
  return list.slice().sort((a, b) =>
    (isNew(b) ? 1 : 0) - (isNew(a) ? 1 : 0)
    || (isNew(a) ? (b.id || 0) - (a.id || 0) : mix((a.id || 0) ^ seed) - mix((b.id || 0) ^ seed))
    || (a.id || 0) - (b.id || 0));
}

// 격자 맨 앞의 "+"(2026-11-26 사용자 제안 — 위 줄 버튼을 못 찾는 사람이 많고, "아직 안 채운 카드"처럼 보이게).
// 이게 기록을 넣는 유일한 자리라 위 줄의 "+ 기록" 버튼은 없앰. 보기마다 모양만 다름: 카드 = 점선 빈 카드,
// 촘촘히 = 맨 앞 작은 점선 칸, 목록 = 맨 위 점선 줄. 내 기록이 비어 있어도 안내 글 대신 이것만. 칩에 따라: 전체는 위아래 두 칸(작품 기록 / ?!), ?! 칩은 "+ ?!",
// 카테고리 칩은 "+ 책"처럼, 작품만은 "+ 기록". 버튼마다 data-add = onAdd에 넘길 칩 키.
export function addCardChoices(tab) {
  if (tab === 'all') return [{ add: 'all', label: '작품 기록' }, { add: 'note', label: '?!' }];
  if (tab === WORKS_TAB) return [{ add: 'all', label: '기록' }];
  const cat = CATS.find((c) => c.key === tab);
  return [{ add: tab, label: cat ? cat.label : '기록' }];
}
// "?!"를 누르면 창 없이 그 칸이 입력 칸으로(quickNote.openNoteDraft), 작품은 onAdd(새 기록 창).
function addCardEl(tab, { onAdd, onNote }, view) {
  const choices = addCardChoices(tab);
  const slot = document.createElement('div');
  slot.className = `add-slot add-${view}` + (view === 'cards' ? ' slot' : '');
  slot.innerHTML = `<div class="add-card${choices.length > 1 ? ' split' : ''}">${choices.map((c) =>
    `<button type="button" data-add="${c.add}"${c.add === 'note' ? ' class="note"' : ''}><span class="plus" aria-hidden="true">+</span><span class="add-label">${c.label}</span></button>`).join('')}</div>`;
  slot.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.add === 'note') onNote(slot); else onAdd(b.dataset.add);
  }));
  // "+ ?!"에 사진(또는 글·링크)을 끌어다 놓으면 입력 칸이 열리면서 바로 붙음(2026-11-26 사용자 요청).
  const noteBtn = slot.querySelector('[data-add="note"]');
  if (noteBtn) {
    const over = (on) => noteBtn.classList.toggle('drop-ready', on);
    noteBtn.addEventListener('dragover', (e) => { e.preventDefault(); over(true); });
    noteBtn.addEventListener('dragleave', () => over(false));
    noteBtn.addEventListener('drop', (e) => {
      e.preventDefault();
      over(false);
      const dropped = droppedNote(e.dataTransfer);
      if (dropped) onNote(slot, dropped);
    });
  }
  return slot;
}

// onAdd(cat): 맨 앞 "+"의 작품 기록 — 새 기록 창을 엶.
// onSaveNote(it|null, parts) → Promise: ?! 저장(null이면 새로) — 맨 앞 칸의 입력 칸·카드 뒷면에서 고치기가 씀.
export function createList({ onEdit, onDelete, onFeature, onListen, onLike, onTabChange, onAdd, onSaveNote, readOnly, initialTab, initialView }) {
  const tabsEl = document.getElementById('tabs');
  const listEl = document.getElementById('list');

  const tabs = tabsFor(readOnly);
  let activeTab = tabs.some((c) => c.key === initialTab) ? initialTab : 'all';
  let currentItems = [];
  let shownIds = null; // 지금 격자에 있는 카드 id — 다시 그릴 때 새로 생긴 카드만 나눠주려고
  const seed = Math.floor(Math.random() * 0x7fffffff); // 카드 순서 섞기(shuffleForGrid) — 페이지를 열 때마다 새로
  let knownIds = null; // 처음 받은 기록의 id들 — 그 뒤에 넣은 건 맨 앞에
  // initialView: 'room'(내 방) 또는 'cards'(편집) — main.js. 안 주면 마지막으로 고른 카드·촘촘히·목록.
  let view = initialView === 'room' || initialView === 'cards' ? initialView : storedView();
  // 내 방은 화면 크기에 맞춰 그려서, 창 크기가 바뀌면 다시(한 프레임에 한 번).
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    if (view !== 'room') return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => renderBody());
  });
  const cardDialog = createCardDialog({ onEdit, onDelete, onFeature, onListen, onLike, onSaveNote, readOnly });
  // 맨 앞 칸 → 입력 칸. 취소하면 그 칸만 원래 "+"로(목록 전체를 다시 그리지 않음 — 덱 효과가 다시 안 나게).
  const onNote = (slot, dropped = {}) => openNoteDraft(slot, {
    ...dropped,
    onSave: (parts) => onSaveNote(null, parts),
    onClose: () => slot.replaceWith(addCardEl(activeTab, { onAdd, onNote }, view)),
  });

  // 칩 바꾸기 — 이 페이지의 칩을 누르거나, 상단 메뉴의 책·애니·영화·음악을 눌렀을 때
  // (main.js가 페이지를 다시 불러오지 않고 이걸 부름).
  // 내 방에서 누르면(지금 칩이어도) 카드 보기로 — 방은 칩과 따로라서(사용자 요청).
  function selectTab(key) {
    if (!tabs.some((c) => c.key === key)) return;
    const leavingRoom = view === 'room';
    if (activeTab === key && !leavingRoom) return;
    if (leavingRoom) view = 'cards';
    activeTab = key;
    // 새로고침하거나 주소를 공유해도 같은 칩이 열리게 주소에도 남김.
    const url = new URL(location.href);
    if (key === 'all') url.searchParams.delete('cat'); else url.searchParams.set('cat', key);
    history.replaceState(null, '', url);
    renderTabs();
    // 칩을 바꿀 땐 덱에서 나눠주는 효과 없이 바로(사용자 요청) — 처음 열 때·새로 넣은 카드만 날아옴.
    renderBody({ dealAll: true, animate: false });
    if (onTabChange) onTabChange(key);
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    tabs.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.cat = t.key;
      if (t.private) { btn.classList.add('private'); btn.title = '나만 볼 수 있어요'; } // 작은 자물쇠(css/notes.css)
      // 내 방에선 어느 칩도 안 눌린 모양(방은 칩과 따로 — 모든 작품을 보여 줌).
      const on = view !== 'room' && t.key === activeTab;
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = t.label;
      // 지금 칩에만 그 칩의 기록 개수(renderBody가 채움).
      if (on) btn.insertAdjacentHTML('beforeend', '<span class="chip-count" aria-hidden="true"></span>');
      btn.addEventListener('click', () => selectTab(t.key));
      tabsEl.appendChild(btn);
    });
  }

  // dealAll: 카드 전부를 덱에서 나눠줌(처음 열 때·칩을 바꿀 때). 아니면(추가/수정 뒤
  // 다시 그릴 때) 새로 생긴 카드만.
  function renderBody({ dealAll = false, animate = true } = {}) {
    const list = shuffleForGrid(itemsForTab(currentItems, activeTab), seed, knownIds);
    const emptyText = readOnly ? EMPTY_READONLY
      : activeTab === 'all' || activeTab === WORKS_TAB ? EMPTY_ALL : activeTab === 'note' ? EMPTY_NOTE : EMPTY_CAT;
    listEl.dataset.view = view;
    // 내 방은 칩과 따로 — 어느 칩이었든 모든 작품(책·애니·영화, roomView.js가 음악·?!를 뺌)을 벽에.
    if (view === 'room') {
      renderRoom(listEl, shuffleForGrid(currentItems, seed, knownIds), { onOpen: (it, order) => cardDialog.open(it, { front: true, list: order }) });
      shownIds = null; // 방에서 나올 땐 카드를 처음부터 나눠줌
      return;
    }
    // 촘촘히·목록은 덱에서 나눠주는 효과 없이 바로(수백 개를 한눈에 보는 게 목적이라).
    const slots = view === 'cards'
      ? renderCards(listEl, list, { onEdit, onDelete, onFeature, readOnly, onListen, onLike, onSaveNote, emptyText, onExpand: cardDialog.open })
      : (renderCompact(listEl, list, { view, emptyText, onOpen: cardDialog.open }), []);
    // 내 기록이면 격자 맨 앞에 "+"(addCardEl) — 비어 있어도 안내 글 대신 이것만(사용자 요청).
    if (!readOnly && onAdd) {
      const emptyEl = listEl.querySelector('.empty');
      if (emptyEl) emptyEl.remove();
      listEl.prepend(addCardEl(activeTab, { onAdd, onNote }, view));
    }
    const before = shownIds;
    shownIds = new Set(list.map((i) => i.id));
    const countEl = tabsEl.querySelector('.chip-count');
    // 개수는 바로 최종 숫자(1부터 세며 올라가던 효과는 사용자 요청으로 뺌).
    if (countEl) countEl.textContent = String(list.length);
    if (animate) deal(dealAll || !before ? slots : slots.filter((s) => !before.has(Number(s.dataset.id)) && !before.has(s.dataset.id)));
  }

  return {
    // 보기 방식 바꾸기(위 줄의 전환 버튼) — 다시 그리고 기억함.
    view: () => view,
    // 'room'(내 방)은 기억하지 않음 — 첫 화면은 늘 카드 쪽(사용자: "메인은 아직 카드 보기").
    setView(next) {
      if (!(VIEWS.includes(next) || next === 'room') || next === view) return;
      view = next;
      if (view !== 'room') {
        try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* 기억 못 해도 지금은 바뀜 */ }
      }
      renderTabs(); // 방에선 칩이 안 눌린 모양, 나오면 다시
      renderBody({ dealAll: true });
    },
    // 지금 보고 있는 칩('all' · 'works' 또는 카테고리) — "+ 기록"의 기본 카테고리로 씀.
    activeTab: () => activeTab,
    selectTab,
    // 새로 받아온 items 배열로 칩+목록을 다시 그림. 서버에서 기록을
    // 새로 불러올 때마다(로드/추가/수정/삭제 후) main.js가 이 함수를 부름.
    render(items) {
      currentItems = items;
      if (!knownIds) knownIds = new Set(items.map((i) => i.id)); // 처음 받은 기록 — 그 뒤에 생긴 건 맨 앞
      renderTabs();
      renderBody();
    },
  };
}
