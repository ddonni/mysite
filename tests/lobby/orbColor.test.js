// 구슬 색(js/lobby/archive/orbColor.js) — 표지 픽셀에서 선명한 색을 고르고 빛나게 다듬는지.
import { describe, expect, it } from 'vitest';
import { vibrantColor, glowify, catGlow } from '../../js/lobby/archive/orbColor.js';

const px = (...colors) => new Uint8ClampedArray(colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));

describe('vibrantColor', () => {
  it('칙칙한 배경보다 선명한 색 쪽으로 기움', () => {
    const grey = [90, 90, 90];
    const red = [220, 30, 30];
    const [r, g, b] = vibrantColor(px(grey, grey, grey, red));
    expect(r).toBeGreaterThan(g * 1.5);
    expect(r).toBeGreaterThan(b * 1.5);
  });
  it('투명한 픽셀은 빼고, 다 투명하면 null', () => {
    expect(vibrantColor(px([255, 0, 0, 0]))).toBeNull();
  });
});

describe('glowify', () => {
  it('흑백 표지는 밝은 은빛', () => {
    const [r, g, b] = glowify([0.1, 0.1, 0.1]);
    expect(r).toBeCloseTo(g, 2);
    expect(g).toBeCloseTo(b, 2);
    expect(r).toBeGreaterThan(0.7);
  });
  it('어두운 색도 빛나는 밝기로 끌어올림', () => {
    const c = glowify([0.2, 0.05, 0.3]);
    expect(Math.max(...c)).toBeGreaterThan(0.75);
  });
});

it('표지가 없으면 카테고리 색(모르는 카테고리도 색은 있음)', () => {
  expect(catGlow('music')).toHaveLength(3);
  expect(catGlow('nope')).toHaveLength(3);
});
