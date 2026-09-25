// 로비 가구에 "어떤 기록을 어느 자리에 걸지" 고르는 순수 함수 — DOM/THREE와
// 무관해서 단독으로 테스트할 수 있음(tests/lobby/showcase.test.js).

export const TOP_SLOTS = 3;

// records(서버가 준 전체 목록, 이미 최신순)에서 cat 카테고리만 골라,
//   top:  인생작 자리 3개 — 별표(featured)로 직접 고른 것만(서버가 카테고리당
//         3개까지만 허용하지만, 혹시 더 와도 3개에서 자름). 모자란 자리는
//         가구가 빈 액자/빈 포스터/빈 스탠드로 둠 — 기록 보관소의 인생작 줄과
//         늘 같은 것만 걸리게.
//   rest: top에 안 들어간 나머지 전부(최신순 유지).
export function pickShowcase(records, cat) {
  const mine = (records || []).filter((r) => r.cat === cat);
  const top = mine.filter((r) => r.featured).slice(0, TOP_SLOTS);
  const rest = mine.filter((r) => !top.includes(r));
  return { top, rest };
}

// 음악 코너(레코드 콘솔)에 곡을 나눠 놓는 규칙 — 다른 카테고리처럼 "콘솔
// 위 = 최애음악, 칸 안 = 나머지":
//   playing: 턴테이블에서 도는 곡 — 최애음악 중 첫 번째(가장 최근에 기록한 것),
//            최애음악이 없으면 가장 최근 곡(턴테이블이 비어 보이지 않게).
//   picks:   턴테이블 옆 받침에 세우는 나머지 최애음악(최대 2장).
//   rest:    그 밖의 곡 전부(최신순) — 콘솔 칸 안에 들어감.
// 기록 보관소도 이걸로 "재생 중" 표시를 붙여서 방과 같은 곡을 가리킴.
export function pickMusic(records) {
  const mine = (records || []).filter((r) => r.cat === 'music');
  const featured = mine.filter((r) => r.featured).slice(0, TOP_SLOTS);
  const playing = featured[0] || mine[0] || null;
  const picks = featured.slice(1);
  const rest = mine.filter((r) => r !== playing && !picks.includes(r));
  return { playing, picks, rest };
}
