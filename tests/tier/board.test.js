// 티어리스트 보드 규칙(js/tier/board.js) — 별점 자동 배치, 줄 안 순서, 옮기기.
import { describe, expect, it } from 'vitest';
import { tierFromRating, tierOf, buildRows, moveRecord, UNPLACED } from '../../js/tier/board.js';

const rec = (id, rating, extra = {}) => ({ id, rating, date: '2026-11-01', title: `t${id}`, ...extra });

describe('tierFromRating', () => {
  it('반 별 단위 10점이 줄 하나씩 — 4점 이하는 F, 별점 없으면 미배치', () => {
    expect([5, 4.5, 4, 3.5, 3, 2.5, 2, 0.5].map(tierFromRating)).toEqual(['SS', 'S', 'A', 'B', 'C', 'D', 'F', 'F']);
    expect(tierFromRating(0)).toBe(UNPLACED);
    expect(tierFromRating(null)).toBe(UNPLACED);
  });

  it('직접 놓은 줄이 별점보다 우선, 이상한 값이면 별점대로', () => {
    expect(tierOf(rec(1, 5, { tier: 'C' }))).toBe('C');
    expect(tierOf(rec(1, 5, { tier: '-' }))).toBe(UNPLACED);
    expect(tierOf(rec(1, 5, { tier: 'Z' }))).toBe('SS');
  });
});

describe('buildRows', () => {
  it('직접 놓은 순서 먼저, 그다음 최신순', () => {
    const rows = buildRows([
      rec(1, 4, { date: '2026-11-01' }),
      rec(2, 4, { date: '2026-11-05' }),
      rec(3, 4, { tier: 'A', tier_pos: 1 }),
      rec(4, 2, { tier: 'A', tier_pos: 0 }),
    ]);
    expect(rows.A.map((r) => r.id)).toEqual([4, 3, 2, 1]);
    expect(rows.SS).toEqual([]);
  });
});

describe('moveRecord', () => {
  const rows = buildRows([rec(1, 5), rec(2, 5, { date: '2026-11-02' }), rec(3, 3)]);

  it('다른 줄의 작품 앞으로 — 두 줄의 순서를 저장할 배치로', () => {
    const { rows: next, placements } = moveRecord(rows, 3, 'SS', 1);
    expect(next.SS.map((r) => r.id)).toEqual([2, 3, 1]);
    expect(next.C).toEqual([]);
    expect(placements).toEqual([
      { id: 2, tier: 'SS', pos: 0 }, { id: 3, tier: 'SS', pos: 1 }, { id: 1, tier: 'SS', pos: 2 },
    ]);
    expect(rows.C.map((r) => r.id)).toEqual([3]); // 원래 rows는 그대로
  });

  it('앞에 둘 작품이 없으면 줄 맨 뒤, 같은 줄 안에서도 옮겨짐', () => {
    expect(moveRecord(rows, 2, 'SS').rows.SS.map((r) => r.id)).toEqual([1, 2]);
    expect(moveRecord(rows, 1, UNPLACED).placements).toContainEqual({ id: 1, tier: UNPLACED, pos: 0 });
  });

  it('없는 작품이면 아무것도 안 바뀜', () => {
    expect(moveRecord(rows, 99, 'S').placements).toEqual([]);
  });
});
