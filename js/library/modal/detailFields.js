// 세부 기록(선택) — 기록 창의 감상 아래에 늘 펼쳐져 있는 칸(2026-11-17 사용자 요청 — 처음엔 "+ 자세히
// 남기기"로 펼쳤는데 숨기지 말자고 함).
//   - 요소별 별점(0.5 단위): 애니는 참신함·스토리·작화·캐릭터·결말, 영화·시리즈는 스토리·연기·영상미·
//     음악·결말, 책은 결말만. 안 매긴 요소는 저장하지 않음(× 로 지울 수 있음).
//   - 장르: 정해진 목록에서 여러 개(최대 GENRES_MAX개).
//   - 음악은 유튜브 링크가 있어서 세부 기록이 없음(사용자 결정).
// 요소·장르 목록은 백엔드 schemas.DETAIL_ASPECTS·DETAIL_GENRES와 같아야 함(서버가 이 값만 받음).
import { createStarPicker } from './starPicker.js';

export const ASPECTS = {
  anime: [['novelty', '참신함'], ['story', '스토리'], ['art', '작화'], ['character', '캐릭터'], ['ending', '결말']],
  movie: [['story', '스토리'], ['acting', '연기'], ['visual', '영상미'], ['music', '음악'], ['ending', '결말']],
  book: [['ending', '결말']],
};
export const GENRES = {
  anime: ['액션', '판타지', '이세계', '로맨스', '일상', '코미디', 'SF', '미스터리', '스포츠', '드라마', '공포', '학원'],
  movie: ['액션', '드라마', '로맨스', '코미디', '스릴러', '범죄', 'SF', '판타지', '공포', '미스터리', '애니메이션', '다큐'],
  book: ['소설', '에세이', '시', '인문', '역사', '과학', '자기계발', '경제', '만화', '판타지', '추리', '로맨스'],
};
export const GENRES_MAX = 5;

const aspectLabel = (cat, key) => ((ASPECTS[cat] || []).find(([k]) => k === key) || [])[1] || key;

// 카드 뒷면 등에 쓰는 짧은 요약 — [['스토리', 4.5], ...]와 장르 목록. 없으면 null.
export function detailSummary(cat, details) {
  if (!details || !ASPECTS[cat]) return null;
  const scores = ASPECTS[cat].filter(([k]) => details.scores && details.scores[k]).map(([k, label]) => [label, details.scores[k]]);
  const genres = (details.genres || []).filter((g) => GENRES[cat].includes(g));
  return scores.length || genres.length ? { scores, genres } : null;
}

// rootEl: 칸 전체(음악이면 숨김), bodyEl: 요소별 별점·장르를 그릴 안쪽.
export function createDetailFields({ rootEl, bodyEl }) {
  let cat = 'book';
  let scores = {};
  let genres = [];
  let pickers = {};

  function paintGenres() {
    bodyEl.querySelectorAll('.genre-chip').forEach((b) => {
      const on = genres.includes(b.dataset.genre);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.disabled = !on && genres.length >= GENRES_MAX;
    });
  }

  function build() {
    const aspects = ASPECTS[cat];
    rootEl.hidden = !aspects;
    if (!aspects) return;
    bodyEl.innerHTML = `
      <div class="detail-aspects">${aspects.map(([key, label]) => `
        <div class="aspect-row" data-key="${key}">
          <span class="aspect-label">${label}</span>
          <div class="stars aspect-stars"></div>
          <button type="button" class="aspect-clear" aria-label="${label} 별점 지우기" title="지우기">×</button>
        </div>`).join('')}
      </div>
      <div class="detail-genres-label">장르 <span>(${GENRES_MAX}개까지)</span></div>
      <div class="detail-genres">${GENRES[cat].map((g) => `<button type="button" class="genre-chip" data-genre="${g}">${g}</button>`).join('')}</div>`;
    pickers = {};
    bodyEl.querySelectorAll('.aspect-row').forEach((row) => {
      const key = row.dataset.key;
      const picker = createStarPicker(row.querySelector('.aspect-stars'));
      picker.setValue(scores[key] || 0);
      pickers[key] = picker;
      const clear = row.querySelector('.aspect-clear');
      const paintClear = () => { clear.hidden = !picker.getValue(); };
      paintClear();
      row.querySelector('.aspect-stars').addEventListener('click', () => { scores[key] = picker.getValue(); paintClear(); });
      clear.addEventListener('click', () => { picker.setValue(0); delete scores[key]; paintClear(); });
    });
    bodyEl.querySelectorAll('.genre-chip').forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.genre;
      genres = genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g].slice(0, GENRES_MAX);
      paintGenres();
    }));
    paintGenres();
  }

  return {
    // 카테고리를 바꾸면 그 카테고리의 칸으로 다시 그림(다른 카테고리 요소·장르는 버림).
    setCat(next) {
      if (next === cat && bodyEl.childElementCount) return;
      cat = next;
      const keep = new Set((ASPECTS[cat] || []).map(([k]) => k));
      scores = Object.fromEntries(Object.entries(scores).filter(([k]) => keep.has(k)));
      genres = genres.filter((g) => (GENRES[cat] || []).includes(g));
      build();
    },
    // 수정할 때 저장된 값을 채움.
    setValue(details) {
      scores = { ...((details && details.scores) || {}) };
      genres = [...((details && details.genres) || [])];
      build();
    },
    reset() {
      scores = {};
      genres = [];
      build();
    },
    // 서버로 보낼 값 — 아무것도 안 썼거나 음악이면 null.
    getValue() {
      if (!ASPECTS[cat]) return null;
      const s = Object.fromEntries(Object.entries(scores).filter(([k, v]) => v && ASPECTS[cat].some(([a]) => a === k)));
      return Object.keys(s).length || genres.length ? { scores: s, genres } : null;
    },
    label: (key) => aspectLabel(cat, key),
  };
}
