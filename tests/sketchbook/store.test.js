// store.js는 "API 저장소"와 "로컬 저장소" 둘 다 똑같은 인터페이스
// (getPage/setPage/subscribePage/shared)를 맞춰야 하는 파일이라, 그
// 계약이 실제로 지켜지는지가 가장 중요한 확인 포인트. 특히
// makeApiStore.getPage가 404("page not found")만 빈 배열로 삼키고
// 그 외 에러(예: 403 not room owner)는 그대로 던지는 분기를 확인함.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkApi, makeApiStore, makeLocalStore } from '../../js/sketchbook/store.js';

function jsonResponse(body, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn();
});

describe('makeApiStore', () => {
  it('shared: true', () => {
    expect(makeApiStore('ABC123', 'tok').shared).toBe(true);
  });

  it('getPage: 정상 응답이면 strokes 배열을 돌려줌', async () => {
    const store = makeApiStore('ABC123', 'tok');
    const strokes = [{ id: 's1', width: 4, points: [[0, 0]] }];
    global.fetch.mockResolvedValueOnce(jsonResponse({ page_number: 1, strokes }));

    await expect(store.getPage(1)).resolves.toEqual(strokes);
  });

  it('getPage: "page not found"(404)는 빈 배열로 삼킴 — 아직 안 그려진 페이지라 정상 상황', async () => {
    const store = makeApiStore('ABC123', 'tok');
    global.fetch.mockResolvedValueOnce(jsonResponse({ detail: 'page not found' }, false, 404));

    await expect(store.getPage(1)).resolves.toEqual([]);
  });

  it('getPage: 그 외 에러(예: 소유자 아님)는 그대로 던짐 — 삼키면 안 됨', async () => {
    const store = makeApiStore('ABC123', 'tok');
    global.fetch.mockResolvedValueOnce(jsonResponse({ detail: 'not room owner' }, false, 403));

    await expect(store.getPage(1)).rejects.toMatchObject({ code: 'not room owner' });
  });

  it('setPage: PUT으로 저장하고 X-Room-Token 헤더를 실어보냄', async () => {
    const store = makeApiStore('ABC123', 'owner-tok');
    global.fetch.mockResolvedValueOnce(jsonResponse({ page_number: 1, strokes: [] }));

    await store.setPage(1, []);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rooms/ABC123/pages/1'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'X-Room-Token': 'owner-tok', 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('subscribePage: WebSocket이 없는 환경(jsdom)에서도 안전하게 no-op 구독 해지 함수를 돌려줌', () => {
    const store = makeApiStore('ABC123', 'tok');
    const unsubscribe = store.subscribePage(1, () => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe('makeLocalStore', () => {
  it('shared: false', () => {
    expect(makeLocalStore().shared).toBe(false);
  });

  it('처음엔 빈 배열, setPage 후엔 저장한 strokes를 그대로 돌려줌(localStorage 왕복)', async () => {
    const store = makeLocalStore();
    await expect(store.getPage(3)).resolves.toEqual([]);

    const strokes = [{ id: 's1', width: 2, points: [[0.1, 0.2]] }];
    await store.setPage(3, strokes);

    await expect(store.getPage(3)).resolves.toEqual(strokes);
  });

  it('페이지 번호별로 서로 다른 localStorage 키를 씀(안 섞임)', async () => {
    const store = makeLocalStore();
    await store.setPage(1, [{ id: 'a' }]);
    await store.setPage(2, [{ id: 'b' }]);

    await expect(store.getPage(1)).resolves.toEqual([{ id: 'a' }]);
    await expect(store.getPage(2)).resolves.toEqual([{ id: 'b' }]);
  });

  it('subscribePage는 아무 것도 안 하는 구독(로컬 저장소는 실시간 동기화가 없음)', () => {
    const unsubscribe = makeLocalStore().subscribePage(1, () => {});
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe('checkApi', () => {
  it('응답이 ok면 true', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true });
    await expect(checkApi('ABC123', 3000)).resolves.toBe(true);
  });

  it('네트워크 에러/타임아웃이면 true/false 중 false로 딱 떨어짐(throw하지 않음)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    await expect(checkApi('ABC123', 3000)).resolves.toBe(false);
  });
});
