// 카테고리(책/애니/영화/음악)에 따라 달라지는 작은 설정들 —
// 폼 필드 라벨을 어떻게 바꿀지 판단하는 쪽(modal.js)이 이 설정만
// 보고 정하고, 실제 DOM 조작은 안 함.

// 카테고리마다 "만든 사람" 칸의 라벨이 다름 — 음악은 그 자리에 가수 이름을
// 받음.
// 제목 칸 안내 글씨 — 음악은 검색 결과가 노래가 아니라 그 노래가 실린 앨범으로 나와서
// (백엔드 music_search.py), "뉴질랜드"를 쳤는데 앨범 "원래"만 보여도 헷갈리지 않게 미리 알림.
export const TITLE_PLACEHOLDER = {
  book: '제목을 입력해 보세요',
  anime: '제목을 입력해 보세요',
  movie: '제목을 입력해 보세요',
  music: '노래 제목 — 검색하면 실린 앨범이 나와요',
};

export const CREATOR_FIELD = {
  book: { label: '작가' },
  anime: { label: '감독 / 제작사' },
  movie: { label: '감독' },
  music: { label: '가수' },
};
