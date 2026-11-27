// "내 방" 보기 — 두 벽(왼쪽은 옷장 앞을 뺀 부분)에 작품·음악·?!를 걸고, 작품 수에 맞춰 사진 크기를 정하고, 넘치면
// 오른쪽 벽을 옆으로 스크롤. 방 전체가 화면 안에, 작품을 누르면 큰 카드.
import { describe, expect, it, vi } from 'vitest';
import { layoutWalls, renderRoom, roomItems, roomSize } from '../../../js/library/list/roomView.js';
import { createCardDialog } from '../../../js/library/list/compactViews.js';

const items = [
  { id: 1, cat: 'book', title: '데미안', photo_url: 'https://example.com/a.jpg' },
  { id: 2, cat: 'anime', title: '진격의 거인' },
  { id: 3, cat: 'movie', title: '기생충' },
  { id: 4, cat: 'music', title: 'Ditto', photo_url: 'https://example.com/m.jpg' },
  { id: 5, cat: 'note', title: '', memo: '오이 싫음' },
  { id: 6, cat: 'note', title: '', memo: null, listen_url: 'https://youtu.be/dQw4w9WgXcQ' },
];

describe('내 방', () => {
  it('벽에는 작품 넷 + ?! 전부', () => {
    expect(roomItems(items).map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('두 벽에 나눠 걺 — 다 들어가고, 적으면 크게, 두 벽 다 씀', () => {
    const opts = { leftW: 400, rightW: 800, h: 400 };
    const few = layoutWalls(6, opts);
    const many = layoutWalls(60, opts);
    for (const lay of [few, many]) {
      expect(lay.left.count + lay.right.count).toBe(lay === few ? 6 : 60);
      expect(lay.left.count).toBeGreaterThan(0);
      expect(lay.right.count).toBeGreaterThan(0);
      expect(lay.scroll).toBe(false);
      expect(lay.right.w).toBeLessThanOrEqual(800);
      expect(lay.left.w).toBeLessThanOrEqual(400);
    }
    expect(few.tw).toBeGreaterThan(many.tw);
  });

  it('최소 크기보다 작아져야 다 들어가면 그 크기로 두고, 왼쪽 벽은 꽉 채우고 나머지는 오른쪽 벽을 옆으로', () => {
    const lay = layoutWalls(300, { leftW: 400, rightW: 800, h: 400, minW: 60 });
    expect(lay.tw).toBe(60);
    expect(lay.scroll).toBe(true);
    expect(lay.left.count + lay.right.count).toBe(300);
    expect(lay.left.w).toBeLessThanOrEqual(400);
    expect(lay.right.w).toBeGreaterThan(800);
  });

  it('방 전체가 화면 안에 — 넓은 화면은 세로에 맞춰 줄이고, 세로로 긴 화면은 폭을 채우고 벽을 높임', () => {
    const wide = roomSize(1300, 600);
    expect(wide.viewH).toBeCloseTo(600, 0);
    expect(wide.L * Math.SQRT2).toBeLessThan(1300);
    const tall = roomSize(390, 700);
    expect(tall.H).toBeGreaterThan(tall.L);
    expect(tall.viewH).toBeLessThanOrEqual(700);
    expect(tall.L * Math.SQRT2).toBeCloseTo(390 * 0.98, 0);
  });

  it('작품마다 벽에 한 칸(두 벽 합쳐서), 음악은 표지·?! 영상은 썸네일·글은 글, 누르면 onOpen', () => {
    document.body.innerHTML = '<div id="g"></div>';
    const g = document.getElementById('g');
    const onOpen = vi.fn();
    renderRoom(g, items, { onOpen });
    const tiles = [...g.querySelectorAll('.rv-work')];
    expect(tiles.length).toBe(6);
    expect(g.querySelectorAll('.rv-gallery-left .rv-work').length).toBeGreaterThan(0);
    expect(g.querySelectorAll('.rv-gallery-right .rv-work').length).toBeGreaterThan(0);
    const tileOf = (id) => tiles.find((t) => t.dataset.id === String(id));
    expect(tileOf(4).querySelector('img').getAttribute('src')).toContain('example.com/m.jpg');
    expect(tileOf(6).querySelector('img').getAttribute('src')).toContain('i.ytimg.com/vi/dQw4w9WgXcQ');
    expect(tileOf(5).querySelector('.rv-title').textContent).toBe('오이 싫음');
    expect(g.querySelectorAll('.rv-wardrobe, .rv-bed').length).toBe(2);
    tileOf(2).click();
    // 두 번째 인자 = 벽에 걸린 순서(왼쪽 벽 → 오른쪽 벽) — 큰 카드에서 옆 작품으로 넘길 때
    const [opened, order] = onOpen.mock.calls[0];
    expect(opened).toBe(items[1]);
    expect(order.map((i) => i.id).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('오른쪽 벽이 넘치면 그 벽 위에서 휠을 굴리면 옆으로 — 끝에서 멈추고 페이지는 안 내려감, 벽 밖에선 그대로', () => {
    document.body.innerHTML = '<div id="g"></div>';
    const g = document.getElementById('g');
    const many = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, cat: 'book', title: `책${i + 1}` }));
    renderRoom(g, many, {});
    expect(g.querySelectorAll('.rv-work').length).toBe(300);
    const surface = g.querySelector('.room-view.scroll');
    const gallery = g.querySelector('.rv-gallery-right');
    const track = gallery.querySelector('.rv-track');
    const wheel = (deltaY) => surface.dispatchEvent(new WheelEvent('wheel', { deltaY, cancelable: true }));
    const outside = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    surface.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
    expect(track.style.transform).toBe('');
    gallery.dispatchEvent(new Event('pointerenter'));
    wheel(120);
    expect(track.style.transform).toBe('translateX(-120px)');
    wheel(-500);
    expect(track.style.transform).toBe('translateX(0px)');
    wheel(1e7);
    expect(track.style.transform).not.toBe('translateX(-10000000px)');
    const e = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    surface.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('큰 카드 — 옆 작품으로 넘기기', () => {
  const mount = () => {
    document.body.innerHTML = '<div id="cardDialog" hidden><button class="card-dialog-close"></button><div class="card-dialog-slot"></div></div>';
    return createCardDialog({ onEdit() {}, onDelete() {}, readOnly: false });
  };
  const title = () => document.querySelector('#cardDialog .card-title').textContent;
  const seq = [
    { id: 1, cat: 'book', title: '첫째' },
    { id: 2, cat: 'movie', title: '둘째' },
    { id: 3, cat: 'note', title: '', memo: '셋째 글' },
  ];

  it('벽에서 열면 앞면부터, 화살표 버튼·←/→로 옆 작품, 끝에서는 처음으로', () => {
    const dialog = mount();
    dialog.open(seq[1], { front: true, list: seq });
    expect(document.querySelector('#cardDialog .card').getAttribute('aria-pressed')).toBe('false');
    expect(title()).toBe('둘째');
    document.querySelector('.card-dialog-nav.next').click();
    expect(title()).toBe('셋째 글');
    document.querySelector('.card-dialog-nav.next').click();
    expect(title()).toBe('첫째');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(title()).toBe('셋째 글');
  });

  it('순서 없이 열면(촘촘히·목록) 화살표가 없고 뒷면부터', () => {
    const dialog = mount();
    dialog.open(seq[0]);
    expect(document.querySelector('.card-dialog-nav.next').hidden).toBe(true);
    expect(document.querySelector('#cardDialog .card').getAttribute('aria-pressed')).toBe('true');
  });
});
