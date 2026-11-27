// "내 방" 보기 — 두 벽에 작품(음악 포함)을 걸고, 작품 수에 맞춰 사진 크기를 정하고, 넘치면 오른쪽 벽을 끌어서 넘김.
// ?!는 벽이 아니라 책상 위 공책(누르면 날짜 + 내용). 방 전체가 화면 안에, 작품을 누르면 큰 카드.
import { describe, expect, it, vi } from 'vitest';
import { layoutWalls, renderRoom, roomItems, roomSize } from '../../../js/library/list/roomView.js';
import { createCardDialog } from '../../../js/library/list/compactViews.js';
import { createNotebook, noteDate, notesNewestFirst } from '../../../js/library/list/notebook.js';

const items = [
  { id: 1, cat: 'book', title: '데미안', photo_url: 'https://example.com/a.jpg' },
  { id: 2, cat: 'anime', title: '진격의 거인' },
  { id: 3, cat: 'movie', title: '기생충' },
  { id: 4, cat: 'music', title: 'Ditto', photo_url: 'https://example.com/m.jpg' },
  { id: 5, cat: 'note', title: '', memo: '오이 싫음', date: '2026-11-20' },
  { id: 6, cat: 'note', title: '', memo: null, listen_url: 'https://youtu.be/dQw4w9WgXcQ', date: '2026-11-25' },
];

