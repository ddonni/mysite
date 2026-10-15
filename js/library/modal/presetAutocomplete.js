// 제목 입력창 아래에 뜨는 "혹시 이거 아니에요?" 목록.
// 후보는 서버(fetchSuggestions → GET .../title-suggestions)가 이 방 + 공개된 방들의
// 기록에서 골라 줌 — 내가 이미 기록한 제목엔 "이미 기록함" 표시. 서버 후보가 모자라거나
// 서버가 안 닿으면 코드에 적어둔 PRESETS(카테고리별 대표 제목)로 채움.
// 후보를 고르면 제목을 넣고, 만든 사람 칸이 비어 있을 때만 서버가 알려준 만든 사람을
// 채움(그 제목의 만든 사람이 한 명으로 정해질 때만 옴 — 동명의 다른 작품이면 비워둠).
// getCat()으로 지금 카테고리를 매번 물어봄(카테고리 탭이 바뀔 수 있어서).
const MAX_ITEMS = 8;
const DEBOUNCE_MS = 180;

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

export function createPresetAutocomplete({ input, listEl, creatorInput }, PRESETS, getCat, fetchSuggestions) {
  let timer = null;
  let ctrl = null; // 진행 중인 서버 요청 — 새로 치면 이전 것은 취소
  let seq = 0;

  function hide() {
    listEl.style.display = 'none';
  }

  function presetMatches(filter) {
    const f = norm(filter);
    return (PRESETS[getCat()] || []).filter((t) => norm(t).includes(f)).map((title) => ({ title }));
  }

  function draw(items) {
    listEl.innerHTML = '';
    if (!items.length) { hide(); return; }
    listEl.style.display = 'block';
    items.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'preset-item';
      const name = document.createElement('span');
      name.textContent = s.title;
      el.appendChild(name);
      if (s.mine) {
        const badge = document.createElement('span');
        badge.className = 'preset-mine';
        badge.textContent = '이미 기록함';
        el.appendChild(badge);
      }
      // mousedown에서 막아야 입력칸 포커스가 안 빠져서(blur) 목록이 먼저 닫히지 않음.
      el.addEventListener('mousedown', (e) => e.preventDefault());
      el.addEventListener('click', () => {
        // 한글 조합 중에 골랐으면 먼저 조합을 확정시킴 — 안 그러면 나중에 확정된
        // 글자가 고른 제목을 덮어쓸 수 있음.
        input.blur();
        input.value = s.title;
        if (creatorInput && s.creator && !creatorInput.value.trim()) creatorInput.value = s.creator;
        hide();
      });
      listEl.appendChild(el);
    });
  }

  // 서버 후보 먼저, 모자라면 같은 제목이 아닌 PRESETS로 채움.
  function merge(server, filter) {
    const seen = new Set(server.map((s) => norm(s.title)));
    const extra = presetMatches(filter).filter((p) => !seen.has(norm(p.title)));
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
