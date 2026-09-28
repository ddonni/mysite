// roomNav.js의 "개발자의 방" 링크 — 누구나 보는 메뉴라서, 방 주인 본인에겐
// 안 뜨고 다른 사람에겐 개발자 방의 로비로 가는지, 그 방을 보는 중이면
// "개발자의 방 보는 중"으로 표시되는지 확인. 개발자 방 코드는 config.js 값을
// 가짜로 바꿔 끼움.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../js/shared/config.js', () => ({
  API_BASE: 'http://api.test',
  GOOGLE_CLIENT_ID: '',
  DEVELOPER_ROOM_CODE: 'dev123',
}));

const MY_ROOM = { code: 'MINE22', token: 'tok' };

function makeNav() {
  document.body.innerHTML = `
    <nav class="site-nav">
      <a href="./" data-page="./">방</a>
      <a href="sketchbook" data-page="sketchbook">캔버스</a>
      <a href="library" data-page="library">기록 보관소</a>
    </nav>`;
  return document.querySelector('.site-nav');
}

async function initAs(myRoom, url) {
  vi.resetModules();
  localStorage.setItem('untitled-canvas.my-room', JSON.stringify(myRoom));
  window.history.pushState({}, '', url);
  const { initRoomNav } = await import('../../js/shared/roomNav.js');
  const navEl = makeNav();
  await initRoomNav({ navEl, currentPage: 'library' });
  return navEl;
}

beforeEach(() => {
  localStorage.clear();
});

describe('개발자의 방 링크', () => {
  it('다른 사람의 메뉴엔 페이지 링크 바로 뒤에 개발자 방 로비로 가는 링크가 뜸', async () => {
    const nav = await initAs(MY_ROOM, '/library');
    const dev = nav.querySelector('a.dev-room');
    expect(dev.textContent).toBe('개발자의 방');
    expect(dev.getAttribute('href')).toBe('./?room=DEV123');
    expect(dev.previousElementSibling.dataset.page).toBe('library');
    expect(dev.classList.contains('on')).toBe(false);
  });

  it('개발자 방을 보는 중이면 링크가 켜지고 읽기 전용 표시도 "개발자의 방"', async () => {
    const nav = await initAs(MY_ROOM, '/library?room=DEV123');
    expect(nav.querySelector('a.dev-room').classList.contains('on')).toBe(true);
    expect(nav.querySelector('.room-tag.readonly').textContent).toContain('개발자의 방 보는 중');
  });

  it('다른 친구 방을 볼 땐 기존처럼 방 코드를 보여줌', async () => {
    const nav = await initAs(MY_ROOM, '/library?room=FRND99');
    expect(nav.querySelector('.room-tag.readonly b').textContent).toBe('FRND99');
  });

  it('개발자 본인(방 주인)에겐 링크를 안 띄움', async () => {
    const nav = await initAs({ code: 'DEV123', token: 'tok' }, '/library');
    expect(nav.querySelector('a.dev-room')).toBeNull();
  });
});
