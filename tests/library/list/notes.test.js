// ?! — 칩(전체·작품만·?!, 남의 기록엔 없음), 카드(글씨만·유튜브 썸네일, 인생작 별 없음,
// ▶를 눌러도 안 뒤집힘), 창 없이 쓰기·고치기(글·링크를 나눠 저장, 사진은 붙여넣기·버튼으로).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveRecord = vi.fn();
const uploadPhoto = vi.fn();
vi.mock('../../../js/library/records.js', async (orig) => ({
  ...(await orig()), saveRecord: (...a) => saveRecord(...a), uploadPhoto: (...a) => uploadPhoto(...a),
}));
// 사진 줄이기는 canvas가 필요해서 그대로 돌려줌.
vi.mock('../../../js/library/modal/shrinkImage.js', () => ({ shrinkImage: (f) => Promise.resolve(f) }));

const { renderCards } = await import('../../../js/library/list/cardsView.js');
const { tabsFor, itemsForTab, addCardChoices, createList } = await import('../../../js/library/list.js');

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const book = { id: 1, cat: 'book', title: '데미안', rating: 4 };
const note = { id: 2, cat: 'note', title: '', memo: '필름 카메라에 꽂힘\n요즘 매일 찍음', listen_url: null };
const video = { id: 3, cat: 'note', title: '', memo: null, listen_url: YT };

describe('칩', () => {
  it('내 기록: 전체 · 작품만 · 카테고리 · ?!(나만 보는 칩)', () => {
    const tabs = tabsFor(false);
    expect(tabs.map((t) => t.key)).toEqual(['all', 'works', 'book', 'anime', 'movie', 'music', 'note']);
    expect(tabs.find((t) => t.key === 'note').private).toBe(true);
  });

  it('남의 기록: 작품만·?! 칩이 없음', () => {
    expect(tabsFor(true).map((t) => t.key)).toEqual(['all', 'book', 'anime', 'movie', 'music']);
  });

  it('전체는 섞어서, 작품만은 ?!를 빼고, ?!는 ?!만', () => {
    const items = [book, note, video];
    expect(itemsForTab(items, 'all')).toEqual(items);
    expect(itemsForTab(items, 'works')).toEqual([book]);
    expect(itemsForTab(items, 'note')).toEqual([note, video]);
  });
});

