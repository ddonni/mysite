// 화면 위쪽의 카테고리 탭(전체/책/애니/영화/음악)과, 그 아래 인생작 줄 +
// 표지 카드 격자를 그리는 모듈. "지금 어느 탭인지"만 상태로 들고, 카드를
// 어떻게 그리는지는 list/cardsView.js, 카드를 눌렀을 때 뜨는 상세 창은
// list/detail.js에 맡김.
//
// "기록을 어떻게 서버와 주고받는지"는 모르고, 건네받은 items 배열을 화면에
// 뿌리기만 함. 상세 창의 "수정하기"/"삭제"/"인생작"을 눌렀을 때 실제로 무슨
// 일이 일어날지는 createList를 부른 쪽(main.js)이 onEdit/onDelete/onFeature
// 콜백으로 정해줌.
import { CATS } from './records.js';
import { renderCards } from './list/cardsView.js';
import { createDetail } from './list/detail.js';
import { featureLabel, withEuro } from './list/itemFormat.js';
import { TOP_SLOTS, SHELF_CATS, SHELF_FEATURED, pickMusic } from '../lobby/showcase.js';

const EMPTY_ALL = '아직 기록이 없어요. 오른쪽 위 + 기록하기에서 본 작품을 찾아 한꺼번에 넣어 보세요.';
const EMPTY_CAT = '아직 이 카테고리엔 기록이 없어요. 오른쪽 위 + 기록하기로 남겨보세요.';
const EMPTY_READONLY = '아직 기록이 없어요.';
const EMPTY_WARDROBE = '아직 옷장이 비어 있어요. 오른쪽 위 + 기록하기로 가진 옷을 하나씩 넣어 보세요.';
const EMPTY_WARDROBE_READONLY = '보여 줄 옷이 없어요.';

// "전체" 탭은 감상 기록(책·애니·영화·음악)만 — 옷장은 성격이 달라서 자기 탭에서만 보임.
const inAll = (it) => it.cat !== 'wardrobe';

