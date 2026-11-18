// 둥근(다각형) 방의 치수 — 방 껍데기(roomShell.js), 가구 배치(roomLayout.js),
// 공/먼지처럼 "방 안에 머물러야 하는" 것들이 전부 이 값을 씀. 한 곳에서만
// 관리해야 방 크기를 바꿀 때 값이 안 어긋남.
//
// 생김새: 폭 FACE_W짜리 평평한 벽 세 면을 FACE_STEP 각도씩 꺾어서 방 뒤쪽을
// 둥글게 감쌈. 앞(카메라 쪽)은 트여 있음. 벽이 평평하니 가구(책장 등)를 벽에
// 그대로 붙일 수 있음. (예전 네모난 방은 git 브랜치 rect-room에 있음.)

const DEG = Math.PI / 180;
// 벽 가구 폭(5.6)보다 양옆 0.8씩 넓게 — 벽이 꺾이는 모서리에서 옆 벽 가구와
// 끝이 맞닿지 않고 틈이 보이게 함.
export const FACE_W = 7.2;
const FACE_STEP = 50 * DEG;
// 방 가운데(원점) → 벽 안쪽 면까지 거리(≈7.72).
export const APOTHEM = FACE_W / (2 * Math.tan(FACE_STEP / 2));
// 꺾인 모서리까지 덮는 둥근 바닥 반지름.
export const FLOOR_R = APOTHEM / Math.cos(FACE_STEP / 2) + 0.3;

// 벽 면마다 올라가는 기록. 각도 φ는 방 가운데에서 봤을 때 "뒤(-z)"가 0,
// 오른쪽(+x)이 + — 왼쪽부터 애니 → 책(정면) → 영화, 좌우 대칭. 음악은 벽
// 없이 방 오른쪽 앞 턴테이블(roomLayout.js).
export const FACES = { anime: -50 * DEG, book: 0, movie: 50 * DEG };

// 가구(높이 ~2.5) + 그 위 인생작(~3.9) 위로, 벽 글씨(wallLabel.js)가 들어갈
// 여백까지 남긴 높이. 글씨는 인생작 바로 위에 붙여서, 첫 화면에서 왼쪽 위
// 헤더에 최대한 덜 가리게 함.
export const WALL_H = 5.2;
export const WALL_LABEL_Y = 4.4;
// 벽에 거는 인생작(액자/포스터/스탠드)의 가운데 높이와 좌우 간격 — 네 벽이
// 전부 같은 짜임새로 보이게 맞춤.
export const FEATURED_Y = 3.35;
export const FEATURED_GAP = 1.8;
