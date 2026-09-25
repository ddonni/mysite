// 화면 위쪽의 카테고리 탭(전체/책/애니/영화/음악)과, 그 아래 인생작 줄 +
// 표지 카드 격자를 그리는 모듈. "지금 어느 탭인지"만 상태로 들고, 카드를
// 어떻게 그리는지는 list/cardsView.js, 카드를 눌렀을 때 뜨는 상세 창은
// list/detail.js에 맡김.
//
// "기록을 어떻게 서버와 주고받는지"는 모르고, 건네받은 items 배열을 화면에
// 뿌리기만 함. 상세 창의 "고쳐 쓰기"/"삭제"/"인생작"을 눌렀을 때 실제로 무슨
// 일이 일어날지는 createList를 부른 쪽(main.js)이 onEdit/onDelete/onFeature
// 콜백으로 정해줌.
import { CATS } from './records.js';
import { renderCards } from './list/cardsView.js';
import { createDetail } from './list/detail.js';
import { featureLabel, withEuro } from './list/itemFormat.js';
import { TOP_SLOTS } from '../lobby/showcase.js';

const EMPTY_ALL = '아직 기록이 없어요. 오른쪽 위 + 기록하기로 첫 기록을 남겨보세요.';
const EMPTY_CAT = '아직 이 카테고리엔 기록이 없어요. 오른쪽 위 + 기록하기로 남겨보세요.';
const EMPTY_READONLY = '아직 기록이 없어요.';

export function createList({ onEdit, onDelete, onFeature, readOnly, initialTab }) {
  const tabsEl = document.getElementById('tabs');
  const listEl = document.getElementById('list');
  const featuredEl = document.getElementById('featured');
  const featuredGrid = document.getElementById('featuredGrid');
  const featuredTitle = document.getElementById('featuredTitle');
  const allTitle = document.getElementById('allTitle');
  const detail = createDetail(document.getElementById('detailDialog'), { onEdit, onDelete, onFeature, readOnly });

  let activeTab = CATS.some((c) => c.key === initialTab) ? initialTab : 'all';
  let currentItems = [];

  function renderTabs() {
    const all = [{ key: 'all', label: '전체' }, ...CATS];
    tabsEl.innerHTML = '';
    all.forEach((t) => {
      const count = t.key === 'all' ? currentItems.length : currentItems.filter((i) => i.cat === t.key).length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.dataset.cat = t.key;
      btn.setAttribute('aria-pressed', String(t.key === activeTab));
      btn.innerHTML = `${t.key === 'all' ? '' : '<i class="dot"></i>'}${t.label}<span class="n">${count}</span>`;
      btn.addEventListener('click', () => {
        if (activeTab === t.key) return;
        activeTab = t.key;
        // 새로고침하거나 주소를 공유해도 같은 탭이 열리게 주소에도 남김.
        const url = new URL(location.href);
        if (t.key === 'all') url.searchParams.delete('cat'); else url.searchParams.set('cat', t.key);
        history.replaceState(null, '', url);
        renderTabs();
        renderBody();
      });
      tabsEl.appendChild(btn);
    });
  }

  // 카테고리 탭에서만 맨 위에 인생작(최대 3개)을 크게 보여줌 — 방의 가구 위에
  // 걸린 것과 같은 것들. 내 방이면 남는 자리를 방의 빈 스탠드처럼 빈칸으로
  // 채워서 "여기에 더 걸 수 있다"는 걸 보여줌(남의 방이면 고른 것만).
  function renderFeatured(list) {
    if (activeTab === 'all' || list.length === 0) { featuredEl.hidden = true; return; }
    const featured = list.filter((i) => i.featured).slice(0, TOP_SLOTS);
    if (featured.length === 0 && readOnly) { featuredEl.hidden = true; return; }
    featuredEl.hidden = false;
    featuredTitle.textContent = featureLabel(activeTab);
    renderCards(featuredGrid, featured, { onOpen: detail.open, showCat: false, emptyText: '' });
    if (readOnly) return;
    for (let i = featured.length; i < TOP_SLOTS; i++) {
      const slot = document.createElement('div');
      slot.className = 'card slot';
      slot.innerHTML = `<div class="cover slot-cover"><span>기록을 눌러<br>"${withEuro(featureLabel(activeTab))}"를<br>고르면 여기 걸려요</span></div>`;
      featuredGrid.appendChild(slot);
    }
  }

  function renderBody() {
    document.getElementById('totalCount').textContent = currentItems.length;
    const list = (activeTab === 'all' ? currentItems : currentItems.filter((i) => i.cat === activeTab))
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    renderFeatured(list);
    const cat = CATS.find((c) => c.key === activeTab);
    allTitle.textContent = cat ? `모든 ${cat.label}` : '';
    allTitle.hidden = featuredEl.hidden;
    renderCards(listEl, list, {
      onOpen: detail.open,
      showCat: activeTab === 'all',
      emptyText: readOnly ? EMPTY_READONLY : activeTab === 'all' ? EMPTY_ALL : EMPTY_CAT,
    });
  }

  return {
    // 새로 받아온 items 배열로 탭+목록을 다시 그림. 서버에서 기록을
    // 새로 불러올 때마다(로드/추가/수정/삭제 후) main.js가 이 함수를 부름.
    render(items) {
      currentItems = items;
      renderTabs();
      renderBody();
    },
  };
}
