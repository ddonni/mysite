// 방명록 글의 "몇 분 전" 표시(js/library/social.js의 timeAgo).
import { describe, expect, it } from 'vitest';
import { timeAgo } from '../../js/library/social.js';

const NOW = Date.parse('2026-11-17T12:00:00Z');

describe('timeAgo', () => {
  it('방금 · 분 · 시간 · 일', () => {
    expect(timeAgo('2026-11-17T11:59:30Z', NOW)).toBe('방금');
    expect(timeAgo('2026-11-17T11:55:00Z', NOW)).toBe('5분 전');
    expect(timeAgo('2026-11-17T09:00:00Z', NOW)).toBe('3시간 전');
    expect(timeAgo('2026-11-15T12:00:00Z', NOW)).toBe('2일 전');
  });

  it('시간대 없이 오면 UTC로 봄(SQLite)', () => {
    expect(timeAgo('2026-11-17T11:55:00', NOW)).toBe('5분 전');
  });

  it('일주일이 넘으면 날짜, 이상한 값은 빈칸', () => {
    expect(timeAgo('2026-10-01T00:00:00Z', NOW)).toMatch(/^2026\.10\.0[12]$/);
    expect(timeAgo('', NOW)).toBe('');
    expect(timeAgo('nope', NOW)).toBe('');
  });
});
