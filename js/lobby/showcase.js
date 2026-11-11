// 로비 가구에 "어떤 기록을 어느 자리에 걸지" 고르는 순수 함수 — DOM/THREE와
// 무관해서 단독으로 테스트할 수 있음(tests/lobby/showcase.test.js).

// 음악·옷장의 최애 자리 수(백엔드 crud.FEATURED_PER_CAT과 같음).
export const TOP_SLOTS = 3;

// 큰 책장(furniture/bigShelf.js) — 책·애니·영화를 구분 없이 기록한 순서대로.
//   items:    셋 전부, 오래된 것부터(서버 목록은 최신순이라 뒤집음 — 위 칸 왼쪽이 가장 오래됨).
//   featured: 인생작(위 벽 액자) — 셋 합쳐 SHELF_FEATURED개까지(백엔드도 같은 한도), 오래된 것부터.
export const SHELF_CATS = ['book', 'anime', 'movie'];
export const SHELF_FEATURED = 9;

export function pickShelf(records) {
  const mine = (records || []).filter((r) => SHELF_CATS.includes(r.cat));
  const items = mine.slice().reverse();
  return { items, featured: items.filter((r) => r.featured).slice(0, SHELF_FEATURED) };
}

// 옷장(furniture/wardrobe.js)에 걸 옷 — 최애옷 먼저, 그다음 최신순.
//   hang:  봉에 거는 옷(상의·하의·아우터·원피스, 종류를 안 고른 것도) — HANG개까지.
//   shelf: 아래칸에 세우는 신발·가방·액세서리 — SHELF개까지.
const WARDROBE_HANG = 6;
const WARDROBE_SHELF = 4;
const SHELF_KINDS = new Set(['shoes', 'bag', 'acc']);

export function pickWardrobe(records) {
  const mine = (records || []).filter((r) => r.cat === 'wardrobe');
  const ordered = [...mine.filter((r) => r.featured), ...mine.filter((r) => !r.featured)];
  const onShelf = (r) => SHELF_KINDS.has(r.attrs && r.attrs.kind);
  return {
    hang: ordered.filter((r) => !onShelf(r)).slice(0, WARDROBE_HANG),
    shelf: ordered.filter(onShelf).slice(0, WARDROBE_SHELF),
  };
}

// 음악 코너(레코드 콘솔)에 곡을 나눠 놓는 규칙 — 다른 카테고리처럼 "콘솔
// 위 = 최애음악, 칸 안 = 나머지":
//   playing: 턴테이블에서 도는 곡 — 방 주인이 "턴테이블에 올리기"로 직접 고른 곡
//            (서버의 playing, 방마다 한 곡). 고른 곡이 없으면 최애음악 중 첫 번째
//            (가장 최근에 기록한 것), 그것도 없으면 가장 최근 곡(턴테이블이 비어 보이지 않게).
//   picks:   턴테이블 옆 받침에 세우는 나머지 최애음악(받침 수만큼, 최대 2장).
//   rest:    그 밖의 곡 전부(최신순) — 콘솔 칸 안에 들어감.
// 기록 보관소도 이걸로 "재생 중" 표시를 붙여서 방과 같은 곡을 가리킴.
const STAND_SLOTS = 2;

export function pickMusic(records) {
  const mine = (records || []).filter((r) => r.cat === 'music');
  const featured = mine.filter((r) => r.featured).slice(0, TOP_SLOTS);
  const playing = mine.find((r) => r.playing) || featured[0] || mine[0] || null;
  const picks = featured.filter((r) => r !== playing).slice(0, STAND_SLOTS);
  const rest = mine.filter((r) => r !== playing && !picks.includes(r));
  return { playing, picks, rest };
}
