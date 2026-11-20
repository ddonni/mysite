// 옷 기록의 추가 칸(2026-11-20 사용자 요청) — 구매일 · 종류 · 색 · 계절(여러 개) · 핏 · 톤 · 특징 태그 · 소재 ·
// 사이즈. 꼭 써야 하는 건 사진과 이름뿐(그 둘은 기록 창의 원래 사진·제목 칸, 브랜드는 만든 사람 칸).
// 종류·색·계절·핏·톤은 정해진 값에서 고름 — 나중에 코디·OOTD에서 묶어 쓰기 좋게. 백엔드
// schemas.CLOTHES_*와 같아야 함(서버가 이 값만 받음). 태그·소재·사이즈는 자유롭게(추천만 띄움).
import { escapeHtml, escapeAttr } from '../../shared/dom.js';

export const KINDS = ['상의', '하의', '아우터', '원피스', '신발', '가방', '모자', '액세서리'];
// 색 — 이름과 견본 색(멀티는 무지개 줄무늬로 그림).
export const COLORS = [
  ['블랙', '#1F1F22'], ['화이트', '#FFFFFF'], ['그레이', '#9A9DA3'], ['베이지', '#E3D3B5'],
  ['브라운', '#7A5236'], ['네이비', '#25345C'], ['블루', '#2F6FD0'], ['스카이블루', '#8EC5EE'],
  ['그린', '#3E8E5A'], ['카키', '#7A7A4A'], ['레드', '#D03A3A'], ['핑크', '#F2A0B8'],
  ['퍼플', '#7E57C2'], ['옐로', '#F2D04B'], ['오렌지', '#EE8A3A'], ['멀티', ''],
];
export const SEASONS = ['봄', '여름', '가을', '겨울'];
export const FITS = ['슬림', '레귤러', '세미오버', '오버'];
export const TONES = ['웜톤', '쿨톤', '뉴트럴'];
export const TAGS_MAX = 10;
const TAG_LEN = 15;
const MATERIALS = ['면', '린넨', '울', '니트', '캐시미어', '데님', '가죽', '스웨이드', '폴리에스터', '나일론', '실크', '플리스', '코듀로이'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE', '230', '240', '250', '260', '270', '280'];

const EMPTY = () => ({ purchased: '', kind: null, color: null, seasons: [], fit: null, tone: null, tags: [], material: '', size: '' });

export function colorSwatch(name) {
  const c = COLORS.find(([n]) => n === name);
  if (!c) return '';
  const style = c[1] ? `background:${c[1]}` : 'background:conic-gradient(#D03A3A,#F2D04B,#3E8E5A,#2F6FD0,#7E57C2,#D03A3A)';
  return `<i class="swatch" style="${style}" aria-hidden="true"></i>`;
}

// 카드 뒷면·목록에 쓰는 줄들 — [['구매일', '2026.03.02'], ...] (빈 칸은 뺌). 태그는 따로(tags).
export function clothesSummary(attrs) {
  const a = attrs || {};
  const rows = [
    ['종류', a.kind],
    ['색', a.color],
    ['계절', (a.seasons || []).join('·')],
    ['핏', a.fit],
    ['톤', a.tone],
    ['소재', a.material],
    ['사이즈', a.size],
    ['구매일', a.purchased ? a.purchased.replace(/-/g, '.') : ''],
  ].filter(([, v]) => v);
  return { rows, tags: a.tags || [] };
}

// rootEl: 칸 전체(옷일 때만 보임). 값은 모듈 안에 들고 있다가 getValue로 서버 모양을 돌려줌.
export function createClothesFields({ rootEl }) {
  let v = EMPTY();

  const chipGroup = (key, options, multi = false) => `
    <div class="cl-chips" role="group" data-key="${key}" data-multi="${multi}">${options.map((o) => `
      <button type="button" class="genre-chip" data-value="${escapeAttr(o)}" aria-pressed="false">${escapeHtml(o)}</button>`).join('')}
    </div>`;

  rootEl.innerHTML = `
    <div class="cl-row"><span class="cl-label">종류</span>${chipGroup('kind', KINDS)}</div>
    <div class="cl-row"><span class="cl-label">색</span>
      <div class="cl-chips cl-colors" role="group" data-key="color" data-multi="false">${COLORS.map(([name]) => `
        <button type="button" class="genre-chip color-chip" data-value="${name}" aria-pressed="false" title="${name}">${colorSwatch(name)}${name}</button>`).join('')}
      </div>
    </div>
    <div class="cl-row"><span class="cl-label">계절 <em>(여러 개)</em></span>${chipGroup('seasons', SEASONS, true)}</div>
    <div class="cl-row"><span class="cl-label">핏</span>${chipGroup('fit', FITS)}</div>
    <div class="cl-row"><span class="cl-label">톤</span>${chipGroup('tone', TONES)}</div>
    <div class="cl-row"><span class="cl-label">특징 태그 <em>(Enter로 추가, ${TAGS_MAX}개까지)</em></span>
      <div class="cl-tags"><span class="cl-tag-list"></span><input type="text" class="cl-tag-input" maxlength="${TAG_LEN}" placeholder="예: 스트라이프, 기모" aria-label="특징 태그"></div>
    </div>
    <div class="cl-grid">
      <label class="cl-field"><span class="cl-label">소재</span><input type="text" data-text="material" maxlength="30" list="clMaterials" autocomplete="off"></label>
      <label class="cl-field"><span class="cl-label">사이즈</span><input type="text" data-text="size" maxlength="10" list="clSizes" autocomplete="off"></label>
      <label class="cl-field"><span class="cl-label">구매일</span><input type="date" data-text="purchased"></label>
    </div>
    <datalist id="clMaterials">${MATERIALS.map((m) => `<option value="${m}">`).join('')}</datalist>
    <datalist id="clSizes">${SIZES.map((m) => `<option value="${m}">`).join('')}</datalist>`;

  const tagList = rootEl.querySelector('.cl-tag-list');
  const tagInput = rootEl.querySelector('.cl-tag-input');

  function paint() {
    rootEl.querySelectorAll('.cl-chips').forEach((group) => {
      const key = group.dataset.key;
      group.querySelectorAll('button').forEach((b) => {
        const on = key === 'seasons' ? v.seasons.includes(b.dataset.value) : v[key] === b.dataset.value;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    });
    rootEl.querySelectorAll('[data-text]').forEach((input) => { input.value = v[input.dataset.text] || ''; });
    tagList.innerHTML = v.tags.map((t, i) => `<span class="cl-tag">${escapeHtml(t)}<button type="button" data-tag="${i}" aria-label="${escapeAttr(t)} 태그 지우기">×</button></span>`).join('');
    tagInput.disabled = v.tags.length >= TAGS_MAX;
  }

  // 한 번 더 누르면 해제(하나만 고르는 칸도 "안 고름"으로 돌아갈 수 있게).
  rootEl.querySelectorAll('.cl-chips').forEach((group) => group.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-value]');
    if (!b) return;
    const key = group.dataset.key;
    const val = b.dataset.value;
    if (key === 'seasons') {
      v.seasons = v.seasons.includes(val) ? v.seasons.filter((s) => s !== val) : SEASONS.filter((s) => s === val || v.seasons.includes(s));
    } else {
      v[key] = v[key] === val ? null : val;
    }
    paint();
  }));
  rootEl.querySelectorAll('[data-text]').forEach((input) => input.addEventListener('input', () => { v[input.dataset.text] = input.value; }));

  function addTag(raw) {
    const t = raw.trim().slice(0, TAG_LEN);
    if (t && !v.tags.includes(t) && v.tags.length < TAGS_MAX) v.tags = [...v.tags, t];
    tagInput.value = '';
    paint();
    tagInput.focus();
  }
  tagInput.addEventListener('keydown', (e) => {
    if (e.isComposing) return; // 한글 조합 중 Enter는 글자 확정용
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput.value); }
    else if (e.key === 'Backspace' && !tagInput.value && v.tags.length) { v.tags = v.tags.slice(0, -1); paint(); }
  });
  // 쉼표를 붙여 넣거나 Enter 없이 칸을 떠나도 태그로.
  tagInput.addEventListener('blur', () => { if (tagInput.value.trim()) addTag(tagInput.value); });
  tagList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    v.tags = v.tags.filter((_, i) => i !== Number(b.dataset.tag));
    paint();
  });

  paint();
  return {
    setValue(attrs) {
      const a = attrs || {};
      v = { ...EMPTY(), ...a, seasons: [...(a.seasons || [])], tags: [...(a.tags || [])], purchased: a.purchased || '', material: a.material || '', size: a.size || '' };
      paint();
    },
    reset() { v = EMPTY(); tagInput.value = ''; paint(); },
    // 서버로 보낼 값(schemas.ClothesAttrs) — 칸에 남은 태그 글자도 태그로 넣음.
    getValue() {
      if (tagInput.value.trim()) addTag(tagInput.value);
      return {
        purchased: v.purchased || null,
        kind: v.kind,
        color: v.color,
        seasons: v.seasons,
        fit: v.fit,
        tone: v.tone,
        tags: v.tags,
        material: v.material.trim() || null,
        size: v.size.trim() || null,
      };
    },
  };
}
