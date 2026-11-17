// 세부 기록(js/library/modal/detailFields.js)과 카드 뒷면 요약(cardsView.js의 detailHtml).
import { describe, expect, it } from 'vitest';
import { detailSummary, ASPECTS, GENRES } from '../../js/library/modal/detailFields.js';
import { detailHtml } from '../../js/library/list/cardsView.js';

describe('detailSummary', () => {
  it('카테고리 순서대로 매긴 요소만, 그 카테고리 장르만', () => {
    const d = detailSummary('anime', { scores: { ending: 4, story: 4.5, acting: 3 }, genres: ['판타지', '소설'] });
    expect(d.scores).toEqual([['스토리', 4.5], ['결말', 4]]);
    expect(d.genres).toEqual(['판타지']);
  });

  it('음악·빈 값은 null', () => {
    expect(detailSummary('music', { scores: { story: 3 } })).toBeNull();
    expect(detailSummary('book', { scores: {}, genres: [] })).toBeNull();
    expect(detailSummary('book', null)).toBeNull();
  });

  it('백엔드와 같은 목록 — 책은 결말만, 장르는 12개씩', () => {
    expect(ASPECTS.book.map(([k]) => k)).toEqual(['ending']);
    Object.values(GENRES).forEach((list) => expect(list).toHaveLength(12));
  });
});

describe('detailHtml', () => {
  it('요소별 별점과 장르 태그, 없으면 빈 문자열', () => {
    const html = detailHtml({ cat: 'movie', details: { scores: { story: 5, visual: 3.5 }, genres: ['범죄'] } });
    expect(html).toContain('<span>스토리</span><b>★5</b>');
    expect(html).toContain('<b>★3.5</b>');
    expect(html).toContain('<span class="genre">범죄</span>');
    expect(detailHtml({ cat: 'movie' })).toBe('');
  });
});
