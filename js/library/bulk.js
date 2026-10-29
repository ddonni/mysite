// "목록으로 추가" 창 — 처음 방을 채울 때 하나씩 기록하는 게 벽이라, 제목 목록을 붙여
// 넣으면 줄마다 검색해서 표지·작가를 채운 뒤 한꺼번에 저장함. 두 단계:
//   1. 쓰기: 카테고리를 고르고 한 줄에 하나씩(bulk/parseList.js가 번호·글머리표를 뗌).
//   2. 확인: 줄마다 맨 위 검색 결과를 골라 두고(bulk/match.js), 틀렸으면 다른 후보나
//      "제목만"으로 바꾸거나 체크를 빼고 → 추가하기.
// 백엔드는 따로 없음 — 새 기록 창과 같은 검색 API와 POST .../records를 줄 수만큼 부름.
import { CATS, saveRecord, fetchScreenCreator } from './records.js';
import { CREATOR_FIELD } from './modal/categoryFields.js';
import { TMDB_NOTE } from './modal/recordSearch.js';
import { parseList, MAX_LINES } from './bulk/parseList.js';
import { findCandidates, isRecorded, toRecord, mapLimit } from './bulk/match.js';
import { photoSrc } from '../shared/photoSrc.js';

// 동시에 보내는 검색 수 — 50줄을 한꺼번에 쏘면 외부 API(카카오·TMDB·유튜브)가 막을 수 있어서.
const SEARCH_CONCURRENCY = 3;

const FOOT = {
  book: '책 정보 제공: Kakao',
  anime: TMDB_NOTE,
  movie: TMDB_NOTE,
  music: '음악은 그 노래가 실린 앨범의 커버와 가수를 가져와요 · 제목은 쓴 그대로 남아요',
};

