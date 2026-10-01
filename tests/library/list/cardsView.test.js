// 최애음악 카드의 재생 표시 — 표지 왼쪽 위 한 자리에서 상태만 바뀌는지(돌고 있는
// 곡은 "▶ 재생 중", 나머지는 누를 수 있는 "▶ 재생"), 오른쪽 위 "재생 중" 배지와
// 겹쳐 두 번 나오지 않는지, 누르면 상세 창(onOpen)을 거치지 않고 바로 onPlay가
// 불리는지.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderCards } from '../../../js/library/list/cardsView.js';

const song = (id) => ({ id, cat: 'music', title: `곡${id}`, rating: 0, featured: true });

let grid;
beforeEach(() => {
  document.body.innerHTML = '<div id="g"></div>';
  grid = document.getElementById('g');
});

const toggles = () => [...grid.querySelectorAll('.play-btn')].map((el) => ({
  title: el.closest('.card-wrap').querySelector('.card-title').textContent,
  text: el.textContent,
  button: el.tagName === 'BUTTON',
}));

describe('최애음악 재생 표시', () => {
  it('모든 곡이 같은 자리에 표시를 갖고, 돌고 있는 곡만 "재생 중"(누를 수 없음)', () => {
    renderCards(grid, [song(1), song(2), song(3)], { onOpen: () => {}, playingId: 2, onPlay: () => {} });
    expect(toggles()).toEqual([
      { title: '곡1', text: '▶ 재생', button: true },
      { title: '곡2', text: '▶ 재생 중', button: false },
      { title: '곡3', text: '▶ 재생', button: true },
    ]);
  });

  it('오른쪽 위 "재생 중" 배지는 빼서 두 번 나오지 않음', () => {
    renderCards(grid, [song(1)], { onOpen: () => {}, playingId: 1, onPlay: () => {} });
    expect(grid.querySelector('.badge.playing')).toBeNull();
  });

  it('누르면 상세 창 없이 바로 onPlay(곡)', () => {
    const onOpen = vi.fn();
    const onPlay = vi.fn();
    const items = [song(1), song(2)];
    renderCards(grid, items, { onOpen, playingId: 1, onPlay });
    grid.querySelector('button.play-btn').click();
    expect(onPlay).toHaveBeenCalledWith(items[1]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('onPlay를 안 주면(남의 방, 아래 전체 목록) 표시 없이 기존 "재생 중" 배지 그대로', () => {
    renderCards(grid, [song(1), song(2)], { onOpen: () => {}, playingId: 1 });
    expect(grid.querySelector('.play-btn')).toBeNull();
    expect(grid.querySelector('.badge.playing')).not.toBeNull();
  });

  it('음악이 아닌 카드엔 표시 없음', () => {
    renderCards(grid, [{ id: 5, cat: 'book', title: '책', rating: 0 }], { onOpen: () => {}, onPlay: () => {} });
    expect(grid.querySelector('.play-btn')).toBeNull();
  });
});
