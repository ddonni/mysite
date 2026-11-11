// 네모난 방의 치수 — 방 껍데기(roomShell.js), 가구 배치(roomLayout.js),
// 공/먼지처럼 "방 안에 머물러야 하는" 것들이 전부 이 값을 씀. 한 곳에서만
// 관리해야 방 크기를 바꿀 때 값이 안 어긋남.
//
// 생김새: 가로 ROOM_W × 깊이 ROOM_D의 직사각형 방 — 뒷벽과 양옆 벽 세 면, 앞(카메라
// 쪽)은 트여 있음. 원점은 방 가운데보다 조금 앞(러그·이젤 자리)이라 뒷벽이 앞쪽
// 끝보다 멀리 있음. (2026-11-11 사용자 요청 "방을 더 크게, 정말 방처럼"으로 둥근
// 3면 방(벽 7.2 × 3, 50°씩 꺾임)에서 바꿈 — 예전 모양은 git 기록 참고.)

const DEG = Math.PI / 180;
export const ROOM_W = 16;
export const ROOM_D = 12;
export const BACK_Z = -7; // 뒷벽 안쪽 면
export const FRONT_Z = BACK_Z + ROOM_D; // 트인 앞쪽 끝(=5)
export const SIDE_X = ROOM_W / 2; // 양옆 벽 안쪽 면
export const ROOM_CENTER_Z = (BACK_Z + FRONT_Z) / 2;

// 벽 하나 = { phi, d, c } — phi: 방 안에서 그 벽을 바라보는 방향(뒤(-z)가 0, 오른쪽(+x)이 +),
// d: 원점에서 벽 안쪽 면까지 거리, c: 벽을 마주 봤을 때 원점 정면에서 옆으로 얼마나
// 비켜 있는지(오른쪽이 +). roomLayout.js의 wallPoint가 이 셋으로 벽 위의 점을 구함.

// 방 껍데기의 벽 세 면(len = 벽 길이). 양옆 벽은 뒷벽부터 앞쪽 끝까지.
// (왼쪽 벽을 마주 보면 오른쪽이 -z, 오른쪽 벽을 마주 보면 오른쪽이 +z.)
export const SHELL_WALLS = [
  { phi: 0, d: -BACK_Z, c: 0, len: ROOM_W },
  { phi: -90 * DEG, d: SIDE_X, c: -ROOM_CENTER_Z, len: ROOM_D },
  { phi: 90 * DEG, d: SIDE_X, c: ROOM_CENTER_Z, len: ROOM_D },
];

// 벽 가구 자리. 책·애니·영화는 뒷벽 가운데 큰 책장 하나(2026-11-11 — 예전엔 세 벽에
// 따로). 옷장은 뒷벽 오른쪽 구석. 양옆 벽은 침대·음악 코너 등.
export const FACES = {
  // 책장은 가운데에서 왼쪽으로 조금 비켜 둠 — 오른쪽 구석 옷장(열린 문 포함)과 틈이 생기게.
  shelf: { phi: 0, d: -BACK_Z, c: -0.9 },
  left: { phi: -90 * DEG, d: SIDE_X, c: 0 },
  right: { phi: 90 * DEG, d: SIDE_X, c: 0 },
};

// 원점 둘레로 "방 안"이라 칠 원의 반지름 — 공이 튕기는 한계, 먼지가 떠다니는 범위,
// 카메라 목표 지점·인형 끌기의 한계(벽 가구 앞까지).
export const INNER_R = 6.2;

// 가구(높이 ~2.5) + 그 위 인생작(~3.9) 위로, 벽 글씨(wallLabel.js)가 들어갈
// 여백까지 남긴 높이. 글씨는 인생작 바로 위에 붙여서, 첫 화면에서 왼쪽 위
// 헤더에 최대한 덜 가리게 함.
export const WALL_H = 5.2;
export const WALL_LABEL_Y = 4.4;
// 벽에 거는 인생작(액자/포스터/스탠드)의 가운데 높이와 좌우 간격 — 세 벽이
// 전부 같은 짜임새로 보이게 맞춤.
export const FEATURED_Y = 3.35;
export const FEATURED_GAP = 1.8;
