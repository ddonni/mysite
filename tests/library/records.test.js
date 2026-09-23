// records.js는 순수하게 "서버에 뭘 물어보고 뭘 돌려받는지"만 다루는
// 파일이라(DOM 없음) fetch만 목(mock)으로 바꿔치기하면 통째로
// 테스트할 수 있음. 여기서 확인하는 건 특히 res.ok 분기 — 방금 실전에서
// 겪은 버그(fetchRecords가 404의 에러 바디를 정상 데이터인 척 넘겨서
// 화면에 "undefined"가 찍힌 것)의 재발을 막기 위한 회귀 테스트.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteRecord, fetchRecords, saveRecord, setFeatured, setRoom } from '../../js/library/records.js';

function jsonResponse(body, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  setRoom('ABC123', 'owner-token');
  global.fetch = vi.fn();
});

describe('fetchRecords', () => {
  it('방 코드로 목록 경로를 조회하고, 성공하면 JSON 배열을 그대로 돌려줌', async () => {
    const items = [{ id: 1, cat: 'book', title: '데미안' }];
    global.fetch.mockResolvedValueOnce(jsonResponse(items));

    const result = await fetchRecords();

    expect(result).toEqual(items);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rooms/ABC123/records'));
  });

  it('응답이 !ok면 에러 바디를 데이터인 척 넘기지 않고 reject함', async () => {
    // 실제로 겪은 버그: 방이 없어서 404가 오면 바디가
    // {"detail":"room not found"}인데, res.ok를 안 보면 이걸 그대로
    // "기록 목록"으로 취급해버려서 호출부가 배열 메서드(.length 등)를
    // 부르다가 깨짐.
    global.fetch.mockResolvedValueOnce(jsonResponse({ detail: 'room not found' }, false, 404));

    await expect(fetchRecords()).rejects.toThrow();
  });
});

describe('deleteRecord', () => {
  it('성공하면 resolve됨', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({}, true));
    await expect(deleteRecord(1)).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rooms/ABC123/records/1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('실패하면 reject됨(소유자 토큰이 없거나 이미 지워진 경우 등)', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ detail: 'not_found' }, false, 404));
    await expect(deleteRecord(1)).rejects.toThrow();
  });
});

describe('setFeatured', () => {
  it('PUT으로 featured 값을 보내고, 실패하면 reject함', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({}, true));
    await expect(setFeatured(1, true)).resolves.toBeUndefined();

    global.fetch.mockResolvedValueOnce(jsonResponse({}, false, 403));
    await expect(setFeatured(1, true)).rejects.toThrow();
  });
});

describe('saveRecord', () => {
  it('editingId가 없으면 POST로 새로 만듦', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({}, true));
    await saveRecord({ cat: 'food', photo_url: 'https://x/y.jpg' }, null);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rooms/ABC123/records'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('editingId가 있으면 그 id로 PUT함', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({}, true));
    await saveRecord({ cat: 'food' }, 42);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rooms/ABC123/records/42'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('실패 응답이면 reject함', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ detail: 'invalid' }, false, 422));
    await expect(saveRecord({ cat: 'food' }, null)).rejects.toThrow();
  });
});
