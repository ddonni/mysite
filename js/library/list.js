// 화면 위쪽의 카테고리 칩(전체/책/애니/영화/음악)과 그 아래 카드 격자를 그리는 모듈.
// "지금 어느 칩인지"만 상태로 들고, 카드를 어떻게 그리는지는 list/cardsView.js,
// 카드 뒷면의 "자세히"를 눌렀을 때 뜨는 상세 창은 list/detail.js에 맡김.
//
// "기록을 어떻게 서버와 주고받는지"는 모르고, 건네받은 items 배열을 화면에
// 뿌리기만 함. 상세 창의 "수정하기"/"삭제"/"인생작"을 눌렀을 때 실제로 무슨
// 일이 일어날지는 createList를 부른 쪽(main.js)이 onEdit/onDelete/onFeature
// 콜백으로 정해줌.
import { CATS } from './records.js';
import { renderCards, deal } from './list/cardsView.js';
import { createDetail } from './list/detail.js';

const EMPTY_ALL = '아직 기록이 없어요.';
const EMPTY_CAT = '아직 이 카테고리엔 기록이 없어요.';
const EMPTY_READONLY = '아직 기록이 없어요.';

// 인생작(황금 카드)이 앞에, 그다음은 최신순.
export function sortForGrid(list) {
  return list.slice().sort((a, b) =>
    (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.date || '').localeCompare(a.date || ''));
}

// onAdd(cat): 내 기록이 비어 있을 때 가운데 "+ 기록" 버튼을 누르면 — 새 기록 창을 엶.
export function createList({ onEdit, onDelete, onFeature, onListen, onTabChange, onAdd, readOnly, initialTab }) {
  const tabsEl = document.getElementById('tabs');
  const listEl = document.getElementById('list');
  const detail = createDetail(document.getElementById('detailDialog'), { onEdit, onDelete, onFeature, onListen, readOnly });

  let activeTab = CATS.some((c) => c.key === initialTab) ? initialTab : 'all';
  let currentItems = [];
  let shownIds = null; // 지금 격자에 있는 카드 id — 다시 그릴 때 새로 생긴 카드만 나눠주려고
  const openDetail = (it) => detail.open(it);

  // 칩 바꾸기 — 이 페이지의 칩을 누르거나, 상단 메뉴의 책·애니·영화·음악을 눌렀을 때
  // (main.js가 페이지를 다시 불러오지 않고 이걸 부름).
  function selectTab(key) {
    if (activeTab === key || !(key === 'all' || CATS.some((c) => c.key === key))) return;
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
    const all = [{ key: 'all', label: '전체' }, ...CATS];
    tabsEl.innerHTML = '';
    all.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.cat = t.key;
      btn.setAttribute('aria-pressed', String(t.key === activeTab));
      btn.textContent = t.label;
      btn.addEventListener('click', () => selectTab(t.key));
      tabsEl.appendChild(btn);
    });
  }

  // dealAll: 카드 전부를 덱에서 나눠줌(처음 열 때·칩을 바꿀 때). 아니면(추가/수정 뒤
  // 다시 그릴 때) 새로 생긴 카드만.
  function renderBody({ dealAll = false } = {}) {
    const list = sortForGrid(activeTab === 'all' ? currentItems : currentItems.filter((i) => i.cat === activeTab));
    const slots = renderCards(listEl, list, {
      onOpen: openDetail,
      onListen,
      emptyText: readOnly ? EMPTY_READONLY : activeTab === 'all' ? EMPTY_ALL : EMPTY_CAT,
    });
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
    deal(dealAll || !before ? slots : slots.filter((s) => !before.has(Number(s.dataset.id)) && !before.has(s.dataset.id)));
  }

  return {
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
