// 새 기록 창의 검색 화면 — 새 기록을 열면 처음 보이는 화면. 제목이나 작가·감독·가수
// 이름으로 찾고(findWorks.js — 검색 버튼·Enter를 눌렀을 때만, 한 글자 제목도 됨),
//   - 결과(또는 줄 끝 "+ 넣기")를 누르면 그 값이 채워진 입력 칸으로(onPick) — 별점·감상까지
//     쓰고 저장하면 다시 이 화면. 넣은 줄은 "✓ 넣음"이 되고, 다시 누르면 방금 넣은 걸 지움(onUndo).
//   - 결과는 저장하고 돌아와도 그대로 남아서 이어서 넣거나 다른 검색어로 찾음.
//   - "+ 직접 쓰기"는 검색에 없을 때 — 검색어를 제목으로 채운 입력 칸(onManual).
import { findWorks, isRecorded } from './findWorks.js';
import { TMDB_NOTE, squash } from './recordSearch.js';
import { photoSrc } from '../../shared/photoSrc.js';

const FOOT = {
  book: '책 정보 제공: Kakao',
  anime: TMDB_NOTE,
  movie: TMDB_NOTE,
  music: '가수 이름이면 그 가수의 노래가, 노래 제목이면 쓴 제목 그대로 떠요',
};
const PLACEHOLDER = {
  book: '책 제목이나 작가 이름',
  anime: '애니 제목이나 감독 이름',
  movie: '영화·시리즈 제목이나 감독 이름',
  music: '노래 제목이나 가수 이름',
};

// getCat(): 지금 카테고리, getItems(): 지금 방의 기록(이미 기록한 건 "기록함"으로).
// onPick(후보), onManual(검색어), onUndo(저장된 기록) → Promise.
export function createSearchView({ getCat, getItems, onPick, onManual, onUndo }) {
  const queryEl = document.getElementById('sQuery');
  const statusEl = document.getElementById('sStatus');
  const noticeEl = document.getElementById('sNotice');
  const listEl = document.getElementById('sResults');
  const footEl = document.getElementById('sFoot');

  let results = [];
  let resultsCat = null;
  let searched = ''; // 마지막으로 찾은 검색어 — 카테고리를 바꾸면 이걸로 다시 찾음
  let run = 0;
  // 이 창에서 방금 넣은 것 — "카테고리:제목" → 저장된 기록(되돌리기용).
  const added = new Map();
  const keyOf = (cat, title) => `${cat}:${squash(title)}`;

  function search(q) {
    const cat = getCat();
    const mine = ++run;
    searched = q;
    if (!q) {
      results = [];
      statusEl.textContent = '';
      paint();
      queryEl.focus();
      return;
    }
    statusEl.textContent = `'${q}' 찾는 중…`;
    findWorks(cat, q).then(
      (works) => {
        if (mine !== run) return;
        results = works;
        resultsCat = cat;
        statusEl.textContent = works.length ? `'${q}' 검색 결과 ${works.length}개` : `'${q}' 검색 결과가 없어요`;
        paint();
        listEl.scrollTop = 0;
      },
      () => {
        if (mine !== run) return;
        results = [];
        statusEl.textContent = '지금은 검색할 수 없어요 — 직접 써 주세요';
        paint();
      },
    );
  }

  queryEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); search(queryEl.value.trim()); }
  });
  document.getElementById('sBtn').addEventListener('click', () => search(queryEl.value.trim()));
  document.getElementById('manualBtn').addEventListener('click', () => onManual(queryEl.value.trim()));

  function coverEl(c) {
    let el;
    if (c.cover) {
      el = document.createElement('img');
      el.crossOrigin = 'anonymous'; // 목록·로비와 같은 CORS 방식(list/itemFormat.js 설명)
      el.src = photoSrc(c.cover);
      el.alt = '';
      el.loading = 'lazy';
    } else {
      el = document.createElement('span');
    }
    el.className = 'ac-cover' + (c.square ? ' square' : '');
    return el;
  }

  function addButton(cat, c) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'si-add';
    const key = keyOf(cat, c.title);
    if (added.has(key)) {
      btn.textContent = '✓ 넣음';
      btn.classList.add('on');
      btn.setAttribute('aria-label', `${c.title} 넣은 것 취소`);
      btn.addEventListener('click', () => {
        btn.disabled = true;
        onUndo(added.get(key)).then(
          () => { added.delete(key); paint(); notice(`'${c.title}'을(를) 뺐어요`); },
          () => { btn.disabled = false; notice(`'${c.title}'을(를) 지우지 못했어요. 잠시 후 다시 눌러 주세요.`); },
        );
      });
    } else if (isRecorded(getItems(), cat, c.title)) {
      btn.textContent = '기록함';
      btn.disabled = true;
    } else {
      btn.textContent = '+ 넣기';
      btn.setAttribute('aria-label', `${c.title} 넣기`);
      btn.addEventListener('click', () => onPick(c));
    }
    return btn;
  }

  function paint() {
    footEl.textContent = results.length ? FOOT[resultsCat] || '' : '';
    listEl.innerHTML = '';
    listEl.hidden = !results.length;
    results.forEach((c) => {
      const li = document.createElement('li');
      li.className = 'si';
      const main = document.createElement('button');
      main.type = 'button';
      main.className = 'si-main';
      const text = document.createElement('span');
      text.className = 'ac-text';
      const title = document.createElement('span');
      title.className = 'ac-title';
      title.textContent = c.label || c.title;
      text.appendChild(title);
      if (c.meta || c.creator) {
        const meta = document.createElement('span');
        meta.className = 'ac-meta';
        meta.textContent = c.meta || c.creator;
        text.appendChild(meta);
      }
      main.append(coverEl(c), text);
      main.addEventListener('click', () => onPick(c));
      li.append(main, addButton(resultsCat, c));
      listEl.appendChild(li);
    });
  }

  // 위에 한 줄 알림("'기생충'을(를) 넣었어요").
  function notice(text) {
    noticeEl.textContent = text;
    noticeEl.hidden = !text;
  }

  return {
    // 새 기록을 열 때 — 검색어·결과·알림을 비우고 placeholder를 카테고리에 맞춤.
    reset() {
      run++;
      results = [];
      searched = '';
      added.clear();
      queryEl.value = '';
      statusEl.textContent = '';
      notice('');
      this.refresh();
    },
    // 카테고리 탭을 바꿨을 때 — 찾아 둔 게 있으면 같은 검색어로 그 카테고리에서 다시 찾음.
    refresh() {
      queryEl.placeholder = PLACEHOLDER[getCat()] || PLACEHOLDER.book;
      if (searched) search(searched);
      else paint();
    },
    focus() { queryEl.focus(); },
    // 입력 칸에서 저장하고 돌아왔을 때 — 그 줄을 "✓ 넣음"으로 하고 알림.
    saved(record) {
      if (record && record.id != null) added.set(keyOf(record.cat, record.title), record);
      paint();
      notice(`'${record.title}'을(를) 넣었어요`);
    },
  };
}
