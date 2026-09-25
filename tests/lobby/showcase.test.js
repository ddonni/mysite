// pickShowcase는 로비 가구의 대표작 자리(카테고리마다 3개)를 고르는 순수
// 함수 — 별표가 우선이고, 모자라면 최신 기록으로 채우고, 나머지는 rest로.
import { describe, expect, it } from 'vitest';
import { pickShowcase } from '../../js/lobby/showcase.js';

// 서버 응답처럼 이미 최신순으로 정렬된 목록.
const rec = (id, cat, featured = false) => ({ id, cat, title: `t${id}`, featured });

describe('pickShowcase', () => {
  it('별표가 없으면 최신 3개가 top, 나머지는 rest(최신순 유지)', () => {
    const list = [1, 2, 3, 4, 5].map((i) => rec(i, 'movie'));
    const { top, rest } = pickShowcase(list, 'movie');
    expect(top.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(rest.map((r) => r.id)).toEqual([4, 5]);
  });

  it('별표 켜진 기록이 최신이 아니어도 top 앞자리에 오고, 빈자리는 최신으로 채움', () => {
    const list = [rec(1, 'book'), rec(2, 'book'), rec(3, 'book'), rec(4, 'book', true)];
    const { top, rest } = pickShowcase(list, 'book');
    expect(top.map((r) => r.id)).toEqual([4, 1, 2]);
    expect(rest.map((r) => r.id)).toEqual([3]);
  });

  it('다른 카테고리 기록은 섞이지 않음', () => {
    const list = [rec(1, 'anime'), rec(2, 'movie', true), rec(3, 'anime')];
    const { top, rest } = pickShowcase(list, 'anime');
    expect(top.map((r) => r.id)).toEqual([1, 3]);
    expect(rest).toEqual([]);
  });

  it('기록이 없으면 둘 다 빈 배열(가구는 빈 자리 그대로)', () => {
    expect(pickShowcase([], 'book')).toEqual({ top: [], rest: [] });
    expect(pickShowcase(null, 'book')).toEqual({ top: [], rest: [] });
  });
});
