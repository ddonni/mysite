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
  // 방문자 본인의 방은 기록이 있는 걸로 — "돌아가기" 문구가 나와야 함.
  myRoomEmpty: Promise.resolve(false),
}));
vi.mock('../../js/lobby/scene.js', () => ({ DEFAULT_THEME: 'wood' }));
vi.mock('../../js/lobby/roomNameEditor.js', () => ({ renderRoomName: () => {} }));
vi.mock('../../js/lobby/themePicker.js', () => ({ renderThemePicker: () => {} }));
vi.mock('../../js/shared/googleAuth.js', () => ({ initGoogleAuth: () => {} }));

const { initRoomChrome } = await import('../../js/lobby/roomChrome.js');
const { myRoomLabel } = await import('../../js/lobby/roomContext.js');

function ctx(myCode, viewingCode) {
  return { mine: { code: myCode, token: 'tok' }, viewingCode, readOnly: myCode !== viewingCode };
}

beforeEach(() => {
  document.body.innerHTML = '<a id="devRoomLink" hidden></a><a id="myRoomCta" hidden></a>';
});

describe('내 방으로 가는 버튼(방문자용)', () => {
  it('남의 방을 구경하는 중이면 내 방 로비로 가는 버튼이 뜸 — 내 방에 기록이 있으면 "돌아가기"', async () => {
    initRoomChrome(ctx('MINE22', 'DEV123'));
    await Promise.resolve();
    const cta = document.getElementById('myRoomCta');
    expect(cta.hidden).toBe(false);
    expect(cta.getAttribute('href')).toBe('./');
    expect(cta.textContent).toBe('내 방으로 돌아가기');
    // 돌아가기는 꺾쇠가 글자 앞(왼쪽)
    expect(cta.firstElementChild.tagName.toLowerCase()).toBe('svg');
  });

  it('문구: 내 방이 비었을 때만 "만들기", 모르면 "돌아가기"', () => {
    expect(myRoomLabel(true)).toBe('나도 내 방 만들기');
    expect(myRoomLabel(false)).toBe('내 방으로 돌아가기');
    expect(myRoomLabel(null)).toBe('내 방으로 돌아가기');
  });

  it('내 방에선 숨김', () => {
    initRoomChrome(ctx('MINE22', 'MINE22'));
    expect(document.getElementById('myRoomCta').hidden).toBe(true);
  });
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
