// roomNav.js의 읽기 전용 표시 — "개발자의 방"(config.js)을 보는 중이면 방
// 코드 대신 "개발자의 방 보는 중"으로, 다른 방이면 기존처럼 코드를 보여주는지.
// 개발자 방 코드는 config.js 값을 가짜로 바꿔 끼움.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../js/shared/config.js', () => ({
  API_BASE: 'http://api.test',
  GOOGLE_CLIENT_ID: '',
  DEVELOPER_ROOM_CODE: 'dev123',
}));

const MY_ROOM = { code: 'MINE22', token: 'tok' };

async function initAt(url, extraHtml = '') {
  vi.resetModules();
  localStorage.setItem('untitled-canvas.my-room', JSON.stringify(MY_ROOM));
  window.history.pushState({}, '', url);
  const { initRoomNav } = await import('../../js/shared/roomNav.js');
  document.body.innerHTML = `
    <nav class="site-nav">
      <button type="button" class="nav-menu" aria-expanded="false"></button>
      <a href="./" data-page="./">홈</a>
      <a href="library?cat=book" data-page="library?cat=book" data-cat="book">책</a>
    </nav>${extraHtml}`;
  const navEl = document.querySelector('.site-nav');
  await initRoomNav({ navEl, currentPage: 'library' });
  return navEl;
}

beforeEach(() => {
  localStorage.clear();
});

describe('읽기 전용 표시', () => {
  it('개발자 방을 보는 중이면 "개발자의 방 보는 중"', async () => {
    await initAt('/library?room=DEV123');
    expect(document.querySelector('.nav-drawer .room-tag.readonly').textContent).toContain('개발자의 방 보는 중');
  });

  it('다른 친구 방을 볼 땐 기존처럼 방 코드를 보여줌', async () => {
    await initAt('/library?room=FRND99');
    expect(document.querySelector('.nav-drawer .room-tag.readonly b').textContent).toBe('FRND99');
  });
});

describe('상단 메뉴와 서랍', () => {
  it('남의 방을 볼 땐 위 줄 링크가 그 방을 유지 — 이미 쿼리가 있는 링크(library?cat=)엔 &로 붙임', async () => {
    const nav = await initAt('/library?room=FRND99');
    expect(nav.querySelector('a[data-cat="book"]').getAttribute('href')).toBe('library?cat=book&room=FRND99');
    expect(nav.querySelector('a[data-page="./"]').getAttribute('href')).toBe('./?room=FRND99');
  });

  it('기록 보관소의 지금 카테고리를 위 줄에 표시', async () => {
    const nav = await initAt('/library?cat=book');
    expect(nav.querySelector('a[data-cat="book"]').classList.contains('active')).toBe(true);
  });

  it('☰를 누르면 서랍이 열리고, 바깥을 누르거나 Esc면 닫힘', async () => {
    const nav = await initAt('/library');
    const drawer = document.querySelector('.nav-drawer');
    const menu = nav.querySelector('.nav-menu');
    menu.click();
    expect(drawer.classList.contains('open')).toBe(true);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    drawer.click(); // 어두운 바깥
    expect(drawer.classList.contains('open')).toBe(false);
    menu.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(drawer.classList.contains('open')).toBe(false);
  });

  it('서랍의 "방 둘러보기"도 보던 방을 들고 감 — 둘러보기를 거쳐도 말없이 내 방으로 넘어가지 않게', async () => {
    await initAt('/library?room=FRND99');
    expect(document.querySelector('.nav-drawer a[data-page="rooms"]').getAttribute('href')).toBe('rooms?room=FRND99');
  });

  it('페이지의 방 표시: 내 방이면 "내 방", 개발자 방이면 "개발자의 방"', async () => {
    document.body.innerHTML = '';
    let nav = await initAt('/library', '<div data-room-label></div>');
    expect(document.querySelector('[data-room-label]').textContent).toBe('내 방');
    nav = await initAt('/library?room=DEV123', '<div data-room-label></div>');
    const label = document.querySelector('[data-room-label]');
    expect(label.textContent).toBe('개발자의 방');
    expect(label.classList.contains('visiting')).toBe(true);
  });

  it('내 방이면 서랍 맨 위에 방 코드 + 링크 복사', async () => {
    await initAt('/library');
    const room = document.querySelector('.nav-drawer .drawer-room');
    expect(room.querySelector('.room-tag b').textContent).toBe('MINE22');
    expect(room.querySelector('.room-copy').textContent).toBe('링크 복사');
  });
});
