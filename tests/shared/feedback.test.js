// feedback.js — 보내는 값(어느 화면·어느 방에서 썼는지)과, 창에서 보내기를
// 눌렀을 때 성공/실패 문구가 제대로 뜨는지. fetch는 가짜로 바꿔 끼움.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../js/shared/config.js', () => ({
  API_BASE: 'http://api.test',
  GOOGLE_CLIENT_ID: '',
  DEVELOPER_ROOM_CODE: '',
}));

const MY_ROOM = { code: 'MINE22', token: 'tok' };

async function load(url) {
  vi.resetModules();
  window.history.pushState({}, '', url);
  document.body.innerHTML = '<nav class="site-nav"><button type="button" data-feedback-open>의견 보내기</button></nav>';
  return import('../../js/shared/feedback.js');
}

function mockFetch(status) {
  const fn = vi.fn(() => Promise.resolve({ ok: status >= 200 && status < 300, status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('untitled-canvas.my-room', JSON.stringify(MY_ROOM));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sendFeedback', () => {
  it('보던 화면 경로와 방 코드를 같이 보냄', async () => {
    const fetch = mockFetch(200);
    const { sendFeedback } = await load('/mysite/library?room=frnd99');
    await sendFeedback({ message: '좋아요', name: '' });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('http://api.test/api/feedback');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ message: '좋아요', name: null, page: '/mysite/library', room_code: 'FRND99' });
  });

  it('?room=이 없으면 내 방 코드', async () => {
    const fetch = mockFetch(200);
    const { sendFeedback } = await load('/mysite/sketchbook');
    await sendFeedback({ message: '좋아요', name: '테스트' });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ name: '테스트', room_code: 'MINE22' });
  });

  it('429면 너무 많이 보냈다는 문구로 실패', async () => {
    mockFetch(429);
    const { sendFeedback } = await load('/mysite/');
    await expect(sendFeedback({ message: 'x' })).rejects.toThrow('너무 많이 보내셨습니다');
  });

  it('네트워크가 끊겨도 일반 실패 문구로 실패', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const { sendFeedback } = await load('/mysite/');
    await expect(sendFeedback({ message: 'x' })).rejects.toThrow('보내지 못했습니다');
  });
});

describe('의견 보내기 창', () => {
  async function openDialog() {
    await load('/mysite/');
    document.querySelector('[data-feedback-open]').click();
    return document.querySelector('.feedback-dialog');
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('내용이 비어 있으면 보내지 않음', async () => {
    const fetch = mockFetch(200);
    const dialog = await openDialog();
    dialog.querySelector('form').requestSubmit();
    expect(fetch).not.toHaveBeenCalled();
    expect(dialog.querySelector('.feedback-status').textContent).toBe('내용을 적어 주세요.');
  });

  it('보내면 감사 문구를 띄우고 입력을 비운 뒤 잠시 후 닫힘', async () => {
    mockFetch(200);
    const dialog = await openDialog();
    dialog.querySelector('textarea').value = '  아바타 기능 원해요  ';
    dialog.querySelector('form').requestSubmit();
    await flush();
    expect(dialog.querySelector('.feedback-status').textContent).toBe('감사합니다! 잘 받았습니다.');
    expect(dialog.querySelector('textarea').value).toBe('');
    expect(dialog.hidden).toBe(false);
    await new Promise((r) => setTimeout(r, 1600));
    expect(dialog.hidden).toBe(true);
  });

  it('실패하면 쓴 내용을 남겨 둠', async () => {
    mockFetch(500);
    const dialog = await openDialog();
    dialog.querySelector('textarea').value = '음악 재생';
    dialog.querySelector('form').requestSubmit();
    await flush();
    expect(dialog.querySelector('.feedback-status').textContent).toContain('보내지 못했습니다');
    expect(dialog.querySelector('textarea').value).toBe('음악 재생');
    expect(dialog.hidden).toBe(false);
  });
});
