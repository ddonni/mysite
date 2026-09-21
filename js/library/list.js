// 화면 위쪽의 탭(전체/책/애니/영화)과, 그 아래 기록 목록을 그리는
// 모듈. "기록을 어떻게 서버와 주고받는지"는 모르고, 그냥 건네받은
// items 배열을 화면에 예쁘게 뿌리는 역할만 함.
//
// 목록의 한 줄을 누르면 아코디언처럼 펼쳐지고, 그 안에 "고쳐 쓰기"/
// "삭제" 버튼이 있음. 이 버튼들을 눌렀을 때 실제로 무슨 일이 일어날지는
// (수정 모달을 열기, 서버에서 진짜로 지우기) createList를 호출한 쪽
// (main.js)이 onEdit/onDelete 콜백으로 정해줌 — list.js는 "언제
// 눌렸는지"만 알려주고 "그래서 뭘 할지"는 모름.
import { CATS } from './records.js';
import { defaultAlbumDataUrl } from '../shared/album.js';
import { escapeHtml } from '../shared/dom.js';

function ratingText(r) {
  r = r || 0;
  return '★' + r.toFixed(1);
}

export function createList({ onEdit, onDelete, onFeature, readOnly, initialTab }) {
  const tabsEl = document.getElementById('tabs');
  const listEl = document.getElementById('list');

  let activeTab = initialTab || 'all';
  let openId = null; // 지금 펼쳐진(아코디언 열린) 기록의 id, 없으면 null
  let currentItems = [];

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
    listEl.innerHTML = '';
    if (list.length === 0) {
      listEl.innerHTML = `<div class="empty">${activeTab === 'all' ? '아직 기록이 없어요.' : '이 항목엔 아직 기록이 없어요.'} 오른쪽 위 + 기록으로 추가해보세요.</div>`;
      return;
    }
    list.forEach((it) => {
      const cat = CATS.find((c) => c.key === it.cat);
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <span class="cat">${cat ? cat.label : ''}</span>
        <span class="title">${it.featured ? '⭐ ' : ''}${escapeHtml(it.title)}${it.creator ? `<span class="creator">${escapeHtml(it.creator)}</span>` : ''}</span>
        <span class="rating">${ratingText(it.rating)}</span>
        <span class="date">${it.date || ''}</span>
      `;
      row.addEventListener('click', () => {
        openId = (openId === it.id) ? null : it.id;
        renderList();
      });
      listEl.appendChild(row);

      if (openId === it.id) {
        listEl.appendChild(renderDetailRow(it));
      }
    });
  }

  function renderDetailRow(it) {
    const det = document.createElement('div');
    det.className = 'detail-row';
    // 음악은 항상 앨범 이미지 자리를 보여줌 — 없으면 기본 이미지로 채움
    // (책/애니/영화는 사진이 없으면 원래부터 썸네일 자체를 안 보여줌).
    const thumbSrc = it.photo_url || (it.cat === 'music' ? defaultAlbumDataUrl() : null);
    det.innerHTML = `
      ${thumbSrc ? `<img class="thumb" src="${thumbSrc}">` : ''}
      <div class="body">
        <div class="memo ${it.memo ? '' : 'empty-memo'}">${it.memo ? escapeHtml(it.memo) : '남긴 감상이 없어요.'}</div>
        ${readOnly ? '' : `
        <div class="actions" id="actions-${it.id}">
          <span data-act="edit">고쳐 쓰기</span>
          <span data-act="delete">삭제</span>
          ${it.cat !== 'music' ? `<span data-act="feature">${it.featured ? '이달의 작품 해제' : '이달의 작품으로'}</span>` : ''}
        </div>`}
      </div>
    `;
    if (readOnly) return det; // 남의 방을 보는 중엔 수정/삭제 버튼 자체가 없음
    det.querySelector('[data-act="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      onEdit(it); // list.js는 이미 item 전체를 갖고 있으니, id가 아니라 통째로 넘겨줌
    });
    det.querySelector('[data-act="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      // 실수 삭제 방지: 바로 지우지 않고 "정말요?" 확인 버튼으로 한 번 더 물어봄.
      const actionsEl = det.querySelector(`#actions-${it.id}`);
      actionsEl.innerHTML = `
        <span style="color:var(--accent);">정말 삭제할까요?</span>
        <span data-act="confirm-delete">예, 삭제</span>
        <span data-act="cancel-delete">아니오</span>
      `;
      actionsEl.querySelector('[data-act="confirm-delete"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        onDelete(it.id);
      });
      actionsEl.querySelector('[data-act="cancel-delete"]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        renderList();
      });
    });
    const featureBtn = det.querySelector('[data-act="feature"]');
    if (featureBtn) {
      featureBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onFeature(it);
      });
    }
    return det;
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