describe('?! 카드', () => {
  let grid;
  beforeEach(() => {
    document.body.innerHTML = '<div id="g"></div>';
    grid = document.getElementById('g');
  });

  it('글만 — 글씨만(아이콘 없이), 이름은 첫 줄, 뒷면엔 따옴표 없이 전부, 인생작 별 없음', () => {
    renderCards(grid, [note], { onEdit() {}, onDelete() {}, onFeature() {} });
    const card = grid.querySelector('.card');
    expect(card.querySelector('.cover.note-paper .np-text').textContent).toContain('필름 카메라에 꽂힘');
    expect(card.querySelector('.card-title').textContent).toBe('필름 카메라에 꽂힘');
    expect(card.querySelector('.cover .cat-icon')).toBeNull();
    expect(card.querySelector('.back .q').textContent).toBe('필름 카메라에 꽂힘\n요즘 매일 찍음');
    expect(card.querySelector('[data-act="feature"]')).toBeNull();
    expect(card.querySelector('[data-act="edit"]')).not.toBeNull();
  });

  it('유튜브 영상 — 썸네일 표지, ▶를 누르면 재생(카드는 안 뒤집힘), 뒷면에도 ▶ 보기', () => {
    const onListen = vi.fn();
    renderCards(grid, [video], { onListen, onEdit() {}, onDelete() {} });
    const card = grid.querySelector('.card');
    expect(card.querySelector('.note-video img').getAttribute('src')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(card.querySelector('.cat-icon[data-cat="note"] text').textContent).toBe('?!');
    expect(card.querySelector('.card-title').textContent).toBe('유튜브 영상');
    card.querySelector('.note-play').click();
    expect(onListen).toHaveBeenCalledWith(video);
    expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(card.querySelector('.back [data-act="listen"]').textContent).toBe('▶ 보기');
    expect(card.querySelector('.back .q').textContent).toBe('유튜브 링크만 남겼어요.');
  });

  it('작품 카드는 그대로 — 인생작 별 있음', () => {
    renderCards(grid, [book], { onEdit() {}, onDelete() {}, onFeature() {} });
    expect(grid.querySelector('[data-act="feature"]')).not.toBeNull();
  });
});

describe('?! — 창 없이 쓰기·고치기(사진 포함)', () => {
  beforeEach(() => {
    saveRecord.mockReset().mockResolvedValue({ id: 99 });
    uploadPhoto.mockReset().mockResolvedValue('https://bucket/records/p.jpg');
  });

  const mountList = (items, onSaveNote = vi.fn().mockResolvedValue()) => {
    document.body.innerHTML = '<div id="tabs"></div><div id="list"></div>';
    localStorage.removeItem('mysite:view');
    const list = createList({ readOnly: false, onAdd: vi.fn(), onSaveNote, onEdit() {}, onDelete() {}, onFeature() {} });
    list.render(items);
    return { grid: document.getElementById('list'), onSaveNote };
  };
  const typeIn = (input, v) => { input.value = v; input.dispatchEvent(new Event('input')); };

  it('맨 앞 "+ ?!"를 누르면 창 없이 그 칸이 입력 칸 — 글과 링크를 나눠 저장', () => {
    const { grid, onSaveNote } = mountList([book]);
    grid.querySelector('[data-add="note"]').click();
    expect(document.querySelector('.overlay.open')).toBeNull();
    const slot = grid.querySelector('.add-slot.drafting');
    const save = slot.querySelector('[data-ed="save"]');
    expect(save.disabled).toBe(true);
    typeIn(slot.querySelector('textarea'), `이거 봐\n${YT}`);
    save.click();
    expect(onSaveNote).toHaveBeenCalledWith(null, { memo: '이거 봐', listen_url: YT, photo_url: null });
  });

  it('입력 칸에 그림을 붙여 넣으면 사진으로 올리고, 사진만 있어도 저장', async () => {
    const { grid, onSaveNote } = mountList([book]);
    grid.querySelector('[data-add="note"]').click();
    const slot = grid.querySelector('.drafting');
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const e = new Event('paste', { bubbles: true, cancelable: true });
    e.clipboardData = { files: [file] };
    slot.querySelector('textarea').dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(slot.querySelector('[data-ed="save"]').disabled).toBe(false));
    expect(slot.querySelector('.note-photo').hidden).toBe(false);
    slot.querySelector('[data-ed="save"]').click();
    expect(onSaveNote).toHaveBeenCalledWith(null, { memo: '', listen_url: null, photo_url: 'https://bucket/records/p.jpg' });
  });

  it('"+ ?!"에 사진을 끌어다 놓으면 입력 칸이 열리면서 사진이 붙음, 글을 놓으면 칸에 들어감', async () => {
    const { grid, onSaveNote } = mountList([book]);
    const drop = (target, dataTransfer) => {
      const e = new Event('drop', { bubbles: true, cancelable: true });
      e.dataTransfer = dataTransfer;
      target.dispatchEvent(e);
    };
    drop(grid.querySelector('[data-add="note"]'), { files: [new File(['x'], 'd.jpg', { type: 'image/jpeg' })], getData: () => '' });
    const slot = grid.querySelector('.drafting');
    expect(slot).not.toBeNull();
    await vi.waitFor(() => expect(slot.querySelector('[data-ed="save"]').disabled).toBe(false));
    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    slot.querySelector('[data-ed="save"]').click();
    expect(onSaveNote).toHaveBeenCalledWith(null, { memo: '', listen_url: null, photo_url: 'https://bucket/records/p.jpg' });

    const again = mountList([book]).grid;
    drop(again.querySelector('[data-add="note"]'), { files: [], getData: (t) => (t === 'text/plain' ? YT : '') });
    expect(again.querySelector('.drafting textarea').value).toBe(YT);
  });

  it('사진을 빼면(×) 다시 저장할 게 없음', async () => {
    const { grid } = mountList([book]);
    grid.querySelector('[data-add="note"]').click();
    const slot = grid.querySelector('.drafting');
    const input = slot.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'b.jpg', { type: 'image/jpeg' })] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(slot.querySelector('[data-ed="save"]').disabled).toBe(false));
    slot.querySelector('.note-photo-x').click();
    expect(slot.querySelector('[data-ed="save"]').disabled).toBe(true);
  });

  it('입력 칸에서 Esc면 다시 "+" 칸', () => {
    const { grid } = mountList([book]);
    grid.querySelector('[data-add="note"]').click();
    grid.querySelector('.drafting textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(grid.querySelector('.drafting')).toBeNull();
    expect(grid.querySelector('[data-add="note"]')).not.toBeNull();
  });

  it('?! 카드의 "수정"은 그 카드 자리가 입력 칸 — 글·링크·사진이 채워지고, 저장은 그 기록에', () => {
    const onSaveNote = vi.fn().mockResolvedValue();
    document.body.innerHTML = '<div id="g"></div>';
    const grid = document.getElementById('g');
    renderCards(grid, [{ ...note, listen_url: YT, photo_url: 'https://bucket/records/old.jpg' }], { onSaveNote, onEdit: vi.fn(), onDelete() {} });
    const slot = grid.querySelector('.slot');
    slot.querySelector('[data-act="edit"]').click();
    expect(slot.classList.contains('drafting')).toBe(true);
    expect(slot.querySelector('.card').hidden).toBe(true);
    const input = slot.querySelector('.note-draft textarea');
    expect(input.value).toBe(`${note.memo}\n${YT}`);
    expect(slot.querySelector('.note-photo').hidden).toBe(false);
    typeIn(input, '고친 글');
    slot.querySelector('[data-ed="save"]').click();
    expect(onSaveNote).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }),
      { memo: '고친 글', listen_url: null, photo_url: 'https://bucket/records/old.jpg' });
  });

  it('고치다 취소하면 카드 그대로', () => {
    document.body.innerHTML = '<div id="g"></div>';
    const grid = document.getElementById('g');
    renderCards(grid, [note], { onSaveNote: vi.fn(), onEdit() {}, onDelete() {} });
    const slot = grid.querySelector('.slot');
    slot.querySelector('[data-act="edit"]').click();
    slot.querySelector('[data-ed="cancel"]').click();
    expect(slot.querySelector('.note-draft')).toBeNull();
    expect(slot.classList.contains('drafting')).toBe(false);
    expect(slot.querySelector('.card').hidden).toBe(false);
  });

  it('사진만 있는 ?! — 카드 표지는 사진, 이름은 "사진"', () => {
    document.body.innerHTML = '<div id="g"></div>';
    const grid = document.getElementById('g');
    renderCards(grid, [{ id: 5, cat: 'note', title: '', memo: null, listen_url: null, photo_url: 'https://bucket/records/p.jpg' }], {});
    expect(grid.querySelector('.cover.note-photo-cover img')).not.toBeNull();
    expect(grid.querySelector('.card-title').textContent).toBe('사진');
    expect(grid.querySelector('.back .q').textContent).toBe('사진만 남겼어요.');
  });
});

