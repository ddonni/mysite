// 줄 하나 → 검색 후보, 고른 후보 → 저장할 기록. 검색 API(records.js)는 가짜로 바꿔 끼움.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../js/library/records.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchBooks: vi.fn(),
  searchMusic: vi.fn(),
  searchScreen: vi.fn(),
}));

const records = await import('../../../js/library/records.js');
const { findCandidates, findWorks, isRecorded, toRecord, mapLimit } = await import('../../../js/library/bulk/match.js');

beforeEach(() => vi.clearAllMocks());

const book = (title, creator) => ({ title, full_title: title, creator, publisher: '민음사', year: '2000', cover: `https://t1.daumcdn.net/${title}.jpg` });

describe('findCandidates', () => {
  it('책: 작가가 있으면 "제목 작가"로 찾고, 0건이면 제목만으로 다시 찾음', async () => {
    records.searchBooks.mockResolvedValueOnce([]).mockResolvedValueOnce([book('채식주의자', '한강')]);
    const found = await findCandidates('book', { title: '채식주의자', creator: '항강' });
    expect(records.searchBooks.mock.calls.map((c) => c[0])).toEqual(['채식주의자 항강', '채식주의자']);
    expect(found[0]).toMatchObject({ title: '채식주의자', creator: '한강', meta: '한강 · 민음사 · 2000' });
  });

  it('음악: 제목은 쓴 그대로, 가수·커버는 앨범에서', async () => {
    records.searchMusic.mockResolvedValueOnce([{ album: '원래', song: null, creator: '검정치마', kind: '앨범', year: '2011', cover: 'c' }]);
    const [c] = await findCandidates('music', { title: '나랑 아니면', creator: '' });
    expect(c).toMatchObject({ title: '나랑 아니면', creator: '검정치마', cover: 'c', label: '원래', square: true });
  });

  it('영화: 감독이 있으면 연출작에서 제목으로 거름 — 감독을 이미 알아서 따로 안 물어봄', async () => {
    records.searchScreen.mockResolvedValueOnce([
      { id: 1, media: 'movie', title: '인터스텔라', creator: '크리스토퍼 놀란', cover: 'a' },
      { id: 2, media: 'movie', title: '테넷', creator: '크리스토퍼 놀란', cover: 'b' },
    ]);
    const found = await findCandidates('movie', { title: '인터스텔라', creator: '놀란' });
    expect(records.searchScreen).toHaveBeenCalledWith('놀란', 'movie', undefined, 'director');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ title: '인터스텔라', creator: '크리스토퍼 놀란', screen: null });
  });

  it('영화: 제목 검색 결과엔 감독이 없어서 저장할 때 물어볼 정보를 남김', async () => {
    records.searchScreen.mockResolvedValueOnce([{ id: 7, media: 'tv', title: '귀멸의 칼날', cover: 'x' }]);
    const [c] = await findCandidates('anime', { title: '귀멸의 칼날', creator: '' });
    expect(c.screen).toEqual({ media: 'tv', id: 7 });
  });

  it('후보는 5개까지', async () => {
    records.searchBooks.mockResolvedValueOnce(Array.from({ length: 8 }, (_, i) => book(`책${i}`, '')));
    expect(await findCandidates('book', { title: '책', creator: '' })).toHaveLength(5);
  });

  it('검색이 실패하면 reject', async () => {
    records.searchBooks.mockRejectedValueOnce(new Error('503'));
    await expect(findCandidates('book', { title: '데미안', creator: '' })).rejects.toThrow();
  });
});

