// 최애음악 카드의 "▶ 재생" 버튼 — 지금 안 돌고 있는 음악 카드에만 붙고, 누르면
// 상세 창(onOpen)을 거치지 않고 바로 onPlay가 불리는지.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderCards } from '../../../js/library/list/cardsView.js';

const song = (id) => ({ id, cat: 'music', title: `곡${id}`, rating: 0, featured: true });

let grid;
beforeEach(() => {
  document.body.innerHTML = '<div id="g"></div>';
  grid = document.getElementById('g');
});

describe('▶ 재생 버튼', () => {
  it('돌고 있는 곡엔 없고, 나머지 최애음악엔 있음', () => {
    renderCards(grid, [song(1), song(2), song(3)], { onOpen: () => {}, playingId: 1, onPlay: () => {} });
    const playable = [...grid.querySelectorAll('.play-btn')].map((b) => b.closest('.card-wrap').querySelector('.card-title').textContent);
    expect(playable).toEqual(['곡2', '곡3']);
  });

  it('누르면 상세 창 없이 바로 onPlay(곡)', () => {
    const onOpen = vi.fn();
    const onPlay = vi.fn();
    const items = [song(1), song(2)];
    renderCards(grid, items, { onOpen, playingId: 1, onPlay });
    grid.querySelector('.play-btn').click();
    expect(onPlay).toHaveBeenCalledWith(items[1]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('onPlay를 안 주면(남의 방, 다른 목록) 버튼 없음', () => {
    renderCards(grid, [song(1), song(2)], { onOpen: () => {}, playingId: 1 });
    expect(grid.querySelector('.play-btn')).toBeNull();
  });

  it('음악이 아닌 카드엔 버튼 없음', () => {
    renderCards(grid, [{ id: 5, cat: 'book', title: '책', rating: 0 }], { onOpen: () => {}, onPlay: () => {} });
    expect(grid.querySelector('.play-btn')).toBeNull();
  });
});
