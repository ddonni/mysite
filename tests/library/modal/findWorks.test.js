// 검색어 → 작품 후보(새 기록 창 검색 화면). 검색 API(records.js)는 가짜로 바꿔 끼움.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../js/library/records.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchBooks: vi.fn(),
  searchMusic: vi.fn(),
  searchScreen: vi.fn(),
}));

const records = await import('../../../js/library/records.js');
const { findWorks, isRecorded } = await import('../../../js/library/modal/findWorks.js');

beforeEach(() => vi.clearAllMocks());

const book = (title, creator) => ({ title, full_title: title, creator, publisher: '민음사', year: '2000', cover: `https://t1.daumcdn.net/${title}.jpg` });

describe('findWorks', () => {
  it('영화 탭의 드라마·시리즈(TV)는 설명에 "시리즈"', async () => {
    records.searchScreen
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 3, media: 'tv', title: '기묘한 이야기', original_title: 'Stranger Things', year: '2016', cover: 's' }]);
    const [c] = await findWorks('movie', '기묘한 이야기');
    expect(c.meta).toBe('Stranger Things · 2016 · 시리즈');
    expect(c.screen).toEqual({ media: 'tv', id: 3 }); // 감독(시리즈 연출)은 고를 때 물어봄
  });

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

  it('음악 — 같은 제목을 여러 가수가 냈으면 가수마다 한 줄, 비슷한 가수의 다른 노래는 뺌', async () => {
    records.searchMusic
      // by=songs: "넋두리"와 비슷한 가수로 닐로를 골라 옴
      .mockResolvedValueOnce([
        { album: '이별 편지', song: '이별 편지', creator: '닐로', kind: '노래', year: '', cover: 'a' },
        { album: '넋두리', song: '넋두리', creator: '닐로', kind: '노래', year: '', cover: 'n' },
      ])
      .mockResolvedValueOnce([
        { album: 'Stand Alone', song: null, creator: '하동균', kind: '', year: '', cover: 'h' }, // iTunes로 찾은 앨범
        { album: '넋두리', song: null, creator: '닐로', kind: '', year: '', cover: 'n' },
        { album: '넋두리', song: null, creator: 'hwan', kind: '싱글', year: '', cover: 'w' },
        { album: '이윤수의 사랑넋두리', song: null, creator: '이윤수', kind: '앨범', year: '', cover: 'y' },
      ]);
    const found = await findWorks('music', '넋두리');
    expect(found.map((c) => `${c.title}|${c.creator}`)).toEqual(['넋두리|하동균', '넋두리|닐로', '넋두리|hwan']);
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

describe('isRecorded', () => {
  it('같은 카테고리에 같은 제목(띄어쓰기·대소문자 무시)이 있으면 이미 기록함', () => {
    const items = [{ cat: 'book', title: '어린 왕자' }, { cat: 'movie', title: 'Dune' }];
    expect(isRecorded(items, 'book', '어린왕자')).toBe(true);
    expect(isRecorded(items, 'movie', 'dune')).toBe(true);
    expect(isRecorded(items, 'book', 'Dune')).toBe(false);
  });
});
