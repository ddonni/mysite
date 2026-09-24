// 화면 위쪽의 탭(전체/책/애니/영화/음악)과 보기모드(목록/그리드) 전환,
// "지금 뭘 보여줄지" 상태(activeTab/openId/viewMode/currentItems)를
// 담당하는 모듈. 실제로 어떻게 그리는지는 list/rowsView.js,
// list/gridView.js, list/lightbox.js에 맡기고, 이 파일은 그것들을
// 지금 상태에 맞게 불러주는 역할만 함.
//
// "기록을 어떻게 서버와 주고받는지"는 모르고, 그냥 건네받은 items
// 배열을 화면에 뿌리는 역할만 함. 목록의 한 줄을 누르면 아코디언처럼
// 펼쳐지고, 그 안의 "고쳐 쓰기"/"삭제" 버튼을 눌렀을 때 실제로 무슨
// 일이 일어날지는(수정 모달을 열기, 서버에서 진짜로 지우기) createList를
// 호출한 쪽(main.js)이 onEdit/onDelete 콜백으로 정해줌 — list.js는
// "언제 눌렸는지"만 알려주고 "그래서 뭘 할지"는 모름.
import { CATS } from './records.js';
import { renderRows } from './list/rowsView.js';
import { renderGrid } from './list/gridView.js';
import { createLightbox } from './list/lightbox.js';

export function createList({ onEdit, onDelete, onFeature, readOnly, initialTab }) {
  const tabsEl = document.getElementById('tabs');
  const listEl = document.getElementById('list');
  const viewToggleEl = document.getElementById('viewToggle');
  const lightbox = createLightbox(document.getElementById('thumbLightbox'), { onEdit, onDelete, onFeature, readOnly });

  let activeTab = initialTab || 'all';
  let openId = null; // 지금 펼쳐진(아코디언 열린) 기록의 id, 없으면 null
  let viewMode = 'list'; // 'list' | 'grid' — '이미지만 보기'는 grid
  let currentItems = [];

  // 목록/그리드 전환 버튼 — 두 개뿐이라 탭처럼 매번 다시 그릴 필요 없이
  // 한 번만 연결해둠.
  if (viewToggleEl) {
    viewToggleEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.view === viewMode) return;
        viewMode = btn.dataset.view;
        viewToggleEl.querySelectorAll('button').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        renderList();
      });
    });
  }

  function renderTabs() {
    const all = [{ key: 'all', label: '전체' }, ...CATS];
    tabsEl.innerHTML = '';
    all.forEach((t) => {
      const count = t.key === 'all' ? currentItems.length : currentItems.filter((i) => i.cat === t.key).length;
      const btn = document.createElement('button');
      btn.innerHTML = `${t.label}<span class="n">${count}</span>`;
      if (t.key === activeTab) btn.classList.add('active');
      btn.addEventListener('click', () => {
        activeTab = t.key;
        openId = null;
        renderTabs();
        renderList();
      });
      tabsEl.appendChild(btn);
    });
  }

  function renderList() {
    document.getElementById('totalCount').textContent = currentItems.length;
    const list = (activeTab === 'all' ? currentItems : currentItems.filter((i) => i.cat === activeTab))
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    listEl.classList.toggle('grid', viewMode === 'grid');
    if (viewMode === 'grid') {
      renderGrid(listEl, list, { onOpenItem: (it) => lightbox.open(it) });
    } else {
      renderRows(listEl, list, {
        activeTab,
        openId,
        onToggleOpen: (id) => { openId = (openId === id) ? null : id; renderList(); },
        onEdit, onDelete, onFeature, readOnly,
        rerender: renderList,
      });
    }
  }

  return {
    // 새로 받아온 items 배열로 탭+목록을 다시 그림. 서버에서 기록을
    // 새로 불러올 때마다(로드/추가/수정/삭제 후) main.js가 이 함수를 부름.
    render(items) {
      currentItems = items;
      renderTabs();
      renderList();
    },
  };
}
