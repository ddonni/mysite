// "목록으로 추가" 창 — 처음 방을 채울 때 하나씩 기록하는 게 벽이라, 여러 개를 한꺼번에
// 넣는 길 두 가지. 둘 다 "확인" 단계(줄마다 체크·표지)를 거쳐 한꺼번에 저장함.
//   - 목록 붙여넣기: 제목을 한 줄에 하나씩(bulk/parseList.js가 번호·글머리표를 뗌) →
//     줄마다 맨 위 검색 결과를 골라 두고(bulk/match.js), 틀렸으면 다른 후보나 "제목만"으로
//     바꾸거나, 그 줄만 검색어를 고쳐 다시 찾거나, 체크를 빼고 → 추가하기.
//   - 검색해서 고르기: 제목이나 작가·감독·가수 이름 → 검색 결과(findWorks — 이름이면 그
//     사람의 작품, 제목이면 그 작품)에서 본 것만 체크 → 추가하기. 같은 작가·감독의 작품을
//     여러 개 봤을 가능성이 높아서. 새 기록 창의 작가·감독 칸 검색 결과에서 "여러 개
//     고르기"로 바로 들어오기도 함(open의 name).
// 검색은 새 기록 창과 같은 API, 저장은 POST .../records/batch 한 번.
import { CATS, saveRecords, fetchScreenCreator } from './records.js';
import { CREATOR_FIELD } from './modal/categoryFields.js';
import { TMDB_NOTE } from './modal/recordSearch.js';
import { parseList, MAX_LINES } from './bulk/parseList.js';
import { findCandidates, findWorks, isRecorded, toRecord, mapLimit } from './bulk/match.js';
import { photoSrc } from '../shared/photoSrc.js';

// 동시에 보내는 검색 수 — 50줄을 한꺼번에 쏘면 외부 API(카카오·TMDB·유튜브)가 막을 수 있어서.
const SEARCH_CONCURRENCY = 3;

const FOOT = {
  book: '책 정보 제공: Kakao',
  anime: TMDB_NOTE,
  movie: TMDB_NOTE,
  music: '음악은 그 노래가 실린 앨범의 커버와 가수를 가져와요 · 제목은 쓴 그대로 남아요',
};
// 검색해서 고르기의 음악은 가수 이름이면 그 가수의 노래 목록(앨범 수록곡을 모은 것).
const FOOT_BY_NAME = { ...FOOT, music: '가수 이름이면 그 가수의 노래가, 노래 제목이면 쓴 제목 그대로 떠요' };

