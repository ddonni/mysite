// 옷·일기(2026-11-20) — 칩(작품만·옷·일기는 내 기록에만), 칩별 거르기, 일기 제목이 비었을 때의 이름,
// 카드 앞뒤에 옷 속성·일기 본문이 나오고 인생작 별은 없는지.
import { beforeEach, describe, expect, it } from 'vitest';
import { itemsForTab, sortForGrid, tabsFor } from '../../../js/library/list.js';
import { displayTitle, koreanDate, typeText } from '../../../js/library/list/itemFormat.js';
import { renderCards } from '../../../js/library/list/cardsView.js';

const items = [
  { id: 1, cat: 'book', title: '데미안', date: '2026-11-01' },
  { id: 2, cat: 'clothes', title: '셔츠', date: '2026-11-10', photo_url: 'https://x/s.jpg', creator: '유니클로',
    attrs: { kind: '상의', color: '네이비', seasons: ['봄', '가을'], tags: ['기본'], purchased: '2026-03-02' } },
  { id: 3, cat: 'diary', title: '', memo: '눈이 왔다\n추웠다', date: '2026-11-19' },
  { id: 4, cat: 'music', title: '노래', date: '2026-11-15' },
];

describe('칩', () => {
  it('내 기록: 전체 · 작품만 · 작품 넷 · 옷 · 일기, 남의 기록: 전체 · 작품 넷', () => {
    expect(tabsFor(false).map((t) => t.key)).toEqual(['all', 'works', 'book', 'anime', 'movie', 'music', 'clothes', 'diary']);
    expect(tabsFor(true).map((t) => t.key)).toEqual(['all', 'book', 'anime', 'movie', 'music']);
  });

  it('전체는 옷·일기까지 날짜순으로 섞고, 작품만은 옷·일기를 뺌', () => {
    expect(sortForGrid(itemsForTab(items, 'all')).map((i) => i.id)).toEqual([3, 4, 2, 1]);
    expect(itemsForTab(items, 'works').map((i) => i.id)).toEqual([1, 4]);
    expect(itemsForTab(items, 'diary').map((i) => i.id)).toEqual([3]);
  });
});

describe('일기·옷 이름', () => {
  it('제목 없는 일기는 날짜로, 옷은 종류를 붙임', () => {
    const now = new Date(2026, 10, 20);
    expect(koreanDate('2026-11-19', now)).toBe('11월 19일');
    expect(koreanDate('2025-01-02', now)).toBe('2025년 1월 2일');
    expect(displayTitle({ cat: 'diary', title: ' ', date: `${now.getFullYear()}-11-19` })).toBe('11월 19일의 일기');
    expect(displayTitle({ cat: 'diary', title: '첫눈', date: '2026-11-19' })).toBe('첫눈');
    expect(typeText(items[1])).toBe('옷 · 상의');
  });
});

describe('카드', () => {
  let grid;
  beforeEach(() => {
    document.body.innerHTML = '<div id="g"></div>';
    grid = document.getElementById('g');
  });
  const noop = () => {};

  it('옷 카드 뒷면에 속성·태그·브랜드, 인생작 별은 없음', () => {
    renderCards(grid, [items[1]], { onEdit: noop, onDelete: noop, onFeature: noop });
    const back = grid.querySelector('.back');
    expect(back.querySelector('.clothes-back').textContent).toContain('봄·가을');
    expect(back.querySelector('.bought').textContent).toBe('2026.03.02 구매');
    expect(back.textContent).toContain('#기본');
    expect(back.querySelector('.back-creator').textContent).toBe('유니클로');
    expect(back.querySelector('.feat-btn')).toBeNull();
    expect(back.querySelector('[data-act="edit"]')).not.toBeNull();
  });

  it('사진 없는 일기는 공책 표지에 본문, 뒷면에 본문 전체', () => {
    renderCards(grid, [items[2]], { onEdit: noop, onDelete: noop, onFeature: noop });
    expect(grid.querySelector('.cover.diary-note .dn-text').textContent).toContain('눈이 왔다');
    expect(grid.querySelector('.diary-body').textContent).toBe('눈이 왔다\n추웠다');
    expect(grid.querySelector('.feat-btn')).toBeNull();
  });

  it('사진이 여러 장인 일기는 뒷면에 작은 사진 줄(4장 + 남은 수)', () => {
    const photos = Array.from({ length: 6 }, (_, i) => `https://x/${i}.jpg`);
    renderCards(grid, [{ ...items[2], photos, photo_url: photos[0] }], { onEdit: noop, onDelete: noop, onFeature: noop });
    expect(grid.querySelectorAll('.diary-strip img')).toHaveLength(4);
    expect(grid.querySelector('.diary-strip span').textContent).toBe('+2');
  });
});