// getItems(): 지금 방의 기록(이미 기록한 제목을 건너뛰려고), onSaved(cat): 저장이 끝나면.
export function createBulkImport({ getItems, onSaved }) {
  const overlay = document.getElementById('bulkOverlay');
  const catTabsEl = document.getElementById('bulkCatTabs');
  const writeStep = document.getElementById('bulkWrite');
  const reviewStep = document.getElementById('bulkReview');
  const textEl = document.getElementById('bulkText');
  const errorEl = document.getElementById('bulkError');
  const hintEl = document.getElementById('bulkHint');
  const summaryEl = document.getElementById('bulkSummary');
  const rowsEl = document.getElementById('bulkRows');
  const footEl = document.getElementById('bulkFoot');
  const findBtn = overlay.querySelector('[data-bulk="find"]');
  const saveBtn = overlay.querySelector('[data-bulk="save"]');

  let cat = 'book';
  let rows = []; // [{ line, candidates, choice(-1이면 제목만), include, status, el }]
  // 창을 닫거나 다시 쓰기로 돌아가면 올라가는 번호 — 늦게 온 검색 결과를 버리려고.
  let run = 0;
  let saving = false;

  CATS.forEach((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = c.label;
    btn.dataset.key = c.key;
    btn.addEventListener('click', () => selectCat(c.key));
    catTabsEl.appendChild(btn);
  });

  function selectCat(key) {
    cat = CATS.some((c) => c.key === key) ? key : 'book';
    [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === cat));
    const creator = (CREATOR_FIELD[cat] || CREATOR_FIELD.book).label;
    hintEl.innerHTML = '';
    hintEl.append(
      `한 줄에 하나씩 적거나 붙여 넣으세요(최대 ${MAX_LINES}줄). 앞의 번호·글머리표는 알아서 떼요. `,
      Object.assign(document.createElement('b'), { textContent: `제목 / ${creator}` }),
      '처럼 쓰면 더 정확하게 찾아요.',
    );
  }

  function setOpen(open) {
    overlay.classList.toggle('open', open);
    document.body.classList.toggle('modal-open', open);
  }

  function showStep(step) {
    writeStep.hidden = step !== 'write';
    reviewStep.hidden = step !== 'review';
  }

  // ---- 1. 쓰기 ----
  async function find() {
    // 한글 마지막 글자가 조합 중일 수 있어서 포커스를 빼고 다음 틱에 읽음(modal.js와 같은 이유).
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    await new Promise((r) => setTimeout(r, 0));
    const { items, overflow } = parseList(textEl.value);
    if (!items.length) {
      errorEl.textContent = '추가할 제목을 한 줄에 하나씩 적어 주세요.';
      errorEl.hidden = false;
      textEl.focus();
      return;
    }
    errorEl.hidden = true;
    startReview(items, overflow);
  }

  // ---- 2. 확인 ----
  function startReview(lines, overflow) {
    const mine = ++run;
    const existing = getItems();
    rows = lines.map((line) => {
      const dup = isRecorded(existing, cat, line.title);
      return { line, candidates: [], choice: -1, include: !dup, status: dup ? 'dup' : 'loading' };
    });
    rowsEl.innerHTML = '';
    rows.forEach((row) => { row.el = document.createElement('li'); rowsEl.appendChild(row.el); paintRow(row); });
    footEl.textContent = FOOT[cat] || '';
    summaryEl.textContent = overflow ? `${MAX_LINES}줄까지만 받아요 — 뒤의 ${overflow}줄은 뺐어요. 찾는 중…` : '찾는 중…';
    summaryEl.dataset.overflow = overflow;
    showStep('review');
    updateSaveBtn();

    // 이미 기록한 줄은 찾지 않음(체크를 다시 켜면 그때 제목만으로 저장).
    const todo = rows.filter((r) => r.status === 'loading');
    mapLimit(todo, SEARCH_CONCURRENCY, (row) => findCandidates(cat, row.line).then(
      (candidates) => {
        if (mine !== run) return;
        row.candidates = candidates;
        row.choice = candidates.length ? 0 : -1;
        row.status = candidates.length ? 'ok' : 'none';
        paintRow(row);
        updateSaveBtn();
      },
      () => {
        if (mine !== run) return;
        row.status = 'failed';
        paintRow(row);
        updateSaveBtn();
      },
    )).then(() => { if (mine === run) paintSummary(); });
  }

  function paintSummary() {
    const searched = rows.filter((r) => r.status !== 'dup');
    const hit = rows.filter((r) => r.status === 'ok').length;
    const dup = rows.length - searched.length;
    const parts = [`${searched.length}개 중 ${hit}개를 찾았어요.`];
    if (dup) parts.push(`이미 기록한 ${dup}개는 빼 뒀어요.`);
    parts.push('틀린 건 다른 결과로 바꾸거나 체크를 빼 주세요.');
    const overflow = Number(summaryEl.dataset.overflow || 0);
    if (overflow) parts.unshift(`${MAX_LINES}줄까지만 받아서 뒤의 ${overflow}줄은 뺐어요.`);
    summaryEl.textContent = parts.join(' ');
  }

  const STATUS = {
    loading: '찾는 중…',
    none: '검색 결과가 없어요 — 제목만 저장해요',
    failed: '검색하지 못했어요 — 제목만 저장해요',
    dup: '이미 기록했어요',
  };

  // 줄 하나를 다시 그림 — 체크박스, 표지, 제목, 설명(또는 상태), 다른 후보 고르기.
  function paintRow(row) {
    const el = row.el;
    el.className = 'bulk-row';
    el.dataset.status = row.status;
    el.classList.toggle('off', !row.include);
    el.innerHTML = '';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = row.include;
    check.disabled = row.status === 'loading' || saving;
    check.setAttribute('aria-label', `${row.line.title} 추가`);
    check.addEventListener('change', () => { row.include = check.checked; el.classList.toggle('off', !row.include); updateSaveBtn(); });

    const picked = row.choice >= 0 ? row.candidates[row.choice] : null;
    let cover;
    if (picked && picked.cover) {
      cover = document.createElement('img');
      cover.src = photoSrc(picked.cover);
      cover.alt = '';
      cover.loading = 'lazy';
    } else {
      cover = document.createElement('span');
    }
    cover.className = 'ac-cover' + (picked && picked.square ? ' square' : '');

    const text = document.createElement('div');
    text.className = 'bulk-text';
    const title = document.createElement('div');
    title.className = 'bulk-title';
    title.textContent = picked ? picked.label : row.line.title;
    const meta = document.createElement('div');
    meta.className = 'ac-meta';
    if (picked) {
      meta.textContent = picked.meta || picked.creator;
    } else {
      meta.textContent = [row.line.creator, STATUS[row.status]].filter(Boolean).join(' · ');
    }
    text.append(title, meta);

    if (row.candidates.length) {
      const select = document.createElement('select');
      select.setAttribute('aria-label', `${row.line.title} 검색 결과 고르기`);
      select.disabled = saving;
      row.candidates.forEach((c, i) => {
        select.add(new Option([c.label, c.meta].filter(Boolean).join(' · '), String(i), false, i === row.choice));
      });
      select.add(new Option(`검색 결과 없이 '${row.line.title}' 제목만`, '-1', false, row.choice < 0));
      select.addEventListener('change', () => { row.choice = Number(select.value); paintRow(row); });
      text.appendChild(select);
    }

    el.append(check, cover, text);
  }

  function chosen() {
    return rows.filter((r) => r.include && r.status !== 'loading');
  }

  function updateSaveBtn() {
    if (saving) return;
    const loading = rows.some((r) => r.status === 'loading');
    const n = chosen().length;
    saveBtn.disabled = loading || n === 0;
    saveBtn.textContent = loading ? '찾는 중…' : n ? `${n}개 추가하기` : '추가할 게 없어요';
  }

  // ---- 3. 저장 ----
  // 목록은 같은 날짜면 나중에 저장한 게 위라서, 아래 줄부터 저장해 쓴 순서대로 보이게 함.
  // 하나가 실패해도 나머지는 계속하고, 실패한 줄만 남겨 다시 누를 수 있게 함.
  async function save() {
    if (saving) return;
    const todo = chosen().reverse();
    if (!todo.length) return;
    saving = true;
    saveBtn.disabled = true;
    rows.forEach(paintRow);
    const failed = new Set();
    for (let i = 0; i < todo.length; i++) {
      saveBtn.textContent = `저장 중 ${i + 1}/${todo.length}`;
      const row = todo[i];
      const picked = row.choice >= 0 ? row.candidates[row.choice] : null;
      try {
        if (picked && picked.screen && !picked.creator) {
          // 영화·애니는 검색 결과에 감독이 없어서 고른 것만 물어봄 — 못 찾으면 비워 둠.
          picked.creator = await fetchScreenCreator(picked.screen.media, picked.screen.id).catch(() => '');
        }
        await saveRecord(toRecord(cat, row.line, picked));
      } catch (err) {
        console.error(err);
        failed.add(row);
      }
    }
    saving = false;
    const savedCat = cat;
    if (!failed.size) {
      close();
      onSaved(savedCat);
      return;
    }
    // 저장된 줄은 빼고, 실패한 줄과 체크를 뺐던 줄만 남김.
    rows = rows.filter((r) => failed.has(r) || !todo.includes(r));
    rowsEl.innerHTML = '';
    rows.forEach((row) => { rowsEl.appendChild(row.el); paintRow(row); });
    summaryEl.textContent = `${todo.length - failed.size}개는 추가했고, ${failed.size}개는 저장하지 못했어요. 잠시 후 다시 눌러 주세요.`;
    updateSaveBtn();
    onSaved(savedCat);
  }

  function close() {
    if (saving) return;
    run++;
    setOpen(false);
  }

  findBtn.addEventListener('click', find);
  saveBtn.addEventListener('click', save);
  overlay.querySelector('[data-bulk="cancel"]').addEventListener('click', close);
  overlay.querySelector('[data-bulk="close"]').addEventListener('click', close);
  overlay.querySelector('[data-bulk="back"]').addEventListener('click', () => {
    if (saving) return;
    run++;
    showStep('write');
    textEl.focus();
  });

  return {
    // cat: 처음 골라 둘 카테고리 — 보고 있던 탭(전체 탭이면 책). 쓰던 글은 남겨 둠
    // (실수로 닫았다가 다시 열어도 다시 붙여 넣지 않게).
    open(initialCat) {
      selectCat(initialCat);
      errorEl.hidden = true;
      showStep('write');
      setOpen(true);
      textEl.focus();
    },
  };
}
