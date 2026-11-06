// youtube.js — 음악 기록의 유튜브 주소 읽기·검사(백엔드 schemas.is_youtube_url과 같은 규칙)와
// 작은 플레이어(유튜브 IFrame API는 가짜).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseYouTube, normalizeYouTube, getPlayer, resetPlayerForTest } from '../../js/shared/youtube.js';

describe('parseYouTube', () => {
  it('영상 주소', () => {
    expect(parseYouTube('https://www.youtube.com/watch?v=6Evs8LO4TeA&t=3')).toEqual({ videoId: '6Evs8LO4TeA' });
    expect(parseYouTube('https://youtu.be/6Evs8LO4TeA?si=abc')).toEqual({ videoId: '6Evs8LO4TeA' });
    expect(parseYouTube('https://music.youtube.com/watch?v=6Evs8LO4TeA&list=OLAK5uy_x')).toEqual({ videoId: '6Evs8LO4TeA' });
    expect(parseYouTube('https://www.youtube.com/shorts/6Evs8LO4TeA')).toEqual({ videoId: '6Evs8LO4TeA' });
  });

  it('앨범 재생목록 — index는 1부터 쓰고 0부터로 돌려줌', () => {
    expect(parseYouTube('https://www.youtube.com/playlist?list=OLAK5uy_abc&index=3')).toEqual({ list: 'OLAK5uy_abc', index: 2 });
    expect(parseYouTube('https://www.youtube.com/playlist?list=OLAK5uy_abc')).toEqual({ list: 'OLAK5uy_abc', index: 0 });
  });

  it('유튜브가 아니거나 번호가 없으면 null', () => {
    for (const bad of ['', null, 'https://evil.example/watch?v=6Evs8LO4TeA', 'http://www.youtube.com/watch?v=6Evs8LO4TeA',
      'https://youtube.com.evil.example/watch?v=6Evs8LO4TeA', 'javascript:alert(1)', 'https://www.youtube.com/']) {
      expect(parseYouTube(bad)).toBe(null);
    }
  });
});

describe('normalizeYouTube', () => {
  it('https를 빼고 써도, http여도 https 주소로', () => {
    expect(normalizeYouTube(' youtu.be/6Evs8LO4TeA ')).toBe('https://youtu.be/6Evs8LO4TeA');
    expect(normalizeYouTube('http://www.youtube.com/watch?v=6Evs8LO4TeA')).toBe('https://www.youtube.com/watch?v=6Evs8LO4TeA');
  });
  it('유튜브가 아니면 null', () => {
    expect(normalizeYouTube('그냥 글자')).toBe(null);
    expect(normalizeYouTube('ftp://youtu.be/6Evs8LO4TeA')).toBe(null);
  });
});

describe('getPlayer', () => {
  let made;
  let fake;
  beforeEach(() => {
    made = [];
    // 가짜 IFrame API — 만들어진 플레이어를 기록하고 onReady를 바로 부름.
    window.YT = {
      Player: function Player(el, opts) {
        fake = {
          opts,
          index: 0,
          loadVideoById: vi.fn(),
          loadPlaylist: vi.fn(),
          stopVideo: vi.fn(),
          destroy: vi.fn(),
          getPlaylistIndex() { return this.index; },
        };
        made.push(fake);
        setTimeout(() => opts.events.onReady({ target: fake }), 0);
        return fake;
      },
    };
  });
  afterEach(() => {
    resetPlayerForTest();
    delete window.YT;
  });
  const tick = () => new Promise((r) => setTimeout(r, 5));

  it('영상 주소는 그 영상을, 제목·가수와 유튜브 링크를 보여줌', async () => {
    const p = getPlayer();
    expect(p.play({ title: '넋두리', creator: '닐로', listen_url: 'https://youtu.be/6Evs8LO4TeA' })).toBe(true);
    await tick();
    expect(fake.loadVideoById).toHaveBeenCalledWith('6Evs8LO4TeA');
    expect(p.el.hidden).toBe(false);
    expect(p.el.querySelector('.mp-title').textContent).toBe('넋두리');
    expect(p.el.querySelector('.mp-out').href).toBe('https://youtu.be/6Evs8LO4TeA');
  });

  it('앨범 재생목록은 그 곡부터 틀고, 다음 곡으로 넘어가면 멈춤', async () => {
    const p = getPlayer();
    p.play({ title: '나랑 아니면', listen_url: 'https://www.youtube.com/playlist?list=OLAK5uy_abc&index=2' });
    await tick();
    expect(fake.loadPlaylist).toHaveBeenCalledWith({ list: 'OLAK5uy_abc', listType: 'playlist', index: 1 });
    fake.index = 1;
    fake.opts.events.onStateChange({ target: fake, data: 1 });
    expect(fake.stopVideo).not.toHaveBeenCalled();
    fake.index = 2;
    fake.opts.events.onStateChange({ target: fake, data: -1 });
    expect(fake.stopVideo).toHaveBeenCalled();
  });

  it('퍼가기를 막은 영상이면 유튜브에서 열라고 안내', async () => {
    const p = getPlayer();
    p.play({ title: 'x', listen_url: 'https://youtu.be/6Evs8LO4TeA' });
    await tick();
    fake.opts.events.onError({ data: 150 });
    expect(p.el.querySelector('.mp-msg').hidden).toBe(false);
    expect(p.el.querySelector('.mp-msg').textContent).toContain('유튜브에서 열기');
  });

  it('다른 곡을 틀면 앞의 플레이어를 없애고, 닫으면 숨김', async () => {
    const p = getPlayer();
    p.play({ title: 'a', listen_url: 'https://youtu.be/6Evs8LO4TeA' });
    await tick();
    const first = fake;
    p.play({ title: 'b', listen_url: 'https://youtu.be/AAAAAAAAAAA' });
    await tick();
    expect(first.destroy).toHaveBeenCalled();
    expect(made).toHaveLength(2);
    p.el.querySelector('.mp-close').click();
    expect(p.el.hidden).toBe(true);
  });

  it('링크가 없거나 이상하면 안 띄움', () => {
    const p = getPlayer();
    expect(p.play({ title: 'x' })).toBe(false);
    expect(p.play({ title: 'x', listen_url: 'https://evil.example' })).toBe(false);
    expect(p.el.hidden).toBe(true);
  });
});

describe('getPlayer onChange', () => {
  beforeEach(() => {
    window.YT = {
      Player: function Player(el, opts) {
        const p = { opts, loadVideoById: vi.fn(), destroy: vi.fn() };
        window.__yt = p;
        setTimeout(() => opts.events.onReady({ target: p }), 0);
        return p;
      },
    };
  });
  afterEach(() => { resetPlayerForTest(); delete window.YT; delete window.__yt; });

  it('틀면 그 곡, 끝나거나 닫으면 null을 알려줌 — 턴테이블 ▶/■가 이걸로 바뀜', async () => {
    const p = getPlayer();
    const seen = [];
    p.onChange((r) => seen.push(r && r.title));
    const song = { title: '넋두리', listen_url: 'https://youtu.be/6Evs8LO4TeA' };
    p.play(song);
    expect(p.current()).toBe(song);
    await new Promise((r) => setTimeout(r, 5));
    window.__yt.opts.events.onStateChange({ target: window.__yt, data: 0 });
    expect(p.current()).toBe(null);
    p.play(song);
    p.close();
    expect(seen).toEqual(['넋두리', null, '넋두리', null]);
  });
});