export function createList({ onEdit, onDelete, onFeature, onPlay, onListen, onTabChange, readOnly, initialTab }) {
  const tabsEl = document.getElementById('tabs');
  const listEl = document.getElementById('list');
  const featuredEl = document.getElementById('featured');
  const featuredGrid = document.getElementById('featuredGrid');
  const featuredTitle = document.getElementById('featuredTitle');
  const allTitle = document.getElementById('allTitle');
  const detail = createDetail(document.getElementById('detailDialog'), { onEdit, onDelete, onFeature, onPlay, onListen, readOnly });

  let activeTab = CATS.some((c) => c.key === initialTab) ? initialTab : 'all';
  let currentItems = [];
  let playingId = null; // 방의 턴테이블에서 도는 곡 — 그 카드에 "턴테이블 위" 표시
  const openDetail = (it) => detail.open(it, { playing: it.id === playingId });

  // 탭 바꾸기 — 이 페이지의 탭을 누르거나, 상단 메뉴의 책·애니·영화·음악을 눌렀을 때
  // (main.js가 페이지를 다시 불러오지 않고 이걸 부름).
  function selectTab(key) {
    if (activeTab === key || !(key === 'all' || CATS.some((c) => c.key === key))) return;
    activeTab = key;
    // 새로고침하거나 주소를 공유해도 같은 탭이 열리게 주소에도 남김.
    const url = new URL(location.href);
    if (key === 'all') url.searchParams.delete('cat'); else url.searchParams.set('cat', key);
    history.replaceState(null, '', url);
    renderTabs();
    renderBody();
    if (onTabChange) onTabChange(key);
  }

  function renderTabs() {
    const all = [{ key: 'all', label: '전체' }, ...CATS];
    tabsEl.innerHTML = '';
    all.forEach((t) => {
      const count = t.key === 'all' ? currentItems.filter(inAll).length : currentItems.filter((i) => i.cat === t.key).length;
      // 남의 방에서 옷장이 안 보이면(비공개거나 비었으면) 탭도 숨김.
      if (t.key === 'wardrobe' && readOnly && count === 0 && activeTab !== 'wardrobe') return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.dataset.cat = t.key;
      btn.setAttribute('aria-pressed', String(t.key === activeTab));
      btn.innerHTML = `${t.key === 'all' ? '' : '<i class="dot"></i>'}${t.label}<span class="n">${count}</span>`;
      btn.addEventListener('click', () => selectTab(t.key));
      tabsEl.appendChild(btn);
    });
  }

  // 맨 위 인생작 줄 — 로비에 걸리는 것과 같은 것들.
  //  - 전체 탭: 책·애니·영화 인생작 전부(책장 위 액자, 셋 합쳐 SHELF_FEATURED개).
  //  - 책·애니·영화 탭: 그 카테고리의 인생작(개수 제한은 셋 합쳐서라 탭마다 다름).
  //  - 음악·옷장 탭: 최애 TOP_SLOTS개.
  // 내 방이면 남는 자리에 "여기에 더 걸 수 있다"는 빈칸 하나(음악·옷장은 남는 자리 전부).
  function renderFeatured(list) {
    const shelfCat = activeTab === 'all' || SHELF_CATS.includes(activeTab);
    if (list.length === 0) { featuredEl.hidden = true; return; }
    // 전체 탭엔 음악도 섞여 있지만, 인생작 줄은 책장 위 액자와 같게 책·애니·영화만.
    const featured = list.filter((i) => i.featured && (activeTab !== 'all' || SHELF_CATS.includes(i.cat)))
      .slice(0, shelfCat ? SHELF_FEATURED : TOP_SLOTS);
    if (featured.length === 0 && readOnly) { featuredEl.hidden = true; return; }
    featuredEl.hidden = false;
    featuredTitle.textContent = activeTab === 'all' ? '인생작' : featureLabel(activeTab);
    // 내 방의 최애음악 줄에선 카드마다 "턴테이블에 올리기"로 바로 턴테이블에 올릴 수 있음.
    const onPlayCard = activeTab === 'music' && !readOnly ? (it) => onPlay(it, true) : undefined;
    renderCards(featuredGrid, featured, { onOpen: openDetail, showCat: activeTab === 'all', emptyText: '', playingId, onPlay: onPlayCard });
    if (readOnly) return;
    const shelfFeatured = currentItems.filter((i) => i.featured && SHELF_CATS.includes(i.cat)).length;
    const free = shelfCat ? Math.min(1, SHELF_FEATURED - shelfFeatured) : TOP_SLOTS - featured.length;
    const label = activeTab === 'all' ? '인생작' : featureLabel(activeTab);
    const where = shelfCat ? '책장 위에' : '여기';
    for (let i = 0; i < free; i++) {
      const slot = document.createElement('div');
      slot.className = 'card slot';
      slot.innerHTML = `<div class="cover slot-cover"><span>기록을 눌러<br>"${withEuro(label)}"를<br>고르면 ${where} 걸려요</span></div>`;
      featuredGrid.appendChild(slot);
    }
  }

  function renderBody() {
    document.getElementById('totalCount').textContent = currentItems.length;
    const list = (activeTab === 'all' ? currentItems.filter(inAll) : currentItems.filter((i) => i.cat === activeTab))
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    renderFeatured(list);
    const cat = CATS.find((c) => c.key === activeTab);
    allTitle.textContent = cat ? `모든 ${cat.key === 'wardrobe' ? '옷' : cat.label}` : '';
    allTitle.hidden = featuredEl.hidden;
    renderCards(listEl, list, {
      onOpen: openDetail,
      playingId,
      showCat: activeTab === 'all',
      emptyText: activeTab === 'wardrobe' ? (readOnly ? EMPTY_WARDROBE_READONLY : EMPTY_WARDROBE)
        : readOnly ? EMPTY_READONLY : activeTab === 'all' ? EMPTY_ALL : EMPTY_CAT,
    });
  }

  return {
    // 로비 책장에서 물건을 눌러 왔을 때(library?open=id) 그 기록의 상세 창을 엶.
    openById(id) {
      const it = currentItems.find((i) => String(i.id) === String(id));
      if (it) openDetail(it);
    },
    // 지금 보고 있는 탭('all' 또는 카테고리) — "+ 기록하기"의 기본 카테고리로 씀.
    activeTab: () => activeTab,
    selectTab,
    // 새로 받아온 items 배열로 탭+목록을 다시 그림. 서버에서 기록을
    // 새로 불러올 때마다(로드/추가/수정/삭제 후) main.js가 이 함수를 부름.
    render(items) {
      currentItems = items;
      const { playing } = pickMusic(items);
      playingId = playing ? playing.id : null;
      renderTabs();
      renderBody();
    },
  };
}
