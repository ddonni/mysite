// room.js는 이 브라우저가 "내 방"으로 여기는 코드/토큰을 localStorage에
// 관리하는 모듈. claimFromUrl()이 모듈을 처음 불러오는 시점에 주소창의
// ?code=&token=을 읽어버리는 부수효과가 있어서, 그 부분을 시나리오별로
// 테스트하려면 매번 vi.resetModules()로 모듈을 새로 불러와야 함(안
// 그러면 ES 모듈 캐시 때문에 첫 시나리오의 URL만 계속 반영됨).
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function freshRoomModule() {
  vi.resetModules();
  return import('../../js/shared/room.js');
}

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
  global.fetch = vi.fn();
});

describe('claimFromUrl (모듈 로드 시점 부수효과)', () => {
  it('?code=&token=이 있으면 방으로 저장하고 주소창에서 지움(나머지 쿼리는 남김)', async () => {
    window.history.pushState({}, '', '/index.html?code=abc123&token=secret-tok&keep=1');

    const { getStoredRoom } = await freshRoomModule();

    expect(getStoredRoom()).toEqual({ code: 'ABC123', token: 'secret-tok' });
    expect(location.search).not.toContain('code=');
    expect(location.search).not.toContain('token=');
    expect(location.search).toContain('keep=1');
  });

  it('code/token이 없으면 아무 일도 안 일어남', async () => {
    window.history.pushState({}, '', '/index.html?room=XYZ999');

    const { getStoredRoom } = await freshRoomModule();

    expect(getStoredRoom()).toBeNull();
    expect(location.search).toBe('?room=XYZ999'); // 손 안 댐
  });
});

describe('getStoredRoom / adoptRoom', () => {
  it('adoptRoom으로 저장한 값을 getStoredRoom이 그대로 돌려줌', async () => {
    const { getStoredRoom, adoptRoom } = await freshRoomModule();

    expect(getStoredRoom()).toBeNull();
    adoptRoom({ code: 'ZZZ111', token: 'tok' });
    expect(getStoredRoom()).toEqual({ code: 'ZZZ111', token: 'tok' });
  });
});

describe('getMyRoom', () => {
  it('이미 저장된 방이 있으면 fetch 없이 그 방을 돌려줌', async () => {
    const { getStoredRoom, adoptRoom, getMyRoom } = await freshRoomModule();
    adoptRoom({ code: 'MINE01', token: 'tok' });

    const room = await getMyRoom();

    expect(room).toEqual(getStoredRoom());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('저장된 방이 없으면 POST /api/rooms로 새로 만들고 저장함', async () => {
    const { getMyRoom, getStoredRoom } = await freshRoomModule();
    const created = { code: 'NEW001', token: 'freshtok' };
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) });

    const room = await getMyRoom();

    expect(room).toEqual(created);
    expect(getStoredRoom()).toEqual(created);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rooms'), { method: 'POST' });
  });

  it('동시에 여러 번 불러도 방 생성 요청은 한 번만 나감(캐싱)', async () => {
    const { getMyRoom } = await freshRoomModule();
    const created = { code: 'ONCE01', token: 'tok' };
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) });

    const [a, b] = await Promise.all([getMyRoom(), getMyRoom()]);

    expect(a).toEqual(created);
    expect(b).toEqual(created);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('방 생성이 실패(예: 429 rate limit)하면 에러 바디를 방인 척 저장하지 않고, 다음 호출이 다시 시도함', async () => {
    const { getMyRoom, getStoredRoom } = await freshRoomModule();
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429, json: () => Promise.resolve({ detail: 'too many rooms created' }) });

    await expect(getMyRoom()).rejects.toThrow();
    expect(getStoredRoom()).toBeNull(); // 에러 바디가 "방"으로 저장되지 않음

    const created = { code: 'RETRY1', token: 'tok' };
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) });

    const room = await getMyRoom(); // 실패가 캐싱되지 않아서 다시 시도됨

    expect(room).toEqual(created);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('getViewingRoomCode', () => {
  it('?room=이 없으면 내 방 코드를 그대로 돌려줌', async () => {
    const { getViewingRoomCode } = await freshRoomModule();
    expect(getViewingRoomCode('MINE01')).toBe('MINE01');
  });

  it('?room=이 있으면 그 코드를 대문자로 돌려줌(내 방과 달라도)', async () => {
    window.history.pushState({}, '', '/library.html?room=abcdef');
    const { getViewingRoomCode } = await freshRoomModule();
    expect(getViewingRoomCode('MINE01')).toBe('ABCDEF');
  });
});

describe('roomLink', () => {
  it('내 방을 보는 중이면 ?room=을 안 붙임', async () => {
    const { roomLink } = await freshRoomModule();
    expect(roomLink('library', 'MINE01', 'MINE01')).toBe('library');
  });

  it('남의 방을 보는 중이면 ?room=을 붙임', async () => {
    const { roomLink } = await freshRoomModule();
    expect(roomLink('library', 'OTHER1', 'MINE01')).toBe('library?room=OTHER1');
  });
});
