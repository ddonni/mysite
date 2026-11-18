// 기억 보관소 배치(js/lobby/archive/layout.js) — 날짜 순으로 입구부터 채우는지, 탑 수, 걷기 경계.
import { describe, expect, it } from 'vitest';
import { SHELF, AISLE, archiveOrder, layoutArchive, towerCount, towerPlacement, keepWalkable } from '../../js/lobby/archive/layout.js';

const rec = (id, date, cat = 'book') => ({ id, date, cat, title: `t${id}` });

describe('archiveOrder', () => {
  it('날짜가 이른 것부터, 같은 날이면 먼저 쓴 것(id)부터, 날짜 없는 건 맨 앞', () => {
    const order = archiveOrder([rec(3, '2026-05-01'), rec(1, '2026-05-01'), rec(2, null), rec(4, '2025-01-01')]);
    expect(order.map((r) => r.id)).toEqual([2, 4, 1, 3]);
  });
  it('원본 배열은 그대로', () => {
    const list = [rec(2, '2026-02-01'), rec(1, '2026-01-01')];
    archiveOrder(list);
    expect(list.map((r) => r.id)).toEqual([2, 1]);
  });
});

describe('towerCount', () => {
  it('기록이 적어도 최소 개수, 늘 짝수, 빈 탑은 하나쯤만', () => {
    expect(towerCount(0)).toBe(AISLE.minTowers);
    expect(towerCount(SHELF.capacity * 9) % 2).toBe(0);
    expect(towerCount(SHELF.capacity * 9)).toBe(10); // 9개 꽉 + 빈 탑 1
    expect(towerCount(SHELF.capacity * 9 + 1)).toBe(12); // 10개째가 생기면 + 빈 탑 1, 짝 맞춤
  });
});

describe('layoutArchive', () => {
  it('첫 자리부터 기록 순서대로 채우고 나머지는 빈 자리', () => {
    const { slots, filled, towers } = layoutArchive([rec(2, '2026-02-01'), rec(1, '2026-01-01')]);
    expect(filled).toBe(2);
    expect(slots).toHaveLength(towers.length * SHELF.capacity);
    expect(slots[0].record.id).toBe(1);
    expect(slots[1].record.id).toBe(2);
    expect(slots[2].record).toBeNull();
  });
  it('첫 탑이 차면 다음 탑으로 — 첫 줄은 아랫줄', () => {
    const many = Array.from({ length: SHELF.capacity + 1 }, (_, i) => rec(i + 1, '2026-01-01'));
    const { slots } = layoutArchive(many);
    expect(slots[0].position.row).toBe(0);
    expect(slots[SHELF.capacity].tower).toBe(1);
    expect(slots[SHELF.capacity].record.id).toBe(SHELF.capacity + 1);
  });
  it('자리는 선반 벽 바로 바깥, 바깥을 봄, 높이는 그 줄 선반', () => {
    const { slots, towers } = layoutArchive([rec(1, '2026-01-01')]);
    const p = slots[0].position, t = towers[0];
    const d = Math.hypot(p.x - t.x, p.z - t.z);
    expect(d).toBeGreaterThan(SHELF.radius);
    expect(d).toBeLessThan(SHELF.radius + 0.2);
    expect(Math.sin(p.angle) * (p.x - t.x) + Math.cos(p.angle) * (p.z - t.z)).toBeCloseTo(d, 5);
    expect(p.y).toBe(SHELF.baseY);
  });
});

describe('towerPlacement', () => {
  it('왼쪽·오른쪽 번갈아, 통로(x=0) 쪽을 봄', () => {
    const l = towerPlacement(0), r = towerPlacement(1);
    expect(l.x).toBeLessThan(0);
    expect(r.x).toBeGreaterThan(0);
    expect(Math.sin(l.facing)).toBeGreaterThan(0.9); // +x 쪽
    expect(Math.sin(r.facing)).toBeLessThan(-0.9);
  });
});

describe('keepWalkable', () => {
  it('탑 안으로 들어가려 하면 탑 밖으로 밀어냄', () => {
    const towers = [towerPlacement(0)];
    const t = towers[0];
    const p = keepWalkable(t.x + 0.2, t.z, towers, { endZ: -100 });
    expect(Math.hypot(p.x - t.x, p.z - t.z)).toBeGreaterThanOrEqual(SHELF.radius + 0.7);
  });
  it('통로 끝과 입구 너머로는 못 감', () => {
    const p = keepWalkable(0, -500, [], { endZ: -40 });
    expect(p.z).toBe(-40);
    expect(keepWalkable(0, 50, [], { endZ: -40 }).z).toBe(6);
  });
});
