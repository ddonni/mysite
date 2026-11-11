// 로비 가구에 어떤 기록을 어디 둘지 고르는 순수 함수들.
import { describe, expect, it } from 'vitest';
import { pickShelf, pickMusic, pickWardrobe } from '../../js/lobby/showcase.js';

// 서버 응답처럼 이미 최신순으로 정렬된 목록.
const rec = (id, cat, featured = false) => ({ id, cat, title: `t${id}`, featured });

describe('pickShelf', () => {
  it('책·애니·영화를 섞어 오래된 것부터, 음악·옷장은 빼고', () => {
    const list = [rec(5, 'movie'), rec(4, 'music'), rec(3, 'anime'), rec(2, 'wardrobe'), rec(1, 'book')];
    expect(pickShelf(list).items.map((r) => r.id)).toEqual([1, 3, 5]);
  });

  it('인생작은 셋 합쳐 9개까지, 오래된 것부터', () => {
    const list = [...Array(12)].map((_, i) => rec(12 - i, ['book', 'anime', 'movie'][i % 3], true));
    const { featured } = pickShelf(list);
    expect(featured).toHaveLength(9);
    expect(featured[0].id).toBe(1);
  });

  it('기록이 없으면 빈 배열', () => {
    expect(pickShelf(null)).toEqual({ items: [], featured: [] });
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

  it('직접 고른 곡(playing)이 있으면 최애음악보다 먼저 턴테이블에서 돎', () => {
    const chosen = { ...rec(3, 'music'), playing: true };
    const { playing, picks, rest } = pickMusic([rec(1, 'music', true), rec(2, 'music', true), chosen]);
    expect(playing.id).toBe(3);
    expect(ids(picks)).toEqual([1, 2]); // 최애음악은 둘 다 받침으로
    expect(rest).toEqual([]);
  });

  it('고른 곡이 최애음악이면 받침엔 나머지 최애음악만', () => {
    const chosen = { ...rec(2, 'music', true), playing: true };
    const { playing, picks } = pickMusic([rec(1, 'music', true), chosen, rec(3, 'music', true)]);
    expect(playing.id).toBe(2);
    expect(ids(picks)).toEqual([1, 3]);
  });

  it('받침은 2자리라, 최애음악 3곡이 있는데 다른 곡을 골랐으면 셋째 최애음악은 칸 안으로', () => {
    const chosen = { ...rec(4, 'music'), playing: true };
    const { picks, rest } = pickMusic([rec(1, 'music', true), rec(2, 'music', true), rec(3, 'music', true), chosen]);
    expect(ids(picks)).toEqual([1, 2]);
    expect(ids(rest)).toEqual([3]);
  });

  it('음악 기록이 없으면 턴테이블도 비어 있음', () => {
    expect(pickMusic([rec(1, 'book')])).toEqual({ playing: null, picks: [], rest: [] });
    expect(pickMusic(null)).toEqual({ playing: null, picks: [], rest: [] });
  });
});

describe('pickWardrobe', () => {
  const w = (id, kind, featured = false) => ({ id, cat: 'wardrobe', featured, attrs: kind ? { kind } : null });

  it('최애옷 먼저, 신발·가방·액세서리는 아래칸으로', () => {
    const records = [w(1, 'top'), w(2, 'shoes'), w(3, null), w(4, 'outer', true), w(5, 'bag', true), { id: 6, cat: 'book' }];
    const { hang, shelf } = pickWardrobe(records);
    expect(hang.map((r) => r.id)).toEqual([4, 1, 3]);
    expect(shelf.map((r) => r.id)).toEqual([5, 2]);
  });

  it('봉엔 6벌, 아래칸엔 4개까지', () => {
    const records = [...Array(8)].map((_, i) => w(i, 'top')).concat([...Array(6)].map((_, i) => w(20 + i, 'acc')));
    const { hang, shelf } = pickWardrobe(records);
    expect(hang).toHaveLength(6);
    expect(shelf).toHaveLength(4);
  });
});