describe('findWorks', () => {
  it('책: 작가 검색 결과를 앞에, 제목 검색 결과를 뒤에 — 같은 제목(여러 판본)은 하나만', async () => {
    records.searchBooks
      .mockResolvedValueOnce([book('채식주의자', '한강'), book('채식주의자', '한강'), book('소년이 온다', '한강')])
      .mockResolvedValueOnce([book('한강', '다른 작가'), book('소년이 온다', '한강')]);
    const found = await findWorks('book', '한강');
    expect(records.searchBooks.mock.calls).toEqual([['한강', undefined, 'author'], ['한강']]);
    expect(found.map((c) => c.title)).toEqual(['채식주의자', '소년이 온다', '한강']);
  });

  it('제목으로 찾으면 이름 검색이 비어도 그 작품이 나옴', async () => {
    records.searchScreen
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, media: 'movie', title: '기생충', creator: '', cover: 'p' }]);
    const [c] = await findWorks('movie', '기생충');
    expect(records.searchScreen.mock.calls).toEqual([['기생충', 'movie', undefined, 'director'], ['기생충', 'movie']]);
    // 제목 검색 결과엔 감독이 없어서 저장할 때 물어봄
    expect(c).toMatchObject({ title: '기생충', screen: { media: 'movie', id: 1 } });
  });

  it('음악 — 가수 이름: 그 가수의 노래 목록(노래 제목으로 저장, 앨범은 설명에만)', async () => {
    const song = (s) => ({ album: 'TEAM BABY', song: s, creator: '검정치마', kind: '노래', year: '2017', cover: 'c' });
    records.searchMusic
      .mockResolvedValueOnce([song('Ling Ling'), song('나랑 아니면')])
      .mockResolvedValueOnce([{ album: 'TEAM BABY', song: null, creator: '검정치마', kind: '앨범', year: '', cover: 'c' }]);
    const found = await findWorks('music', '검정치마');
    expect(records.searchMusic.mock.calls).toEqual([['검정치마', undefined, 'songs'], ['검정치마']]);
    // 검색어가 가수 이름이라 "검정치마"라는 노래 줄은 안 만듦
    expect(found.map((c) => c.title)).toEqual(['Ling Ling', '나랑 아니면']);
    expect(found[0]).toMatchObject({ creator: '검정치마', meta: 'TEAM BABY · 2017' });
  });

  it('음악 — 노래 제목: 쓴 제목 그대로 맨 앞에(가수·커버는 제목 검색 맨 위 결과)', async () => {
    records.searchMusic
      .mockResolvedValueOnce([{ album: '밤편지', song: '밤편지', creator: '아이유(IU)', kind: '노래', year: '2017', cover: 'n' }])
      .mockResolvedValueOnce([{ album: '밤편지', song: null, creator: '아이유(IU)', kind: '싱글', year: '2017', cover: 'n' }]);
    const found = await findWorks('music', '밤편지');
    expect(found[0]).toMatchObject({ title: '밤편지', creator: '아이유(IU)', cover: 'n', meta: '아이유(IU) · 앨범 밤편지' });
    expect(found).toHaveLength(1); // 가수의 노래 목록에 있던 같은 제목은 하나로
  });

  it('한쪽이 실패해도 나머지로, 둘 다 실패하면 reject', async () => {
    records.searchBooks.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce([book('데미안', '헤르만 헤세')]);
    expect((await findWorks('book', '데미안')).map((c) => c.title)).toEqual(['데미안']);
    records.searchBooks.mockRejectedValueOnce(new Error('503')).mockRejectedValueOnce(new Error('503'));
    await expect(findWorks('book', '데미안')).rejects.toThrow();
  });
});

describe('isRecorded / toRecord', () => {
  it('같은 카테고리에 같은 제목(띄어쓰기·대소문자 무시)이 있으면 이미 기록함', () => {
    const items = [{ cat: 'book', title: '어린 왕자' }, { cat: 'movie', title: 'Dune' }];
    expect(isRecorded(items, 'book', '어린왕자')).toBe(true);
    expect(isRecorded(items, 'movie', 'dune')).toBe(true);
    expect(isRecorded(items, 'book', 'Dune')).toBe(false);
  });

  it('후보를 골랐으면 그 제목·작가·표지, 아니면 줄에 쓴 그대로(별점·감상은 비움)', () => {
    const line = { title: '채식주의자', creator: '한강' };
    expect(toRecord('book', line, { title: '채식주의자', creator: '', cover: 'c' }))
      .toEqual({ cat: 'book', title: '채식주의자', creator: '한강', rating: 0, memo: '', photo_url: 'c' });
    expect(toRecord('book', line, null))
      .toEqual({ cat: 'book', title: '채식주의자', creator: '한강', rating: 0, memo: '', photo_url: null });
  });
});

describe('mapLimit', () => {
  it('동시에 limit개까지만 돌리고 결과는 원래 순서로', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      running++; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5 - n));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });
});
