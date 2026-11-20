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

// 보기 방식 — 'cards'(뒤집는 카드, 기본) · 'dense'(촘촘히) · 'list'(목록). 고른 건 이 브라우저에 기억함.
export const VIEWS = ['cards', 'dense', 'list'];
const VIEW_KEY = 'mysite:view';
function storedView() {
  try { const v = localStorage.getItem(VIEW_KEY); return VIEWS.includes(v) ? v : 'cards'; } catch (e) { return 'cards'; }
}

const EMPTY_ALL = '아직 기록이 없어요.';
const EMPTY_CAT = '아직 이 카테고리엔 기록이 없어요.';
const EMPTY_READONLY = '아직 기록이 없어요.';

// 지금 칩 오른쪽의 개수를 from에서 to까지 하나씩 올려 보임 — 기록이 덱에서 한 장씩 날아와
// 놓이는 속도(cardsView.js의 deal, 50ms 간격)에 맞춰 "세는 것처럼". 많으면 1초 안에 끝나게 간격을
// 줄임. 움직임 줄이기면 바로 최종 숫자.
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let countTimer = null;
export function countUp(el, from, to) {
  clearTimeout(countTimer);
  if (reduceMotion() || to <= from) { el.textContent = String(to); return; }
  const step = Math.max(16, Math.min(50, 1000 / (to - from)));
  let n = Math.max(from, 0);
  const tick = () => {
    n += 1;
    el.textContent = String(n);
    if (n < to) countTimer = setTimeout(tick, step);
  };
  tick(); // 첫 숫자(0에서 시작하면 1)는 바로 보임
}

// 인생작(황금 카드)이 앞에, 그다음은 기록한 날짜의 최신순(같은 날이면 나중에 남긴 것 먼저).
export function sortForGrid(list) {
  return list.slice().sort((a, b) =>
    (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
    || (b.date || '').localeCompare(a.date || '')
    || (b.id || 0) - (a.id || 0));
}

// 칩 — 전체 · 작품만 · 책 · 애니 · 영화·시리즈 · 음악 · 옷 · 일기(2026-11-20). "전체"는 옷·일기까지 날짜순으로
// 섞어서, "작품만"은 책·애니·영화·음악만. 남의 기록엔 옷·일기가 안 오니(백엔드가 뺌) 작품만·옷·일기 칩도 없음.
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

// onAdd(cat): 내 기록이 비어 있을 때 가운데 "+ 기록" 버튼을 누르면 — 새 기록 창을 엶.
export function createList({ onEdit, onDelete, onFeature, onListen, onLike, onTabChange, onAdd, readOnly, initialTab }) {
  const tabsEl = document.getElementById('tabs');
  const listEl = document.getElementById('list');

  const tabs = tabsFor(readOnly);
  let activeTab = tabs.some((c) => c.key === initialTab) ? initialTab : 'all';
  let currentItems = [];
  let shownIds = null; // 지금 격자에 있는 카드 id — 다시 그릴 때 새로 생긴 카드만 나눠주려고
  let shownCount = 0; // 지금 칩 오른쪽에 보이는 개수 — 기록이 늘거나 줄었을 때 거기서부터 셈
  let view = storedView();
  const cardDialog = createCardDialog({ onEdit, onDelete, onFeature, onListen, onLike, readOnly });

  // 칩 바꾸기 — 이 페이지의 칩을 누르거나, 상단 메뉴의 책·애니·영화·음악을 눌렀을 때
  // (main.js가 페이지를 다시 불러오지 않고 이걸 부름).
  function selectTab(key) {
    if (activeTab === key || !tabs.some((c) => c.key === key)) return;
    activeTab = key;
    // 새로고침하거나 주소를 공유해도 같은 칩이 열리게 주소에도 남김.
    const url = new URL(location.href);
    if (key === 'all') url.searchParams.delete('cat'); else url.searchParams.set('cat', key);
    history.replaceState(null, '', url);
    renderTabs();
    renderBody({ dealAll: true });
    if (onTabChange) onTabChange(key);
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    tabs.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.cat = t.key;
      if (t.private) btn.classList.add('private'); // 나만 보는 칩(css/cards.css — 작은 자물쇠)
      btn.setAttribute('aria-pressed', String(t.key === activeTab));
      btn.textContent = t.label;
      // 지금 칩에만 그 칩의 기록 개수(renderBody가 1부터 세며 채움).
      if (t.key === activeTab) btn.insertAdjacentHTML('beforeend', '<span class="chip-count" aria-hidden="true"></span>');
      btn.addEventListener('click', () => selectTab(t.key));
      tabsEl.appendChild(btn);
    });
  }

  // dealAll: 카드 전부를 덱에서 나눠줌(처음 열 때·칩을 바꿀 때). 아니면(추가/수정 뒤
  // 다시 그릴 때) 새로 생긴 카드만.
  function renderBody({ dealAll = false } = {}) {
    const list = sortForGrid(itemsForTab(currentItems, activeTab));
    const emptyText = readOnly ? EMPTY_READONLY : activeTab === 'all' ? EMPTY_ALL : EMPTY_CAT;
    listEl.dataset.view = view;
    // 촘촘히·목록은 덱에서 나눠주는 효과 없이 바로(수백 개를 한눈에 보는 게 목적이라).
    const slots = view === 'cards'
      ? renderCards(listEl, list, { onEdit, onDelete, onFeature, readOnly, onListen, onLike, emptyText })
      : (renderCompact(listEl, list, { view, emptyText, onOpen: cardDialog.open }), []);
    // 내 기록이 비어 있으면 안내 아래 가운데에 "+ 기록" 버튼(위 줄의 같은 버튼을 못 찾는 사람이 많아서).
    const emptyEl = listEl.querySelector('.empty');
    if (emptyEl && !readOnly && onAdd) {
      emptyEl.classList.add('empty-add');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'empty-add-btn';
      btn.textContent = '+ 기록';
      btn.addEventListener('click', () => onAdd(activeTab));
      emptyEl.appendChild(btn);
    }
    const before = shownIds;
    shownIds = new Set(list.map((i) => i.id));
    // 칩 개수: 처음 열 때·칩을 바꿀 때는 0부터(첫 숫자가 1), 추가/삭제 뒤엔 전에 보이던 숫자부터.
    const countEl = tabsEl.querySelector('.chip-count');
    if (countEl) countUp(countEl, dealAll || !before ? 0 : shownCount, list.length);
    shownCount = list.length;
    deal(dealAll || !before ? slots : slots.filter((s) => !before.has(Number(s.dataset.id)) && !before.has(s.dataset.id)));
  }

  return {
    // 보기 방식 바꾸기(위 줄의 전환 버튼) — 다시 그리고 기억함.
    view: () => view,
    setView(next) {
      if (!VIEWS.includes(next) || next === view) return;
      view = next;
      try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* 기억 못 해도 지금은 바뀜 */ }
      renderBody({ dealAll: true });
    },
    // 지금 보고 있는 칩('all' 또는 카테고리) — "+ 기록"의 기본 카테고리로 씀.
    activeTab: () => activeTab,
    selectTab,
    // 새로 받아온 items 배열로 칩+목록을 다시 그림. 서버에서 기록을
    // 새로 불러올 때마다(로드/추가/수정/삭제 후) main.js가 이 함수를 부름.
    render(items) {
      currentItems = items;
      renderTabs();
      renderBody();
    },
  };
}
