// 입력칸 아래에 뜨는 "혹시 이거 아니에요?" 목록 — 제목 칸과 만든 사람 칸이
// 각자 하나씩 씀(서로 독립: 하나를 골라도 다른 칸은 안 바뀜).
// 후보는 서버(fetchSuggestions → GET .../suggestions)가 이 방 + 공개된 방들의
// 기록에서 골라 줌. 제목 칸은 코드에 적어둔 PRESETS로 모자란 걸 채우고(서버가
// 안 닿아도), 내 방에 이미 있는 제목엔 "이미 기록함" 표시(markMine).
// getCat()으로 지금 카테고리를 매번 물어봄(카테고리 탭이 바뀔 수 있어서).
//
// 후보에 card({ title, meta, cover })가 붙어 있으면 책·음악 검색 결과라서 표지
// 썸네일과 설명 한 줄("작가 · 출판사 · 연도" 등)을 같이 그림. 무엇을 보여줄지는
// 부르는 쪽(modal.js)이 정하고, 고르면 onPick(후보)으로 작가·표지 등을 채움.
import { escapeHtml, escapeAttr } from '../../shared/dom.js';
import { photoSrc } from '../../shared/photoSrc.js';

const MAX_ITEMS = 8;
const DEBOUNCE_MS = 180;

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

// fetchSuggestions(cat, q, signal) → Promise<[{ value, mine, card? }]>
// presets(cat) → 서버 후보가 모자랄 때 채울 문자열 목록(없으면 안 채움)
// onPick(후보) → 목록에서 하나를 고른 직후(입력칸 값은 이미 바뀐 뒤)
// footer(후보들) → 목록 맨 아래 작은 글씨(없으면 빈 문자열) — 출처 표기·검색 요령
export function createPresetAutocomplete({ input, listEl }, { getCat, fetchSuggestions, presets, markMine = false, onPick, footer }) {
  let timer = null;
  let ctrl = null; // 진행 중인 서버 요청 — 새로 치면 이전 것은 취소
  let seq = 0;

  function hide() {
    listEl.style.display = 'none';
  }

  function presetMatches(filter) {
    if (!presets) return [];
    const f = norm(filter);
    return (presets(getCat()) || []).filter((t) => norm(t).includes(f)).map((value) => ({ value }));
  }

  function draw(items) {
    listEl.innerHTML = '';
    if (!items.length) { hide(); return; }
    listEl.style.display = 'block';
    items.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'preset-item';
      if (s.card) {
        el.classList.add('rich');
        const c = s.card;
        const coverClass = 'preset-cover' + (c.square ? ' square' : ''); // 앨범 커버는 정사각형
        // 썸네일도 기록 사진과 같은 CORS 방식으로(photoSrc 설명) — 고른 표지가
        // 미리보기·목록에서 같은 캐시를 씀.
        el.innerHTML = `
          ${c.cover ? `<img class="${coverClass}" src="${escapeAttr(photoSrc(c.cover))}" alt="" loading="lazy" crossorigin="anonymous">` : `<span class="${coverClass}"></span>`}
          <span class="preset-text">
            <span class="preset-title">${escapeHtml(c.title || s.value)}</span>
            ${c.meta ? `<span class="preset-meta">${escapeHtml(c.meta)}</span>` : ''}
          </span>`;
      } else {
        const name = document.createElement('span');
        name.textContent = s.value;
        el.appendChild(name);
      }
      if (markMine && s.mine) {
        const badge = document.createElement('span');
        badge.className = 'preset-mine';
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
    const note = footer ? footer(items) : '';
    if (note) {
      const foot = document.createElement('div');
      foot.className = 'preset-foot';
      foot.textContent = note;
      listEl.appendChild(foot);
    }
  }

  // 서버 후보 먼저, 모자라면 같은 값이 아닌 PRESETS로 채움.
  function merge(server, filter) {
    const seen = new Set(server.map((s) => norm(s.value)));
    const extra = presetMatches(filter).filter((p) => !seen.has(norm(p.value)));
    return server.concat(extra).slice(0, MAX_ITEMS);
  }

  function render(filter) {
    clearTimeout(timer);
    if (ctrl) { ctrl.abort(); ctrl = null; }
    if (!filter) { hide(); return; }
    // 서버 응답을 기다리는 동안에도 비어 보이지 않게 PRESETS부터 그려둠.
    draw(merge([], filter));
    if (!fetchSuggestions) return;
    const my = ++seq;
    timer = setTimeout(() => {
      ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      fetchSuggestions(getCat(), filter, ctrl && ctrl.signal)
        .then((server) => { if (my === seq) draw(merge(server || [], filter)); })
        .catch(() => {}); // 서버가 안 닿으면 PRESETS 그대로
    }, DEBOUNCE_MS);
  }

  input.addEventListener('input', () => render(input.value.trim()));
  input.addEventListener('focus', () => { if (input.value.trim()) render(input.value.trim()); });
  document.addEventListener('click', (e) => {
    if (e.target !== input && !listEl.contains(e.target)) hide();
  });

  return {
    // 카테고리 탭을 바꿨을 때 등, 지금 입력값 기준으로 목록을 다시 그림.
    refresh() { render(input.value.trim()); },
    hide() { clearTimeout(timer); seq++; hide(); },
  };
}
