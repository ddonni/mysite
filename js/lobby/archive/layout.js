// 기억 보관소의 배치 규칙 — DOM·THREE 없이 숫자만 다루는 순수 함수(테스트: tests/lobby/layout.test.js).
//
// 보관소는 가운데 통로(z가 줄어드는 쪽으로 쭉 뻗음)를 따라 둥근 서가 탑이 왼쪽·오른쪽 번갈아 늘어선
// 구조. 탑마다 통로 쪽으로 볼록한 면의 선반 줄(row)마다 기록이 하나씩 — 책은 책, 영화·애니는 포스터,
// 음악은 앨범(covers.js). 기록은 **기록한 날짜 순**(오래된 것부터)으로 입구 쪽 탑의 맨 아랫줄부터 채워서,
// 기록이 늘수록 보관소 안쪽으로 차 감. 이미 놓인 자리는 새 기록이 생겨도 그대로(뒤에 붙기만 함).
// 2026-11-18 사용자 결정: 카테고리 구분 없이 한데 섞어서 진열. (처음엔 구슬이었다가 같은 날 "예전처럼 책·
// 포스터로" 바꿈.)

export const SHELF = {
  radius: 1.7,          // 탑 반지름(선반 벽)
  span: Math.PI * 1.2,  // 통로 쪽으로 열린 호의 각도(약 216°)
  rows: 6,             // 위에서 내려다볼 때 서가가 너무 높으면 아랫줄이 안 보여서 낮게
  baseY: 0.5,           // 맨 아랫줄 선반 높이
  rowGap: 0.52,         // 포스터(가장 큰 것) 높이 + 여유
  gap: 0.37,            // 한 줄 안 자리 사이(호의 길이)
};
SHELF.perRow = Math.floor((SHELF.radius * SHELF.span) / SHELF.gap);
SHELF.capacity = SHELF.perRow * SHELF.rows;
SHELF.height = SHELF.baseY + SHELF.rowGap * SHELF.rows + 0.1;

export const AISLE = {
  halfWidth: 3.05,  // 통로 가운데에서 탑 중심까지(x)
  step: 5.4,        // 같은 쪽 탑 사이(z)
  startZ: -4,       // 첫 탑의 z
  minTowers: 4,     // 기록이 적어도 통로가 생기게 양옆 두 쌍
};

// 기록이 차 있는 탑 + 빈 탑 하나(아직 채울 자리)만 — 빈 탑이 많으면 기록이 적은 사람에겐 텅 빈 창고처럼
// 보였음(2026-11-18 평가). 통로가 생기게 최소 두 쌍, 왼쪽·오른쪽 짝 맞춤.
export function towerCount(recordCount) {
  const need = Math.ceil(recordCount / SHELF.capacity) + 1;
  const n = Math.max(AISLE.minTowers, need);
  return n + (n % 2); // 왼쪽·오른쪽 짝 맞춤
}

// i번째 탑의 중심과 통로를 향한 방향(각도). 짝수는 왼쪽, 홀수는 오른쪽, 조금씩 흔들어 구불구불한 길처럼.
export function towerPlacement(i) {
  const side = i % 2 === 0 ? -1 : 1;
  const k = Math.floor(i / 2);
  const wobble = Math.sin(k * 1.7 + side) * 0.45;
  const x = side * (AISLE.halfWidth + wobble);
  const z = AISLE.startZ - k * AISLE.step - (side > 0 ? AISLE.step / 2 : 0);
  // 볼록한 면의 가운데가 통로 쪽(+x면 -x 방향)을 봄. THREE의 원기둥 각도 기준(θ=0이 +z, 반시계)으로
  // 면의 가운데 방향 각도 = atan2(dx, dz).
  const facing = Math.atan2(-side, 0.18);
  return { x, z, facing, side };
}

// 탑 하나 안의 j번째 자리(0부터, 아랫줄 → 윗줄, 줄 안에서는 호의 한쪽 끝 → 다른 끝).
// (x, z)는 선반 벽 바로 바깥, y는 그 줄 선반 윗면(물건 바닥), angle은 바깥(앞면)을 보는 각도.
export function slotPosition(tower, j) {
  const row = Math.floor(j / SHELF.perRow);
  const col = j % SHELF.perRow;
  const start = tower.facing - SHELF.span / 2;
  const a = start + ((col + 0.5) / SHELF.perRow) * SHELF.span;
  const r = SHELF.radius + 0.1; // 물건이 뒤로 살짝 기대니 벽에서 조금 띄워 세움
  return {
    x: tower.x + Math.sin(a) * r,
    y: SHELF.baseY + row * SHELF.rowGap,
    z: tower.z + Math.cos(a) * r,
    angle: a,
    row,
    col,
  };
}

// 기록을 놓을 순서 — 날짜(없으면 맨 앞), 같으면 id(먼저 쓴 것). 원본 배열은 건드리지 않음.
export function archiveOrder(records) {
  return records.slice().sort((a, b) => {
    const da = a.date || '', db = b.date || '';
    if (da !== db) return da < db ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });
}

// 기록 목록 → 탑 목록 + 자리마다 { tower, index, position, record|null }.
export function layoutArchive(records) {
  const ordered = archiveOrder(records || []);
  const towers = Array.from({ length: towerCount(ordered.length) }, (_, i) => towerPlacement(i));
  const slots = [];
  towers.forEach((tower, t) => {
    for (let j = 0; j < SHELF.capacity; j++) {
      const index = t * SHELF.capacity + j;
      slots.push({ tower: t, index, position: slotPosition(tower, j), record: ordered[index] || null });
    }
  });
  return { towers, slots, filled: ordered.length };
}

// 통로 끝(카메라가 갈 수 있는 z의 한계) — 마지막 탑보다 조금 더.
export function aisleEnd(towers) {
  const last = towers[towers.length - 1];
  return (last ? last.z : AISLE.startZ) - 3;
}

// 걸어다닐 때 탑 안으로 들어가지 않게 — (x, z)를 가장 가까운 탑 밖으로 밀어냄. 통로 바깥 경계도.
export function keepWalkable(x, z, towers, { margin = 0.75, endZ = aisleEnd(towers) } = {}) {
  let px = Math.max(-AISLE.halfWidth - 2.6, Math.min(AISLE.halfWidth + 2.6, x));
  let pz = Math.max(endZ, Math.min(6, z));
  const minD = SHELF.radius + margin;
  towers.forEach((t) => {
    const dx = px - t.x, dz = pz - t.z;
    const d = Math.hypot(dx, dz);
    if (d < minD) {
      const k = d > 1e-6 ? minD / d : 1;
      px = t.x + (d > 1e-6 ? dx : -t.side) * k;
      pz = t.z + (d > 1e-6 ? dz : 0) * k;
    }
  });
  return { x: px, z: pz };
}
