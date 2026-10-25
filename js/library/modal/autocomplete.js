// 입력칸 아래에 뜨는 "혹시 이거 아니에요?" 목록 — 제목 칸과 만든 사람 칸이
// 각자 하나씩 씀(서로 독립: 하나를 골라도 다른 칸은 안 바뀜).
// 후보는 부르는 쪽(modal.js)의 fetchSuggestions가 줌 — 이 방 + 공개된 방들의 기록에서
// 서버가 고른 것(GET .../suggestions)과 책·음악·영화·애니 검색 결과. 내 방에 이미 있는
// 제목엔 "이미 기록함" 표시(markMine). (예전엔 코드에 적어 둔 추천 제목 PRESETS로
// 모자란 걸 채웠는데, 검색이 생겨서 뺌.)
// getCat()으로 지금 카테고리를 매번 물어봄(카테고리 탭이 바뀔 수 있어서).
//
// 후보에 card({ title, meta, cover })가 붙어 있으면 책·음악 검색 결과라서 표지
// 썸네일과 설명 한 줄("작가 · 출판사 · 연도" 등)을 같이 그림. 무엇을 보여줄지는
// 부르는 쪽(modal.js)이 정하고, 고르면 onPick(후보)으로 작가·표지 등을 채움.
import { escapeHtml, escapeAttr } from '../../shared/dom.js';
import { photoSrc } from '../../shared/photoSrc.js';

// 이 방 후보 3개 + 검색 결과(책 8개, 가수의 앨범·싱글 최대 12개)가 들어가도록.
const MAX_ITEMS = 12;
const DEBOUNCE_MS = 180;

// fetchSuggestions(cat, q, signal) → Promise<[{ value, mine, card? }]>
// onPick(후보) → 목록에서 하나를 고른 직후(입력칸 값은 이미 바뀐 뒤)
// footer(후보들) → 목록 맨 아래 작은 글씨(없으면 빈 문자열) — 출처 표기·검색 요령
// header(후보들) → 목록 맨 위 작은 글씨(없으면 빈 문자열) — "가수 없이 찾은 결과" 등
// pendingText(입력값) → 서버 응답을 기다리는 동안 보여줄 문구(빈 문자열이면 안 보임)
// emptyText(입력값) → 서버 응답까지 왔는데 후보가 하나도 없을 때 문구(빈 문자열이면
//   지금처럼 목록을 닫음) — 검색 결과가 없다는 걸 알려주려고
// keepOpenOn → 눌러도 목록을 닫지 않을 다른 요소들(예: 제목 목록을 보면서 바로 옆
//   작가 칸을 누를 때). 그 칸에 입력을 시작하면 닫는 건 부르는 쪽 몫(hide()).
// openOnFocus() → 칸에 포커스가 올 때 이미 쓰인 값으로 목록을 다시 열지(기본: 연다)
//   — 다른 칸의 목록이 열려 있으면 그걸 덮지 않게 부르는 쪽이 false를 줌.
export function createAutocomplete({ input, listEl }, {
  getCat, fetchSuggestions, markMine = false, onPick, footer, header, pendingText, emptyText,
  keepOpenOn = [], openOnFocus = () => true,
}) {
  let timer = null;
  let ctrl = null; // 진행 중인 서버 요청 — 새로 치면 이전 것은 취소
  let seq = 0;

  function hide() {
    listEl.style.display = 'none';
  }

  function note(className, text) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    listEl.appendChild(el);
  }

  // 후보 대신 안내 문구 한 줄만 보여줌("검색 중…", "결과가 없어요"). 빈 문구면 닫음.
  function drawMessage(text) {
    listEl.innerHTML = '';
    if (!text) { hide(); return; }
    listEl.style.display = 'block';
    note('ac-message', text);
  }

  function draw(items) {
    listEl.innerHTML = '';
    if (!items.length) { hide(); return; }
    listEl.style.display = 'block';
    const top = header ? header(items) : '';
    if (top) note('ac-head', top);
    items.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'ac-item';
      if (s.card) {
        el.classList.add('rich');
        const c = s.card;
        const coverClass = 'ac-cover' + (c.square ? ' square' : ''); // 앨범 커버는 정사각형
        // 썸네일도 기록 사진과 같은 CORS 방식으로(photoSrc 설명) — 고른 표지가
        // 미리보기·목록에서 같은 캐시를 씀.
        el.innerHTML = `
          ${c.cover ? `<img class="${coverClass}" src="${escapeAttr(photoSrc(c.cover))}" alt="" loading="lazy" crossorigin="anonymous">` : `<span class="${coverClass}"></span>`}
          <span class="ac-text">
            <span class="ac-title">${escapeHtml(c.title || s.value)}</span>
            ${c.meta ? `<span class="ac-meta">${escapeHtml(c.meta)}</span>` : ''}
          </span>`;
      } else {
        const name = document.createElement('span');
        name.textContent = s.value;
        el.appendChild(name);
      }
      if (markMine && s.mine) {
        const badge = document.createElement('span');
        badge.className = 'ac-mine';
        badge.textContent = '이미 기록함';
        el.appendChild(badge);
      }
      // mousedown에서 막아야 입력칸 포커스가 안 빠져서(blur) 목록이 먼저 닫히지 않음.
      el.addEventListener('mousedown', (e) => e.preventDefault());
      el.addEventListener('click', () => {
        // 한글 조합 중에 골랐으면 먼저 조합을 확정시킴 — 안 그러면 나중에 확정된
        // 글자가 고른 값을 덮어쓸 수 있음.
        input.blur();
        input.value = s.value;
        hide();
        if (onPick) onPick(s);
      });
      listEl.appendChild(el);
    });
    const bottom = footer ? footer(items) : '';
    if (bottom) note('ac-foot', bottom);
  }

  function render(filter) {
    clearTimeout(timer);
    if (ctrl) { ctrl.abort(); ctrl = null; }
    if (!filter) { hide(); return; }
    // 서버 응답을 기다리는 동안엔 "검색 중…"(pendingText가 빈 문자열이면 닫아 둠).
    drawMessage(pendingText ? pendingText(filter) : '');
    if (!fetchSuggestions) return;
    const my = ++seq;
    timer = setTimeout(() => {
      ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      fetchSuggestions(getCat(), filter, ctrl && ctrl.signal)
        .then((server) => {
          if (my !== seq) return;
          const items = (server || []).slice(0, MAX_ITEMS);
          if (!items.length && emptyText) drawMessage(emptyText(filter));
          else draw(items);
        })
        .catch(() => { if (my === seq) hide(); }); // 서버가 안 닿으면 닫음
    }, DEBOUNCE_MS);
  }

  input.addEventListener('input', () => render(input.value.trim()));
  input.addEventListener('focus', () => { if (input.value.trim() && openOnFocus()) render(input.value.trim()); });
  document.addEventListener('click', (e) => {
    if (e.target === input || listEl.contains(e.target)) return;
    if (keepOpenOn.some((el) => el && el.contains(e.target))) return;
    hide();
  });

  return {
    // 카테고리 탭을 바꿨을 때 등, 지금 입력값 기준으로 목록을 다시 그림.
    refresh() { render(input.value.trim()); },
    hide() { clearTimeout(timer); seq++; hide(); },
    isOpen: () => listEl.style.display !== 'none',
  };
}
