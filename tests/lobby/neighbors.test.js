// 이웃 서가(js/lobby/archive/neighbors.js) — 누구를 어떤 순서로 바깥 서가에 놓는지, 자리 규칙.
import { describe, expect, it } from 'vitest';
import { pickNeighbors, neighborPlacement, neighborsEndZ, MAX_NEIGHBORS } from '../../js/lobby/archive/neighbors.js';

const room = (code, n = 3) => ({ code, name: code, featured: Array.from({ length: n }, (_, i) => ({ id: i, cat: 'book', title: 't' })) });

describe('pickNeighbors', () => {
  it('내 방과 인생작 없는 방은 빼고, 받은 순서(최근 활동순) 그대로', () => {
    const list = pickNeighbors([room('A'), room('ME'), room('B', 0), room('C')], 'ME', null);
    expect(list.map((r) => r.code)).toEqual(['A', 'C']);
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

describe('neighborPlacement', () => {
  it('왼쪽·오른쪽 번갈아 통로 바깥, 통로 쪽을 보고, 안쪽으로 갈수록 z가 작아짐', () => {
    const a = neighborPlacement(0), b = neighborPlacement(1), c = neighborPlacement(2);
    expect(a.x).toBeLessThan(-5);
    expect(b.x).toBeGreaterThan(5);
    expect(Math.sin(a.facing)).toBeGreaterThan(0.9);
    expect(Math.sin(b.facing)).toBeLessThan(-0.9);
    expect(c.z).toBeLessThan(a.z);
    expect(neighborsEndZ(3)).toBeLessThan(c.z);
  });
});
