// 일기 쓰기 페이지의 순수한 규칙들 — DOM 없이 테스트할 수 있게 main.js에서 뺌.
//   - 임시 저장: 새 일기를 쓰다가 창을 닫거나 새로고침해도 이 브라우저에 남겨 둠(저장하면 지움). 고치던
//     일기는 서버에 원본이 있어서 임시 저장하지 않음.
//   - 저장할 값: 백엔드 schemas.RecordIn의 일기 규칙(본문 필수, 제목은 비워도 됨, 날짜는 고른 날).

export const DRAFT_KEY = 'mysite:diary-draft';

// 이 기기의 오늘(YYYY-MM-DD) — 날짜 칸의 기본값.
export function todayIso(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function readDraft(storage = globalThis.localStorage) {
  try {
    const d = JSON.parse(storage.getItem(DRAFT_KEY) || 'null');
    return d && typeof d === 'object' && (d.title || d.memo) ? d : null;
  } catch (e) {
    return null;
  }
}

export function writeDraft(draft, storage = globalThis.localStorage) {
  try {
    if (!draft.title && !draft.memo) storage.removeItem(DRAFT_KEY);
    else storage.setItem(DRAFT_KEY, JSON.stringify({ title: draft.title, memo: draft.memo, date: draft.date }));
  } catch (e) { /* 저장 공간이 막혀 있으면 임시 저장만 못 함 */ }
}

export function clearDraft(storage = globalThis.localStorage) {
  try { storage.removeItem(DRAFT_KEY); } catch (e) { /* 위와 같음 */ }
}

// 입력값 → 서버로 보낼 기록. 본문이 비면 null(저장하지 않음).
// photos는 순서대로의 사진 주소들 — 첫 장이 카드 표지(photo_url)가 됨(서버도 같은 규칙으로 맞춤).
export function diaryRecord({ title, memo, date, photos = [] }) {
  const body = (memo || '').trim();
  if (!body) return null;
  return { cat: 'diary', title: (title || '').trim(), memo: body, date: date || null, photos, photo_url: photos[0] || null };
}

// 글자 수(공백 포함, 앞뒤 공백 제외) — 아래 줄에 보여 줌.
export const countChars = (s) => [...(s || '').trim()].length;
