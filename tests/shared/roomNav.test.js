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

async function initAt(url) {
  vi.resetModules();
  localStorage.setItem('untitled-canvas.my-room', JSON.stringify(MY_ROOM));
  window.history.pushState({}, '', url);
  const { initRoomNav } = await import('../../js/shared/roomNav.js');
  document.body.innerHTML = `
    <nav class="site-nav">
      <a href="./" data-page="./">방</a>
      <a href="library" data-page="library">기록 보관소</a>
    </nav>`;
  const navEl = document.querySelector('.site-nav');
  await initRoomNav({ navEl, currentPage: 'library' });
  return navEl;
}

beforeEach(() => {
  localStorage.clear();
});

describe('읽기 전용 표시', () => {
  it('개발자 방을 보는 중이면 "개발자의 방 보는 중"', async () => {
    const nav = await initAt('/library?room=DEV123');
    expect(nav.querySelector('.room-tag.readonly').textContent).toContain('개발자의 방 보는 중');
  });

  it('다른 친구 방을 볼 땐 기존처럼 방 코드를 보여줌', async () => {
    const nav = await initAt('/library?room=FRND99');
    expect(nav.querySelector('.room-tag.readonly b').textContent).toBe('FRND99');
  });
});
