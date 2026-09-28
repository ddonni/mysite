// shrinkImage는 "줄일 수 있으면 줄이고, 뭔가 안 되면 원본 그대로"가 핵심 —
// 줄이다 실패해서 저장 자체가 막히면 안 됨. jsdom엔 실제 이미지 디코더/캔버스가
// 없어서 createImageBitmap과 canvas를 가짜로 끼워서 확인함.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shrinkImage } from '../../../js/library/modal/shrinkImage.js';

function fakeFile(name, type, size) {
  return new File([new Uint8Array(size)], name, { type });
}

// createImageBitmap이 (w×h) 사진을 돌려주고, canvas.toBlob이 outBytes 크기의
// JPEG를 만든다고 가정함. 캔버스에 실제로 그려진 크기를 확인할 수 있게 돌려줌.
function stubDecoder(w, h, outBytes) {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: w, height: h, close: vi.fn() })));
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }),
    toBlob: (cb, type) => cb(new Blob([new Uint8Array(outBytes)], { type })),
  };
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => (tag === 'canvas' ? canvas : realCreate(tag)));
  return canvas;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shrinkImage', () => {
  it('큰 사진은 긴 변 1200px JPEG로 줄임', async () => {
    const canvas = stubDecoder(4000, 3000, 200 * 1024);
    const out = await shrinkImage(fakeFile('IMG_0001.HEIC.png', 'image/png', 5 * 1024 * 1024));
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(900);
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('IMG_0001.HEIC.jpg');
    expect(out.size).toBe(200 * 1024);
  });

  it('이미 작고 가벼운 사진은 그대로 둠', async () => {
    stubDecoder(800, 600, 10);
    const file = fakeFile('small.jpg', 'image/jpeg', 100 * 1024);
    expect(await shrinkImage(file)).toBe(file);
  });

  it('GIF는 애니메이션이 깨지지 않게 그대로 둠', async () => {
    stubDecoder(4000, 3000, 10);
    const file = fakeFile('a.gif', 'image/gif', 5 * 1024 * 1024);
    expect(await shrinkImage(file)).toBe(file);
  });

  it('다시 인코딩한 게 더 크면 원본을 씀', async () => {
    stubDecoder(4000, 3000, 2 * 1024 * 1024);
    const file = fakeFile('x.jpg', 'image/jpeg', 1024 * 1024);
    expect(await shrinkImage(file)).toBe(file);
  });

  it('디코딩에 실패하면 원본을 그대로 돌려줌(저장은 막지 않음)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('bad image'); }));
    const file = fakeFile('broken.jpg', 'image/jpeg', 5 * 1024 * 1024);
    expect(await shrinkImage(file)).toBe(file);
  });

  it('createImageBitmap이 없는 브라우저면 원본', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const file = fakeFile('x.jpg', 'image/jpeg', 5 * 1024 * 1024);
    expect(await shrinkImage(file)).toBe(file);
  });
});
