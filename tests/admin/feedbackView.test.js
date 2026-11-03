import { describe, it, expect } from 'vitest';
import { pageLabel, timeAgo, filterFeedback, isNew } from '../../js/admin/feedbackView.js';

describe('pageLabel', () => {
  it('보낸 화면 경로를 이름으로', () => {
    expect(pageLabel('/mysite/')).toBe('로비');
    expect(pageLabel('/mysite/index.html')).toBe('로비');
    expect(pageLabel('/mysite/library')).toBe('기록 보관소');
    expect(pageLabel('/mysite/sketchbook.html')).toBe('캔버스');
    expect(pageLabel('/mysite/rooms')).toBe('방 둘러보기');
  });

  it('모르는 경로는 그대로, 없으면 빈 문자열', () => {
    expect(pageLabel('/somewhere/else')).toBe('/somewhere/else');
    expect(pageLabel(null)).toBe('');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-03T12:00:00');
  it('가까운 시간은 상대적으로', () => {
    expect(timeAgo('2026-11-03T11:59:40', now)).toBe('방금');
    expect(timeAgo('2026-11-03T11:55:00', now)).toBe('5분 전');
    expect(timeAgo('2026-11-03T09:00:00', now)).toBe('3시간 전');
    expect(timeAgo('2026-11-02T10:00:00', now)).toBe('어제');
    expect(timeAgo('2026-10-30T12:00:00', now)).toBe('4일 전');
  });

  it('일주일 넘으면 날짜, 올해가 아니면 연도까지', () => {
    expect(timeAgo('2026-10-22T12:00:00', now)).toBe('10월 22일');
    expect(timeAgo('2025-12-31T12:00:00', now)).toBe('2025년 12월 31일');
  });

  it('잘못된 값은 빈 문자열', () => {
    expect(timeAgo('nope', now)).toBe('');
  });
});

describe('filterFeedback', () => {
  const items = [
    { id: 1, message: 'RGB로 색 고르기', name: '민기', room_code: 'TTHB8N' },
    { id: 2, message: '음악 재생', name: null, room_code: null },
  ];
  it('내용·이름·방 코드에서 대소문자 무시하고 찾음', () => {
    expect(filterFeedback(items, 'rgb').map((f) => f.id)).toEqual([1]);
    expect(filterFeedback(items, '민기').map((f) => f.id)).toEqual([1]);
    expect(filterFeedback(items, 'tthb').map((f) => f.id)).toEqual([1]);
    expect(filterFeedback(items, '재생').map((f) => f.id)).toEqual([2]);
  });

  it('빈 검색어면 전부', () => {
    expect(filterFeedback(items, '  ')).toBe(items);
  });
});

describe('isNew', () => {
  it('지난번 본 것보다 id가 크면 새 의견, 처음 열면 표시 안 함', () => {
    expect(isNew({ id: 5 }, 3)).toBe(true);
    expect(isNew({ id: 3 }, 3)).toBe(false);
    expect(isNew({ id: 5 }, null)).toBe(false);
  });
});
