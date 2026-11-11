// 옷장 기록의 추가 칸(종류·색·계절) — 값 목록은 백엔드 schemas.WARDROBE_KINDS/COLORS/SEASONS와
// 같아야 함(서버가 이 값만 받음). 나중에 AI 조합·구매 추천에 쓰려고 자유 입력 대신 정해진 값에서 고름.
// 옷 이름은 제목 칸, 브랜드는 만든 사람 칸, 메모는 감상 칸을 그대로 씀.

export const WARDROBE_KINDS = [
  { key: 'top', label: '상의' },
  { key: 'bottom', label: '하의' },
  { key: 'outer', label: '아우터' },
  { key: 'dress', label: '원피스' },
  { key: 'shoes', label: '신발' },
  { key: 'bag', label: '가방' },
  { key: 'acc', label: '액세서리' },
];

// hex는 화면의 색 견본용(서버엔 key만 감). multi는 무늬·여러 색.
export const WARDROBE_COLORS = [
  { key: 'black', label: '검정', hex: '#1f1f22' },
  { key: 'white', label: '흰색', hex: '#f7f6f2' },
  { key: 'gray', label: '회색', hex: '#9a9a9e' },
  { key: 'beige', label: '베이지', hex: '#d9c7a7' },
  { key: 'brown', label: '갈색', hex: '#7a5232' },
  { key: 'navy', label: '네이비', hex: '#22305a' },
  { key: 'blue', label: '파랑', hex: '#2f64c8' },
  { key: 'sky', label: '하늘', hex: '#9cc8ec' },
  { key: 'green', label: '초록', hex: '#3f7d4a' },
  { key: 'khaki', label: '카키', hex: '#78734a' },
  { key: 'red', label: '빨강', hex: '#c8322f' },
  { key: 'pink', label: '분홍', hex: '#efa6bd' },
  { key: 'purple', label: '보라', hex: '#7b52ab' },
  { key: 'yellow', label: '노랑', hex: '#f0cf45' },
  { key: 'orange', label: '주황', hex: '#e8823a' },
  { key: 'multi', label: '무늬·여러 색', hex: 'conic-gradient(#c8322f, #f0cf45, #3f7d4a, #2f64c8, #7b52ab, #c8322f)' },
];

export const WARDROBE_SEASONS = [
  { key: 'spring', label: '봄' },
  { key: 'summer', label: '여름' },
  { key: 'fall', label: '가을' },
  { key: 'winter', label: '겨울' },
];

const labelOf = (list, key) => (list.find((x) => x.key === key) || {}).label || '';
export const kindLabel = (key) => labelOf(WARDROBE_KINDS, key);
export const colorOf = (key) => WARDROBE_COLORS.find((c) => c.key === key) || null;

// 카드·상세 창에 쓰는 한 줄 — "상의 · 네이비 · 봄·가을". 비어 있으면 ''.
export function wardrobeSummary(attrs) {
  if (!attrs) return '';
  const seasons = WARDROBE_SEASONS.filter((s) => (attrs.seasons || []).includes(s.key)).map((s) => s.label);
  const all = seasons.length === 4 ? '사계절' : seasons.join('·');
  return [kindLabel(attrs.kind), labelOf(WARDROBE_COLORS, attrs.color), all].filter(Boolean).join(' · ');
}

// rootEl 안에 칩 세 줄을 그림. 종류·색은 하나만(다시 누르면 해제), 계절은 여러 개.
export function createWardrobeFields(rootEl) {
  let kind = null;
  let color = null;
  let seasons = new Set();

  rootEl.innerHTML = `
    <div class="field"><label>종류</label><div class="chips" data-group="kind"></div></div>
    <div class="field"><label>색</label><div class="chips swatches" data-group="color"></div></div>
    <div class="field"><label>계절 (여러 개)</label><div class="chips" data-group="seasons"></div></div>`;
  const groups = {
    kind: rootEl.querySelector('[data-group="kind"]'),
    color: rootEl.querySelector('[data-group="color"]'),
    seasons: rootEl.querySelector('[data-group="seasons"]'),
  };

  function chip(group, item) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.key = item.key;
    if (group === 'color') {
      b.classList.add('swatch');
      b.title = item.label;
      b.setAttribute('aria-label', item.label);
      b.style.background = item.hex;
    } else {
      b.textContent = item.label;
    }
    b.addEventListener('click', () => {
      if (group === 'kind') kind = kind === item.key ? null : item.key;
      else if (group === 'color') color = color === item.key ? null : item.key;
      else if (seasons.has(item.key)) seasons.delete(item.key);
      else seasons.add(item.key);
      paint();
    });
    groups[group].appendChild(b);
  }
  WARDROBE_KINDS.forEach((k) => chip('kind', k));
  WARDROBE_COLORS.forEach((c) => chip('color', c));
  WARDROBE_SEASONS.forEach((s) => chip('seasons', s));

  function paint() {
    const on = { kind: (k) => k === kind, color: (k) => k === color, seasons: (k) => seasons.has(k) };
    Object.entries(groups).forEach(([g, el]) => [...el.children].forEach((b) => {
      const pressed = on[g](b.dataset.key);
      b.classList.toggle('on', pressed);
      b.setAttribute('aria-pressed', String(pressed));
    }));
  }

  function setValue(attrs) {
    kind = (attrs && attrs.kind) || null;
    color = (attrs && attrs.color) || null;
    seasons = new Set((attrs && attrs.seasons) || []);
    paint();
  }
  setValue(null);

  return {
    setValue,
    reset: () => setValue(null),
    // 서버로 보낼 모양 — 계절 순서는 서버가 맞춤.
    getValue: () => ({ kind, color, seasons: [...seasons] }),
  };
}
