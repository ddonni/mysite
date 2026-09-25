// 로비 가구에 "어떤 기록을 어느 자리에 걸지" 고르는 순수 함수 — DOM/THREE와
// 무관해서 단독으로 테스트할 수 있음(tests/lobby/showcase.test.js).

export const TOP_SLOTS = 3;

// records(서버가 준 전체 목록, 이미 최신순)에서 cat 카테고리만 골라,
//   top:  인생작 자리 3개 — 별표(featured) 켜진 것 먼저(서버가 카테고리당
//         3개까지만 허용하지만, 혹시 더 와도 3개에서 자름). fill이 true면
//         모자란 자리를 별표 없는 최신 기록으로 채우고, false면 별표 고른
//         것만 올라감(빈자리는 가구가 빈 포스터/빈 스탠드로 둠).
//   rest: top에 안 들어간 나머지 전부(최신순 유지).
export function pickShowcase(records, cat, { slots = TOP_SLOTS, fill = true } = {}) {
  const mine = (records || []).filter((r) => r.cat === cat);
  const featured = mine.filter((r) => r.featured).slice(0, slots);
  const fillers = fill ? mine.filter((r) => !r.featured).slice(0, slots - featured.length) : [];
  const top = featured.concat(fillers);
  const rest = mine.filter((r) => !top.includes(r));
  return { top, rest };
}