describe('왼쪽 위 + 카드', () => {
  it('칩마다 — 전체는 두 칸, ?!·카테고리·작품만은 한 칸', () => {
    expect(addCardChoices('all').map((c) => c.add)).toEqual(['all', 'note']);
    expect(addCardChoices('note')).toEqual([{ add: 'note', label: '?!' }]);
    expect(addCardChoices('book')).toEqual([{ add: 'book', label: '책' }]);
    expect(addCardChoices('works')).toEqual([{ add: 'all', label: '기록' }]);
  });

  const mount = (readOnly) => {
    document.body.innerHTML = '<div id="tabs"></div><div id="list"></div>';
    try { localStorage.removeItem('mysite:view'); } catch (e) { /* 없어도 됨 */ }
    const onAdd = vi.fn();
    const list = createList({ readOnly, onAdd, onEdit() {}, onDelete() {}, onFeature() {} });
    list.render([book, note]);
    return { onAdd, grid: document.getElementById('list') };
  };

  it('내 기록이면 격자 맨 앞 칸, 작품 기록을 누르면 onAdd', () => {
    const { onAdd, grid } = mount(false);
    expect(grid.firstElementChild.classList.contains('add-slot')).toBe(true);
    grid.querySelector('[data-add="all"]').click();
    expect(onAdd).toHaveBeenCalledWith('all'); // ?!는 onAdd가 아니라 그 칸이 입력 칸으로(아래 묶음)
  });

  it('비어 있어도 안내 글 대신 + 카드만', () => {
    document.body.innerHTML = '<div id="tabs"></div><div id="list"></div>';
    const list = createList({ readOnly: false, onAdd() {}, onEdit() {}, onDelete() {}, onFeature() {} });
    list.render([]);
    const grid = document.getElementById('list');
    expect(grid.querySelector('.empty')).toBeNull();
    expect(grid.children.length).toBe(1);
    expect(grid.firstElementChild.classList.contains('add-slot')).toBe(true);
  });

  it('촘촘히·목록 보기에도 맨 앞에(비어 있어도)', () => {
    for (const view of ['dense', 'list']) {
      document.body.innerHTML = '<div id="tabs"></div><div id="list"></div>';
      localStorage.setItem('mysite:view', view);
      const onAdd = vi.fn();
      const list = createList({ readOnly: false, onAdd, onEdit() {}, onDelete() {}, onFeature() {} });
      list.render([]);
      const grid = document.getElementById('list');
      expect(grid.querySelector('.empty')).toBeNull();
      expect(grid.firstElementChild.classList.contains(`add-${view}`)).toBe(true);
      grid.querySelector('[data-add="all"]').click();
      expect(onAdd).toHaveBeenCalledWith('all');
    }
    localStorage.removeItem('mysite:view');
  });

  it('남의 기록엔 없음', () => {
    const { grid } = mount(true);
    expect(grid.querySelector('.add-slot')).toBeNull();
  });
});