// getItems(): 지금 방의 기록(이미 기록한 제목을 건너뛰려고), onSaved(cat): 저장이 끝나면.
export function createBulkImport({ getItems, onSaved }) {
  const overlay = document.getElementById('bulkOverlay');
  const catTabsEl = document.getElementById('bulkCatTabs');
  const modeTabsEl = document.getElementById('bulkModes');
  const writeStep = document.getElementById('bulkWrite');
  const reviewStep = document.getElementById('bulkReview');
  const listPane = document.getElementById('bulkListPane');
  const namePane = document.getElementById('bulkNamePane');
  const textEl = document.getElementById('bulkText');
  const nameEl = document.getElementById('bulkName');
  const nameLabel = document.getElementById('bulkNameLabel');
  const errorEl = document.getElementById('bulkError');
  const hintEl = document.getElementById('bulkHint');
  const summaryEl = document.getElementById('bulkSummary');
  const rowsEl = document.getElementById('bulkRows');
  const footEl = document.getElementById('bulkFoot');
  const checkAllBtn = overlay.querySelector('[data-bulk="all"]');
  const findBtn = overlay.querySelector('[data-bulk="find"]');
  const saveBtn = overlay.querySelector('[data-bulk="save"]');

  let cat = 'book';
  let mode = 'list'; // 'list'(목록 붙여넣기) | 'name'(검색해서 고르기)
  // [{ line, candidates, choice(-1이면 제목만), include, status, fixed, editing, el }] — fixed면
  // 후보가 정해진 줄(검색해서 고르기)이라 다른 결과 고르기·다시 검색을 안 보여줌. editing이면
  // 그 줄의 검색어를 고치는 중.
  let rows = [];
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
  [...modeTabsEl.children].forEach((btn) => btn.addEventListener('click', () => selectMode(btn.dataset.mode)));

  function creatorLabel() {
    return (CREATOR_FIELD[cat] || CREATOR_FIELD.book).label;
  }

  function selectCat(key) {
    cat = CATS.some((c) => c.key === key) ? key : 'book';
    [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === cat));
    hintEl.innerHTML = '';
    hintEl.append(
      `한 줄에 하나씩 적거나 붙여 넣으세요(최대 ${MAX_LINES}줄). 앞의 번호·글머리표는 알아서 떼요. `,
      Object.assign(document.createElement('b'), { textContent: `제목 / ${creatorLabel()}` }),
      '처럼 쓰면 더 정확하게 찾아요.',
    );
    nameLabel.textContent = `제목이나 ${creatorLabel()} 이름`;
    nameEl.placeholder = { book: '예: 한강, 데미안', music: '예: 검정치마, 밤편지' }[cat] || '예: 봉준호, 기생충';
  }

  function selectMode(next) {
    mode = next === 'name' ? 'name' : 'list';
    [...modeTabsEl.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    listPane.hidden = mode !== 'list';
    namePane.hidden = mode !== 'name';
    findBtn.textContent = mode === 'name' ? '작품 찾기' : '찾아보기';
    errorEl.hidden = true;
  }

  function setOpen(open) {
    overlay.classList.toggle('open', open);
    document.body.classList.toggle('modal-open', open);
  }

  function showStep(step) {
    writeStep.hidden = step !== 'write';
    reviewStep.hidden = step !== 'review';
  }

  function showError(text, focusEl) {
    errorEl.textContent = text;
    errorEl.hidden = false;
    focusEl.focus();
  }

  // ---- 1. 쓰기 ----
  async function find() {
    // 한글 마지막 글자가 조합 중일 수 있어서 포커스를 빼고 다음 틱에 읽음(modal.js와 같은 이유).
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    await new Promise((r) => setTimeout(r, 0));
    if (mode === 'name') {
      const name = nameEl.value.trim();
      if (name.length < 2) { showError('검색어를 두 글자 이상 적어 주세요.', nameEl); return; }
      errorEl.hidden = true;
      startPick(name);
      return;
    }
    const { items, overflow } = parseList(textEl.value);
    if (!items.length) { showError('추가할 제목을 한 줄에 하나씩 적어 주세요.', textEl); return; }
    errorEl.hidden = true;
    startReview(items, overflow);
  }

  function beginReview(newRows, foot) {
    rows = newRows;
    rowsEl.innerHTML = '';
    rows.forEach((row) => { row.el = document.createElement('li'); rowsEl.appendChild(row.el); paintRow(row); });
    footEl.textContent = foot || '';
    showStep('review');
    updateSaveBtn();
  }

  // ---- 2-1. 확인(목록 붙여넣기) ----
  function startReview(lines, overflow) {
    const mine = ++run;
    const existing = getItems();
    beginReview(lines.map((line) => {
      const dup = isRecorded(existing, cat, line.title);
      return { line, candidates: [], choice: -1, include: !dup, status: dup ? 'dup' : 'loading' };
    }), FOOT[cat]);
    checkAllBtn.hidden = true;
    summaryEl.textContent = overflow ? `${MAX_LINES}줄까지만 받아요 — 뒤의 ${overflow}줄은 뺐어요. 찾는 중…` : '찾는 중…';

    // 이미 기록한 줄은 찾지 않음(체크를 다시 켜면 그때 제목만으로 저장).
    const todo = rows.filter((r) => r.status === 'loading');
    mapLimit(todo, SEARCH_CONCURRENCY, (row) => searchRow(row, mine))
      .then(() => { if (mine === run) paintSummary(overflow); });
  }

  // 줄 하나를 찾아 첫 후보를 골라 둠. 그 사이 같은 줄을 다시 검색했으면(row.search가 바뀜) 버림.
  function searchRow(row, mine) {
    const ticket = (row.search || 0) + 1;
    row.search = ticket;
    const stale = () => mine !== run || row.search !== ticket;
    return findCandidates(cat, row.line).then(
      (candidates) => {
        if (stale()) return;
        row.candidates = candidates;
        row.choice = candidates.length ? 0 : -1;
        row.status = candidates.length ? 'ok' : 'none';
        paintRow(row);
        updateSaveBtn();
      },
      () => {
        if (stale()) return;
        row.status = 'failed';
        paintRow(row);
        updateSaveBtn();
      },
    );
  }

  // 그 줄만 검색어를 고쳐 다시 찾기 — 오타·줄임말이라 엉뚱한 결과가 나왔을 때. 입력은 목록
  // 붙여넣기와 같은 모양("제목 / 작가"도 됨). 다시 찾으면 체크도 켬(고치려는 줄이니).
  function research(row, text) {
    const [line] = parseList(text).items;
    row.editing = false;
    if (!line) { paintRow(row); return; }
    row.line = line;
    row.candidates = [];
    row.choice = -1;
    row.include = true;
    row.status = 'loading';
    paintRow(row);
    updateSaveBtn();
    searchRow(row, run);
  }

  function paintSummary(overflow) {
    const searched = rows.filter((r) => r.status !== 'dup');
    const hit = rows.filter((r) => r.status === 'ok').length;
    const dup = rows.length - searched.length;
    const parts = [`${searched.length}개 중 ${hit}개를 찾았어요.`];
    if (dup) parts.push(`이미 기록한 ${dup}개는 빼 뒀어요.`);
    parts.push('틀린 건 다른 결과로 바꾸거나 체크를 빼 주세요.');
    if (overflow) parts.unshift(`${MAX_LINES}줄까지만 받아서 뒤의 ${overflow}줄은 뺐어요.`);
    summaryEl.textContent = parts.join(' ');
  }

  // ---- 2-2. 확인(검색해서 고르기) ----
  // 처음엔 다 꺼 둠 — 검색 결과를 다 본 건 아니니, 본 것만 켜게.
  function startPick(name) {
    const mine = ++run;
    beginReview([], FOOT_BY_NAME[cat]);
    checkAllBtn.hidden = true;
    summaryEl.textContent = `'${name}' 찾는 중…`;
    saveBtn.disabled = true;
    saveBtn.textContent = '찾는 중…';
    findWorks(cat, name).then(
      (works) => {
        if (mine !== run) return;
        const existing = getItems();
        beginReview(works.map((c) => {
          const dup = isRecorded(existing, cat, c.title);
          return { line: { title: c.title, creator: c.creator }, candidates: [c], choice: 0, include: false, status: dup ? 'dup' : 'ok', fixed: true };
        }), FOOT_BY_NAME[cat]);
        if (!works.length) {
          summaryEl.textContent = `'${name}' 검색 결과가 없어요. 제목이나 이름을 다시 확인해 주세요.`;
          return;
        }
        const dup = rows.filter((r) => r.status === 'dup').length;
        summaryEl.textContent = `'${name}' 검색 결과 ${works.length}개예요. 본 것만 체크해 주세요.`
          + (dup ? ` 이미 기록한 ${dup}개는 표시해 뒀어요.` : '');
        checkAllBtn.hidden = false;
        paintCheckAll();
      },
      () => {
        if (mine !== run) return;
        summaryEl.textContent = '검색하지 못했어요. 잠시 후 다시 시도해 주세요.';
        updateSaveBtn();
      },
    );
  }

  // 이미 기록한 것은 빼고 전부 켜기 / 전부 끄기.
  function selectable() {
    return rows.filter((r) => r.status !== 'dup');
  }

  function paintCheckAll() {
    const all = selectable();
    checkAllBtn.textContent = all.length && all.every((r) => r.include) ? '모두 끄기' : '모두 체크';
  }

  checkAllBtn.addEventListener('click', () => {
    if (saving) return;
    const all = selectable();
    const on = !all.every((r) => r.include);
    all.forEach((r) => { r.include = on; paintRow(r); });
    updateSaveBtn();
    paintCheckAll();
  });

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
    check.addEventListener('change', () => {
      row.include = check.checked;
      el.classList.toggle('off', !row.include);
      updateSaveBtn();
      if (!checkAllBtn.hidden) paintCheckAll();
    });

    const picked = row.choice >= 0 ? row.candidates[row.choice] : null;
    let cover;
    if (picked && picked.cover) {
      cover = document.createElement('img');
      // 목록·로비와 같은 CORS 방식으로(list/itemFormat.js 설명). 빼면 이 표지가 CORS 헤더 없이
      // 캐시돼서, 저장 뒤 목록·로비에서 같은 표지가 캐시를 지울 때까지 안 뜸.
      cover.crossOrigin = 'anonymous';
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
      meta.textContent = [picked.meta || picked.creator, row.status === 'dup' ? STATUS.dup : ''].filter(Boolean).join(' · ');
    } else {
      meta.textContent = [row.line.creator, STATUS[row.status]].filter(Boolean).join(' · ');
    }
    text.append(title, meta);

    if (row.editing) {
      const edit = document.createElement('input');
      edit.type = 'text';
      edit.className = 'bulk-research';
      edit.value = row.line.creator ? `${row.line.title} / ${row.line.creator}` : row.line.title;
      edit.setAttribute('aria-label', '다시 찾을 검색어');
      edit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); research(row, edit.value); }
        if (e.key === 'Escape') { e.stopPropagation(); row.editing = false; paintRow(row); }
      });
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'bulk-research-go';
      go.textContent = '찾기';
      go.addEventListener('click', () => research(row, edit.value));
      const box = document.createElement('div');
      box.className = 'bulk-research-box';
      box.append(edit, go);
      text.replaceChildren(box);
      el.onclick = null;
      el.append(check, cover, text);
      setTimeout(() => { edit.focus(); edit.select(); }, 0);
      return;
    }

    if (row.candidates.length && !row.fixed) {
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

    if (!row.fixed && row.status !== 'loading' && !saving) {
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'bulk-again';
      again.textContent = '검색어 고쳐서 다시 찾기';
      again.addEventListener('click', () => { row.editing = true; paintRow(row); });
      text.appendChild(again);
    }

    // 줄 아무 데나 눌러도 체크가 바뀌게(검색해서 고르기는 체크할 게 많아서) — 고르기 칸·버튼은 빼고.
    el.onclick = (e) => {
      if (check.disabled || e.target === check || e.target.closest('select, button')) return;
      check.checked = !check.checked;
      check.dispatchEvent(new Event('change'));
    };

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
    saveBtn.textContent = loading ? '찾는 중…' : n ? `${n}개 추가하기` : (mode === 'name' ? '본 것을 체크해 주세요' : '추가할 게 없어요');
  }

  // ---- 3. 저장 ----
  // 영화·애니는 검색 결과에 감독이 없어서 고른 것만 먼저 동시에 물어보고(못 찾으면 비워 둠),
  // 전부를 요청 한 번에 저장(쓴 순서대로 보이게 — 서버가 맞춰 줌). 실패하면 하나도 안
  // 들어간 것이라 줄을 그대로 두고 다시 누르게 함.
  async function save() {
    if (saving) return;
    const todo = chosen();
    if (!todo.length) return;
    saving = true;
    saveBtn.disabled = true;
    rows.forEach((r) => { r.editing = false; paintRow(r); });
    const picks = todo.map((row) => (row.choice >= 0 ? row.candidates[row.choice] : null));
    const needCreator = picks.filter((p) => p && p.screen && !p.creator);
    if (needCreator.length) {
      saveBtn.textContent = '감독 찾는 중…';
      await mapLimit(needCreator, SEARCH_CONCURRENCY + 1, (p) => fetchScreenCreator(p.screen.media, p.screen.id)
        .then((creator) => { p.creator = creator; }, () => {}));
    }
    saveBtn.textContent = `${todo.length}개 저장 중…`;
    const savedCat = cat;
    try {
      await saveRecords(todo.map((row, i) => toRecord(savedCat, row.line, picks[i])));
    } catch (err) {
      console.error(err);
      saving = false;
      rows.forEach(paintRow);
      summaryEl.textContent = '저장하지 못했어요. 잠시 후 다시 눌러 주세요.';
      updateSaveBtn();
      return;
    }
    saving = false;
    close();
    onSaved(savedCat);
  }

  function close() {
    if (saving) return;
    run++;
    setOpen(false);
  }

  findBtn.addEventListener('click', find);
  nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); find(); } });
  saveBtn.addEventListener('click', save);
  overlay.querySelector('[data-bulk="cancel"]').addEventListener('click', close);
  overlay.querySelector('[data-bulk="close"]').addEventListener('click', close);
  overlay.querySelector('[data-bulk="back"]').addEventListener('click', () => {
    if (saving) return;
    run++;
    showStep('write');
    (mode === 'name' ? nameEl : textEl).focus();
  });

  return {
    // initialCat: 처음 골라 둘 카테고리 — 보고 있던 탭(전체 탭이면 책). 쓰던 글은 남겨 둠
    // (실수로 닫았다가 다시 열어도 다시 붙여 넣지 않게). name을 주면 검색해서 고르기를 그
    // 이름으로 바로 찾음(새 기록 창의 작가·감독 칸 검색 결과에서 넘어올 때).
    open(initialCat, { name } = {}) {
      selectCat(initialCat);
      errorEl.hidden = true;
      setOpen(true);
      if (name) {
        selectMode('name');
        nameEl.value = name;
        startPick(name);
        return;
      }
      selectMode(mode);
      showStep('write');
      (mode === 'name' ? nameEl : textEl).focus();
    },
  };
}
