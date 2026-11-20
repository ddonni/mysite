// 일기 쓰기 페이지(js/diary/) — 임시 저장(새 일기만, 비면 지움)과 서버로 보낼 값(본문 필수).
import { describe, expect, it } from 'vitest';
import { DRAFT_KEY, clearDraft, countChars, diaryRecord, readDraft, todayIso, writeDraft } from '../../js/diary/draft.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('임시 저장', () => {
  it('쓰던 제목·본문·날짜를 남기고 다시 불러옴, 저장하면 지움', () => {
    const st = memoryStorage();
    writeDraft({ title: '첫눈', memo: '눈이 왔다', date: '2026-11-19' }, st);
    expect(readDraft(st)).toEqual({ title: '첫눈', memo: '눈이 왔다', date: '2026-11-19' });
    clearDraft(st);
    expect(readDraft(st)).toBeNull();
  });

  it('제목·본문을 다 지우면 임시 저장도 지움, 깨진 값은 무시', () => {
    const st = memoryStorage();
    writeDraft({ title: 'a', memo: '', date: '' }, st);
    writeDraft({ title: '', memo: '', date: '2026-11-19' }, st);
    expect(st.getItem(DRAFT_KEY)).toBeNull();
    st.setItem(DRAFT_KEY, '{oops');
    expect(readDraft(st)).toBeNull();
  });

  it('저장 공간이 막혀 있어도 터지지 않음', () => {
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
    expect(readDraft(broken)).toBeNull();
    expect(() => writeDraft({ title: 'a', memo: 'b' }, broken)).not.toThrow();
    expect(() => clearDraft(broken)).not.toThrow();
  });
});

describe('저장할 값', () => {
  it('본문이 비면 null, 아니면 앞뒤 공백을 자른 일기 기록', () => {
    expect(diaryRecord({ memo: '  \n ' })).toBeNull();
    expect(diaryRecord({ title: ' 첫눈 ', memo: ' 눈이 왔다\n추웠다 ', date: '2026-11-19' }))
      .toEqual({ cat: 'diary', title: '첫눈', memo: '눈이 왔다\n추웠다', date: '2026-11-19', photos: [], photo_url: null });
    // 첫 장이 표지.
    expect(diaryRecord({ memo: 'a', photos: ['https://x/1.jpg', 'https://x/2.jpg'] }).photo_url).toBe('https://x/1.jpg');
  });

  it('글자 수·오늘 날짜', () => {
    expect(countChars('  눈이 왔다 ')).toBe(5);
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
