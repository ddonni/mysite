// 3D 도서관에서 꺼내 본 기록의 옆 기록 — 서가 순서대로, 그 사람 기록 안에서만, 끝에서 처음으로.
import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../js/lobby/memoryStep.js';

describe('stepIndex', () => {
  it('옆으로 한 칸, 끝에서 처음으로(앞으로 가면 끝으로)', () => {
    const all = () => true;
    expect(stepIndex(1, 1, 4, all)).toBe(2);
    expect(stepIndex(3, 1, 4, all)).toBe(0);
    expect(stepIndex(0, -1, 4, all)).toBe(3);
  });

  it('그 사람 기록만 — 다른 방 기록은 건너뜀', () => {
    const owner = ['A', 'A', 'B', 'B', 'A', 'C'];
    const ofA = (k) => owner[k] === 'A';
    expect(stepIndex(1, 1, owner.length, ofA)).toBe(4);
    expect(stepIndex(4, 1, owner.length, ofA)).toBe(0);
    expect(stepIndex(0, -1, owner.length, ofA)).toBe(4);
    const ofB = (k) => owner[k] === 'B';
    expect(stepIndex(3, 1, owner.length, ofB)).toBe(2);
  });

  it('갈 데가 없으면 null', () => {
    expect(stepIndex(0, 1, 1, () => true)).toBe(null);
    expect(stepIndex(2, 1, 3, (k) => k === 2)).toBe(null);
  });
});
