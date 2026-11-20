// 이웃 서가(js/lobby/archive/neighbors.js) — 누구를 어떤 순서로 바깥 서가에 놓는지, 자리 규칙.
import { describe, expect, it } from 'vitest';
import {
  pickNeighbors, layoutNeighbors, neighborTowerCount, neighborSlot, NEIGHBOR_SHELF, MAX_NEIGHBORS,
} from '../../js/lobby/archive/neighbors.js';

const room = (code) => ({ code, name: code });

describe('pickNeighbors', () => {
  it('내 방만 빼고 받은 순서(최근 활동순) 그대로 — 인생작이 없어도 넣음', () => {
    const list = pickNeighbors([room('A'), room('ME'), { code: 'B', featured: [] }, room('C')], 'ME', null);
    expect(list.map((r) => r.code)).toEqual(['A', 'B', 'C']);
  });
  it('링크로 가리킨 방(focusCode)은 맨 앞으로', () => {
    const list = pickNeighbors([room('A'), room('B'), room('C')], 'ME', 'C');
    expect(list.map((r) => r.code)).toEqual(['C', 'A', 'B']);
  });
  it('최대 개수까지만', () => {
    const many = Array.from({ length: MAX_NEIGHBORS + 5 }, (_, i) => room(`R${i}`));
    expect(pickNeighbors(many, 'ME', null)).toHaveLength(MAX_NEIGHBORS);
  });
  it('목록이 없어도 빈 배열', () => {
    expect(pickNeighbors(null, 'ME', null)).toEqual([]);
  });
});

describe('layoutNeighbors', () => {
  it('기록 수만큼 탑 — 한 탑이 차면 다음 탑', () => {
    const cap = NEIGHBOR_SHELF.capacity;
    expect(neighborTowerCount(1)).toBe(1);
    expect(neighborTowerCount(cap)).toBe(1);
    expect(neighborTowerCount(cap + 1)).toBe(2);
    expect(neighborTowerCount(0)).toBe(1);
  });
  it('한 사람의 탑은 같은 쪽에 이어지고, 다음 사람은 더 짧은 쪽에 — 통로 바깥에서 통로 쪽을 봄', () => {
    const cap = NEIGHBOR_SHELF.capacity;
    const { blocks, endZ } = layoutNeighbors([cap * 3, 5, 5]);
    const [a, b, c] = blocks;
    expect(a.towers).toHaveLength(3);
    expect(new Set(a.towers.map((t) => t.x)).size).toBe(1);
    expect(a.towers[1].z).toBeLessThan(a.towers[0].z);
    expect(a.towers[0].x).toBeLessThan(-5);
    expect(Math.sin(a.towers[0].facing)).toBeGreaterThan(0.9);
    expect(b.side).toBe(-a.side); // 긴 묶음 맞은편
    expect(c.side).toBe(b.side); // 그쪽이 아직 더 짧음
    expect(c.towers[0].z).toBeLessThan(b.towers[0].z);
    expect(endZ).toBeLessThan(Math.min(...blocks.flatMap((x) => x.towers.map((t) => t.z))));
  });
  it('탑 높이는 기록이 차는 만큼(최소 2줄), 탑이 여럿이면 다 채운 높이', () => {
    const { perRow, capacity, rows } = NEIGHBOR_SHELF;
    const [one, three, many] = layoutNeighbors([1, perRow * 2 + 1, capacity + 1]).blocks;
    expect(one.rows).toBe(2);
    expect(three.rows).toBe(3);
    expect(many.rows).toBe(rows);
  });
  it('자리: 아랫줄부터, 한 줄이 차면 윗줄', () => {
    const t = layoutNeighbors([3]).blocks[0].towers[0];
    expect(neighborSlot(t, NEIGHBOR_SHELF.perRow).y).toBeGreaterThan(neighborSlot(t, 0).y);
    expect(neighborSlot(t, 1).y).toBe(neighborSlot(t, 0).y);
  });
});
