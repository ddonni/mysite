// pickShowcase는 로비 가구의 인생작 자리(카테고리마다 3개)를 고르는 순수
// 함수 — 별표가 우선이고, 모자라면 최신 기록으로 채우고, 나머지는 rest로.
import { describe, expect, it } from 'vitest';
import { pickShowcase, pickMusic } from '../../js/lobby/showcase.js';

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

  it('fill: false면 별표 고른 것만 top, 나머지는 전부 rest', () => {
    const list = [rec(1, 'movie'), rec(2, 'movie', true), rec(3, 'movie')];
    const { top, rest } = pickShowcase(list, 'movie', { fill: false });
    expect(top.map((r) => r.id)).toEqual([2]);
    expect(rest.map((r) => r.id)).toEqual([1, 3]);
    const noStar = pickShowcase([rec(1, 'anime')], 'anime', { fill: false });
    expect(noStar.top).toEqual([]);
    expect(noStar.rest.map((r) => r.id)).toEqual([1]);
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

// pickMusic은 레코드 콘솔 배치 — 콘솔 위(턴테이블 + 옆 받침)는 최애음악만,
// 칸 안은 나머지. 기록 보관소의 "재생 중" 표시도 같은 함수를 씀.
describe('pickMusic', () => {
  const ids = (list) => list.map((r) => r.id);

  it('최애음악 중 가장 최근 것이 턴테이블, 나머지 최애음악은 받침, 그 밖은 칸 안(최신순)', () => {
    const list = [rec(1, 'music'), rec(2, 'music', true), rec(3, 'music'), rec(4, 'music', true), rec(5, 'book', true)];
    const { playing, picks, rest } = pickMusic(list);
    expect(playing.id).toBe(2);
    expect(ids(picks)).toEqual([4]);
    expect(ids(rest)).toEqual([1, 3]);
  });

  it('최애음악이 없으면 가장 최근 곡이 턴테이블에서 돌고, 받침은 비어 있음', () => {
    const { playing, picks, rest } = pickMusic([rec(1, 'music'), rec(2, 'music')]);
    expect(playing.id).toBe(1);
    expect(picks).toEqual([]);
    expect(ids(rest)).toEqual([2]);
  });

  it('음악 기록이 없으면 턴테이블도 비어 있음', () => {
    expect(pickMusic([rec(1, 'book')])).toEqual({ playing: null, picks: [], rest: [] });
    expect(pickMusic(null)).toEqual({ playing: null, picks: [], rest: [] });
  });
});
