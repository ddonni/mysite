// 카테고리(책/애니/영화/음악)에 따라 달라지는 작은 설정들 —
// 폼 필드 라벨을 어떻게 바꿀지 판단하는 쪽(modal.js)이 이 설정만
// 보고 정하고, 실제 DOM 조작은 안 함.

// 카테고리마다 "만든 사람" 칸의 라벨이 다름 — 음악은 그 자리에 가수 이름을
// 받음.
// 제목 칸 안내 글씨 — 음악은 검색 화면과 같은 검색이라(findWorks.js) 가수 이름을 쳐도
// 그 가수의 노래가 나옴.
export const TITLE_PLACEHOLDER = {
  book: '제목을 입력해 보세요',
  anime: '제목을 입력해 보세요',
  movie: '영화·시리즈 제목을 입력해 보세요',
  music: '노래 제목 — 가수 이름으로도 찾아요',
  wardrobe: '예: 흰 옥스포드 셔츠',
};

// 옷장은 감상 기록이 아니라서 칸 이름이 다름(제목 → 옷 이름, 한 줄 감상 → 메모).
export const TITLE_LABEL = { wardrobe: '옷 이름' };
export const MEMO_FIELD = {
  wardrobe: { label: '메모 (선택)', placeholder: '산 곳·사이즈·어울리는 옷 같은 것' },
};
export const DEFAULT_MEMO = { label: '한 줄 감상', placeholder: '어땠는지 한 줄로 남겨보세요' };

export const CREATOR_FIELD = {
  book: { label: '작가' },
  anime: { label: '감독 / 제작사' },
  movie: { label: '감독' },
  music: { label: '가수' },
  wardrobe: { label: '브랜드 (선택)' },
};
