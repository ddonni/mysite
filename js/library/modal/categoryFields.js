// 카테고리(책/애니/영화/음악/음식)에 따라 달라지는 작은 설정들 —
// 폼 필드 라벨을 어떻게 바꿀지 판단하는 쪽(modal.js)이 이 설정만
// 보고 정하고, 실제 DOM 조작은 안 함.

// 카테고리마다 "작가/감독/제작" 칸의 라벨이 다름 — 음악은 그 자리에
// 가수 이름을, 음식은 어디서/누가 만들었는지를 받음.
export const CREATOR_FIELD = {
  book: { label: '작가 / 감독 / 제작' },
  anime: { label: '작가 / 감독 / 제작' },
  movie: { label: '작가 / 감독 / 제작' },
  music: { label: '가수' },
  food: { label: '장소 / 만든 사람' },
};

// 음식은 제목이 없어도 되고(사진이 핵심), 대신 사진은 꼭 있어야 하고,
// 먹은 날짜를 손으로 적을 수 있음 — 나머지 카테고리는 반대(제목
// 필수/사진 선택/날짜는 항상 오늘로 서버가 자동으로 채움).
export function isFood(cat) { return cat === 'food'; }

// 날짜 입력칸(type=date)의 기본값 — 이 브라우저의 로컬 날짜 기준
// "오늘"을 YYYY-MM-DD로. (toISOString은 UTC라 자정 근처엔 하루가
// 밀릴 수 있어서 안 씀.)
export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
