// 기록 카드(뒤집는 카드) — 카드를 누르면 뒤집히기만 하고, 뒷면의 "자세히"로 상세 창
// (onOpen)이 열리는지, 인생작이 황금 카드(.rare)가 되는지, 음악의 "▶ 듣기"를 눌러도
// 카드가 뒤집히지 않는지, 카드 순서(인생작 먼저 → 최신순).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderCards } from '../../../js/library/list/cardsView.js';
import { sortForGrid } from '../../../js/library/list.js';

const song = (id, extra = {}) => ({ id, cat: 'music', title: `곡${id}`, rating: 0, featured: true, ...extra });
const book = (id, extra = {}) => ({ id, cat: 'book', title: `책${id}`, rating: 4.5, ...extra });

let grid;
beforeEach(() => {
  document.body.innerHTML = '<div id="g"></div>';
  grid = document.getElementById('g');
});

const cardOf = (title) => [...grid.querySelectorAll('.card')].find((c) => c.querySelector('.card-title').textContent === title);

describe('카드 뒤집기', () => {
  it('카드를 누르면 뒤집히고(aria-pressed), 다시 누르면 앞면으로 — 상세 창은 안 뜸', () => {
    const onOpen = vi.fn();
    renderCards(grid, [book(1)], { onOpen });
    const card = cardOf('책1');
    expect(card.getAttribute('aria-pressed')).toBe('false');
    card.click();
    expect(card.getAttribute('aria-pressed')).toBe('true');
    card.click();
    expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('뒷면의 "자세히"는 상세 창(onOpen)을 열고 카드는 그대로 둠', () => {
    const onOpen = vi.fn();
    const items = [book(1)];
    renderCards(grid, items, { onOpen });
    grid.querySelector('[data-act="open"]').click();
    expect(onOpen).toHaveBeenCalledWith(items[0]);
    expect(cardOf('책1').getAttribute('aria-pressed')).toBe('false');
  });

  it('뒷면에 한 줄 감상 — 없으면 안내 문구', () => {
    renderCards(grid, [book(1, { memo: '좋았다' }), book(2)], { onOpen: () => {} });
    expect(cardOf('책1').querySelector('.back .q').textContent).toBe('“좋았다”');
    expect(cardOf('책2').querySelector('.back .q').textContent).toBe('아직 감상을 적지 않았어요.');
  });

  it('인생작만 황금 카드(.rare + 홀로그램 빛), 뒷면 종류 옆에 인생책', () => {
    renderCards(grid, [book(1, { featured: true }), book(2)], { onOpen: () => {} });
    const [rare, plain] = grid.querySelectorAll('.slot');
    expect(rare.classList.contains('rare')).toBe(true);
    expect(rare.querySelector('.cover .foil')).not.toBeNull();
    expect(rare.querySelector('.back .type').textContent).toBe('책 · 인생책');
    expect(plain.classList.contains('rare')).toBe(false);
    expect(plain.querySelector('.foil')).toBeNull();
  });

  it('비어 있으면 안내 한 줄만', () => {
    expect(renderCards(grid, [], { onOpen: () => {}, emptyText: '없음' })).toEqual([]);
    expect(grid.querySelector('.empty').textContent).toBe('없음');
  });
});

describe('음악 카드', () => {
  it('유튜브 링크가 있는 곡만 뒷면에 "▶ 듣기" → onListen', () => {
    const onListen = vi.fn();
    const items = [song(1, { listen_url: 'https://youtu.be/x' }), song(2)];
    renderCards(grid, items, { onOpen: () => {}, onListen });
    expect(grid.querySelectorAll('[data-act="listen"]').length).toBe(1);
    grid.querySelector('[data-act="listen"]').click();
    expect(onListen).toHaveBeenCalledWith(items[0]);
    expect(cardOf('곡1').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('카드 순서', () => {
  it('인생작이 앞에, 그다음은 최신순', () => {
    const list = [
      book(1, { date: '2026-01-01' }),
      book(2, { date: '2026-03-01' }),
      book(3, { date: '2025-12-01', featured: true }),
      book(4, { date: '2026-02-01', featured: true }),
    ];
    expect(sortForGrid(list).map((i) => i.id)).toEqual([4, 3, 2, 1]);
  });
});
