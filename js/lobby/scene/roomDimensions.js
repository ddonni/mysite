// 방의 바닥/벽 치수 — 방 자체(roomShell.js)뿐 아니라 여러 가구가 "벽에
// 붙이기"/"바닥 가장자리 피하기" 계산에 이 값을 그대로 씀(예: 책장·영화
// 포스터는 뒷벽에, 애니 진열장·이젤은 왼쪽 벽에, 공/곰인형은 바닥 경계
// 안에 머물러야 함) — 한 곳에서만 관리해야 방 크기를 바꿀 때 값이 안 어긋남.
export const FLOOR_W = 13;
export const FLOOR_D = 8.6;
// 가구(높이 2.5) + 그 위 대표작(~3.94) 위로, 벽 글씨(wallLabel.js)가
// 들어갈 여백까지 남긴 높이. 글씨는 대표작 바로 위에 붙여서, 첫 화면에서
// 왼쪽 위 헤더에 최대한 덜 가리게 함.
export const WALL_H = 5.2;
export const WALL_LABEL_Y = 4.4;

// 뒷벽/왼쪽 벽 안쪽 면의 좌표 — 벽에 붙는 가구들이 이걸 기준으로 자리를 잡음.
export const BACK_WALL_Z = -FLOOR_D / 2;
export const LEFT_WALL_X = -FLOOR_W / 2;
