// 일기 사진 여러 장(js/diary/photos.js) — 받을 파일 거르기·장수 제한, 순서 바꾸기, 표지로, 빼기,
// 끌어다 놓기·붙여넣기, 저장할 때 안 올린 것만 올리기.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PHOTOS_MAX, acceptImages, createPhotoList, movePhoto } from '../../js/diary/photos.js';

const img = (name, type = 'image/jpeg') => new File(['x'], name, { type });

describe('규칙', () => {
  it('사진 파일만, 남은 자리만큼', () => {
    const files = [img('a.jpg'), img('b.svg', 'image/svg+xml'), img('c.txt', 'text/plain'), img('d.png', 'image/png')];
    expect(acceptImages(files, 10).map((f) => f.name)).toEqual(['a.jpg', 'd.png']);
    expect(acceptImages(files, 1).map((f) => f.name)).toEqual(['a.jpg']);
    expect(acceptImages(files, 0)).toEqual([]);
  });

  it('순서 바꾸기', () => {
    expect(movePhoto(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(movePhoto(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(movePhoto(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});

describe('사진 칸', () => {
  let list;
  let onChange;
  const $ = (id) => document.getElementById(id);
  const tiles = () => [...$('grid').querySelectorAll('.d-tile')];

  beforeEach(() => {
    document.body.innerHTML = '<div id="grid"></div><input type="file" id="in" multiple><div id="drop" hidden></div><p id="note" hidden></p>';
    URL.createObjectURL = vi.fn((f) => `blob:${f.name}`);
    URL.revokeObjectURL = vi.fn();
    onChange = vi.fn();
    list = createPhotoList({ gridEl: $('grid'), input: $('in'), dropEl: $('drop'), noteEl: $('note'), onChange });
    list.setUrls(['https://x/old.jpg']);
  });

  function dropFiles(files) {
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    ev.dataTransfer = { types: ['Files'], files };
    document.body.dispatchEvent(ev);
  }

  it('끌어다 놓으면 추가, 첫 장에 "표지", 표지로·빼기', () => {
    dropFiles([img('a.jpg'), img('b.jpg')]);
    expect(list.count()).toBe(3);
    expect(onChange).toHaveBeenCalled();
    expect(tiles()[0].querySelector('.d-tile-cover')).not.toBeNull();
    tiles()[2].querySelector('[data-act="first"]').click();
    expect(tiles()[0].querySelector('img').getAttribute('src')).toBe('blob:b.jpg');
    tiles()[0].querySelector('[data-act="remove"]').click();
    expect(list.count()).toBe(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:b.jpg');
  });

  it('붙여넣기한 사진도 추가, 글만 붙여넣으면 그대로', () => {
    const paste = (files) => {
      const ev = new Event('paste', { bubbles: true, cancelable: true });
      ev.clipboardData = { files };
      document.body.dispatchEvent(ev);
      return ev;
    };
    expect(paste([]).defaultPrevented).toBe(false);
    expect(paste([img('p.png', 'image/png')]).defaultPrevented).toBe(true);
    expect(list.count()).toBe(2);
  });

  it(`${PHOTOS_MAX}장을 넘으면 넘친 만큼 빼고 알림`, () => {
    dropFiles(Array.from({ length: PHOTOS_MAX + 2 }, (_, i) => img(`${i}.jpg`)));
    expect(list.count()).toBe(PHOTOS_MAX);
    expect($('note').hidden).toBe(false);
    expect($('note').textContent).toContain(`${PHOTOS_MAX}장까지`);
  });

  it('저장: 새 사진만 올리고 순서대로 주소, 다시 저장해도 또 안 올림', async () => {
    dropFiles([img('a.jpg')]);
    const upload = vi.fn(async (f) => `https://x/${f.name}`);
    expect(await list.uploadAll(upload)).toEqual(['https://x/old.jpg', 'https://x/a.jpg']);
    expect(await list.uploadAll(upload)).toEqual(['https://x/old.jpg', 'https://x/a.jpg']);
    expect(upload).toHaveBeenCalledTimes(1);
  });
});