describe('내 방', () => {
  it('벽에는 작품 넷(음악 포함)만 — ?!는 빼고', () => {
    expect(roomItems(items).map((i) => i.id)).toEqual([1, 2, 3, 4]);
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

  it('작품마다 벽에 한 칸(두 벽 합쳐서), 음악은 표지, 누르면 onOpen', () => {
    document.body.innerHTML = '<div id="g"></div>';
    const g = document.getElementById('g');
    const onOpen = vi.fn();
    renderRoom(g, items, { onOpen });
    const tiles = [...g.querySelectorAll('.rv-work')];
    expect(tiles.length).toBe(4);
    expect(g.querySelectorAll('.rv-gallery-left .rv-work').length).toBeGreaterThan(0);
    expect(g.querySelectorAll('.rv-gallery-right .rv-work').length).toBeGreaterThan(0);
    const tileOf = (id) => tiles.find((t) => t.dataset.id === String(id));
    expect(tileOf(4).querySelector('img').getAttribute('src')).toContain('example.com/m.jpg');
    expect(tileOf(5)).toBeUndefined();
    expect(g.querySelectorAll('.rv-wardrobe, .rv-bed, .rv-desk').length).toBe(3);
    tileOf(2).click();
    // 두 번째 인자 = 벽에 걸린 순서(왼쪽 벽 → 오른쪽 벽) — 큰 카드에서 옆 작품으로 넘길 때
    const [opened, order] = onOpen.mock.calls[0];
    expect(opened).toBe(items[1]);
    expect(order.map((i) => i.id).sort()).toEqual([1, 2, 3, 4]);
  });

  it('책상 위 공책 — ?!가 있을 때만, 누르면 onNotebook(?!들)', () => {
    document.body.innerHTML = '<div id="g"></div>';
    const g = document.getElementById('g');
    const onNotebook = vi.fn();
    renderRoom(g, items, { onNotebook });
    g.querySelector('.rv-notebook-btn').click();
    expect(onNotebook.mock.calls[0][0].map((i) => i.id)).toEqual([5, 6]);
    renderRoom(g, items.filter((i) => i.cat !== 'note'), { onNotebook });
    expect(g.querySelector('.rv-notebook')).toBeNull(); // 남의 방(?!가 안 옴) — 공책 없이 책상만
    expect(g.querySelector('.rv-desk')).not.toBeNull();
  });

  it('공책 화면 — 최신순으로 날짜와 내용, 유튜브는 누르면 onListen, 바깥·×로 닫힘', () => {
    document.body.innerHTML = '';
    const onListen = vi.fn();
    const nb = createNotebook({ onListen });
    nb.open(items.filter((i) => i.cat === 'note'));
    const entries = [...document.querySelectorAll('.notebook .nb-entry')];
    expect(entries.map((e) => e.querySelector('.nb-date').textContent)).toEqual(['2026.11.25', '2026.11.20']);
    expect(entries[1].querySelector('.nb-text').textContent).toBe('오이 싫음');
    entries[0].querySelector('[data-act="listen"]').click();
    expect(onListen).toHaveBeenCalledWith(expect.objectContaining({ id: 6 }));
    document.querySelector('.nb-close').click();
    expect(document.querySelector('.notebook').hidden).toBe(true);
    expect(noteDate('2026-01-02')).toBe('2026.01.02');
    expect(notesNewestFirst([{ id: 1, date: '2026-01-01' }, { id: 2, date: '2026-01-01' }]).map((i) => i.id)).toEqual([2, 1]);
  });

  describe('방 안 조작 — 휠은 벽 넘기기, Ctrl+휠은 확대, 확대 중 끌기는 이동', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, cat: 'book', title: `책${i + 1}` }));
    const mount = () => {
      document.body.innerHTML = '<div id="g"></div>';
      const g = document.getElementById('g');
      renderRoom(g, many, {});
      // jsdom은 크기가 0이라 화면 크기를 줌(확대 중 보는 자리 범위가 이걸로 정해짐).
      const view = g.querySelector('.room-view');
      Object.defineProperty(view, 'clientWidth', { value: window.innerWidth, configurable: true });
      Object.defineProperty(view, 'clientHeight', { value: window.innerHeight, configurable: true });
      return { surface: g.querySelector('.room-view'), stage: g.querySelector('.rv-stage'), track: g.querySelector('.rv-gallery-right .rv-track'), tile: g.querySelector('.rv-gallery-right .rv-work') };
    };
    const ptr = (target, type, x, y = 0) => {
      const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
      Object.defineProperty(e, 'pointerId', { value: 1 });
      target.dispatchEvent(e);
    };
    // 방 바닥 가운데(방 안) — 방 바깥 휠은 페이지 스크롤로 둬서, 휠은 여기서 굴림.
    const mid = () => ({ clientX: window.innerWidth / 2, clientY: roomSize(window.innerWidth, window.innerHeight - 8).cy });
    const scaleOf = (stage) => Number((/scale\(([\d.]+)\)/.exec(stage.style.transform) || [])[1]);

    it('Ctrl+휠을 올리면 커지고(페이지는 안 움직임), 내리면 원래 크기까지만', () => {
      const { surface, stage } = mount();
      const up = new WheelEvent('wheel', { deltaY: -400, ctrlKey: true, ...mid(), cancelable: true });
      surface.dispatchEvent(up);
      expect(up.defaultPrevented).toBe(true);
      expect(scaleOf(stage)).toBeGreaterThan(1.5);
      surface.dispatchEvent(new WheelEvent('wheel', { deltaY: 100000, ctrlKey: true, ...mid(), cancelable: true }));
      expect(scaleOf(stage)).toBe(1);
      for (let k = 0; k < 20; k++) surface.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, ctrlKey: true, ...mid(), cancelable: true }));
      expect(scaleOf(stage)).toBe(4); // 최대 4배
    });

    it('그냥 휠은 벽을 옆으로 넘김(확대는 그대로, 페이지도 안 움직임), 처음보다 앞으로는 안 감', () => {
      const { surface, stage, track } = mount();
      const before = stage.style.transform;
      const down = new WheelEvent('wheel', { deltaY: 120, ...mid(), cancelable: true });
      surface.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      expect(track.style.transform).toBe('translateX(-120px)');
      expect(stage.style.transform).toBe(before);
      surface.dispatchEvent(new WheelEvent('wheel', { deltaY: -1000, ...mid(), cancelable: true }));
      expect(track.style.transform).toBe('translateX(0px)');
    });

    it('방 바깥(회색)에서 굴리면 손대지 않음 — 페이지가 내려감(Ctrl이어도 브라우저 몫)', () => {
      const { surface, track, stage } = mount();
      for (const ctrlKey of [false, true]) {
        const e = new WheelEvent('wheel', { deltaY: 120, ctrlKey, clientX: 2, clientY: 2, cancelable: true });
        surface.dispatchEvent(e);
        expect(e.defaultPrevented).toBe(false);
      }
      expect(track.style.transform).toBe('');
      expect(scaleOf(stage)).toBe(1);
    });

    it('끌어서는 벽이 안 넘어감(휠로만), 확대하면 끌기 = 보는 자리 이동이고 끈 뒤의 클릭은 작품 열기로 안 침', () => {
      const { surface, stage, track, tile } = mount();
      const before = stage.style.transform;
      ptr(tile, 'pointerdown', 100, 100);
      ptr(surface, 'pointermove', 50, 100);
      ptr(surface, 'pointerup', 50, 100);
      expect(stage.style.transform).toBe(before);
      expect(track.style.transform).toBe('');
      surface.dispatchEvent(new WheelEvent('wheel', { deltaY: -600, ctrlKey: true, ...mid(), cancelable: true }));
      const zoomed = stage.style.transform;
      ptr(surface, 'pointerdown', 500, 300);
      ptr(surface, 'pointermove', 450, 280);
      ptr(surface, 'pointerup', 450, 280);
      expect(stage.style.transform).not.toBe(zoomed);
      expect(track.style.transform).toBe('');
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      tile.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
    });
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
