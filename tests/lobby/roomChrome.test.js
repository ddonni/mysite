// 로비 왼쪽 아래 "개발자의 방 구경하기" 링크(roomChrome.js) — 방문자에겐 개발자
// 방 로비로 가는 링크가 뜨고, 방 주인 본인이나 이미 그 방을 보는 중이면 숨는지.
// 서버 요청/구글 버튼/이름·테마 UI는 이 테스트와 무관해서 가짜로 막아둠.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// roomContext.js(링크 주소 헬퍼 때문에 진짜를 씀)는 불러오는 순간 방 생성
// 요청을 보냄 — 실제 네트워크로 나가지 않게 영원히 대기하는 가짜 fetch로 막음.
vi.hoisted(() => { globalThis.fetch = () => new Promise(() => {}); });

vi.mock('../../js/shared/config.js', () => ({
  API_BASE: 'http://api.test',
  GOOGLE_CLIENT_ID: '',
  DEVELOPER_ROOM_CODE: 'dev123',
}));
vi.mock('../../js/lobby/roomContext.js', async (importOriginal) => ({
  ...(await importOriginal()),
  roomContext: new Promise(() => {}),
  roomInfo: new Promise(() => {}),
}));
vi.mock('../../js/lobby/scene.js', () => ({ DEFAULT_THEME: 'wood' }));
vi.mock('../../js/lobby/roomNameEditor.js', () => ({ renderRoomName: () => {} }));
vi.mock('../../js/lobby/themePicker.js', () => ({ renderThemePicker: () => {} }));
vi.mock('../../js/shared/googleAuth.js', () => ({ initGoogleAuth: () => {} }));

const { initRoomChrome } = await import('../../js/lobby/roomChrome.js');

function ctx(myCode, viewingCode) {
  return { mine: { code: myCode, token: 'tok' }, viewingCode, readOnly: myCode !== viewingCode };
}

beforeEach(() => {
  document.body.innerHTML = '<a id="devRoomLink" hidden></a>';
});

describe('개발자의 방 구경하기 링크', () => {
  it('방문자에겐 개발자 방 로비로 가는 링크가 뜸', () => {
    initRoomChrome(ctx('MINE22', 'MINE22'));
    const link = document.getElementById('devRoomLink');
    expect(link.hidden).toBe(false);
    expect(link.getAttribute('href')).toBe('./?room=DEV123');
  });

  it('이미 개발자 방을 보는 중이면 숨김', () => {
    initRoomChrome(ctx('MINE22', 'DEV123'));
    expect(document.getElementById('devRoomLink').hidden).toBe(true);
  });

  it('개발자 본인(방 주인)에겐 숨김', () => {
    initRoomChrome(ctx('DEV123', 'DEV123'));
    expect(document.getElementById('devRoomLink').hidden).toBe(true);
  });
});
