// 가구를 둥근 방의 어느 자리에 둘지 정하는 곳 — 벽 가구 마운트, 가운데
// 소품(이젤/턴테이블 등) 위치, 가구별 포인트 조명, 카메라 프리셋(첫 화면/
// 가구 포커스)까지.
// 가구 모듈(furniture/*.js)은 "자기 벽 기준" 좌표로만 지어짐(x = 벽을 마주
// 봤을 때 옆 위치, z = 벽에서 방 안쪽으로 떨어진 거리) — 여기서 그걸 실제
// 벽 위치로 옮김.
import { APOTHEM, FACES } from './roomDimensions.js';

// 벽 φ 위의 한 점: 벽 가운데에서 옆으로 lx(벽을 마주 봤을 때 오른쪽이 +),
// 벽에서 방 안쪽으로 lz만큼 떨어진 곳, 높이 y.
export function wallPoint(phi, lx = 0, lz = 0, y = 0) {
  const d = APOTHEM - lz;
  return new THREE.Vector3(Math.sin(phi) * d + Math.cos(phi) * lx, y, -Math.cos(phi) * d + Math.sin(phi) * lx);
}

// 벽 기준 좌표로 지어진 물체를 벽 φ로 옮겨 달고 방 가운데를 보게 돌림.
function mount(obj, phi) {
  const { x, y, z } = obj.position;
  obj.position.copy(wallPoint(phi, x, z, y));
  obj.rotation.y = -phi;
}

// p: scene.js가 지은 가구들. 각 벽 가구를 마운트하고 가운데 소품 자리를
// 잡은 뒤, 이 배치에 맞는 포인트 조명 목록과 카메라 프리셋을 돌려줌.
export function arrangeRoom(p) {
  p.walls.forEach(({ face, items }) => items.forEach((o) => mount(o, FACES[face])));

  // 가운데 — 러그(roomShell.js) 위 이젤, 앞쪽 양 구석의 스탠드/음악 코너,
  // 곰인형과 공. 음악은 벽 없이 오른쪽 앞에 턴테이블을 얹은 LP 보관함(레코드
  // 콘솔) — 방 가운데 쪽을 보게 비스듬히.
  p.easel.position.set(0, 0, 0.8);
  p.easel.rotation.y = 0;
  p.recordConsole.position.set(4.6, 0, 1.5);
  p.recordConsole.rotation.y = -0.85;
  p.teddyBear.position.set(-3.3, 0, 3.1);
  p.teddyBear.rotation.y = 0.5;
  p.floorLamp.position.set(-4.9, 0, 2.2);
  p.ball.position.set(2.0, p.ball.position.y, 3.2);

  // 포인트 조명 [색, 세기, x, y, z]:
  //  - 벽마다 따뜻한 흰빛 하나씩(wash) — 멀리서도 벽 가구와 대표작이 어둡게
  //    묻히지 않게 벽을 고르게 밝힘.
  //  - 벽마다 그 기록의 색을 띤 은은한 빛(accent) — "무슨 기록인지"만 살짝.
  const colors = { anime: 0xd97aa0, book: 0xc79a4b, movie: 0xc9564a };
  const mc = p.recordConsole.position;
  const lights = [
    [0xd9793a, 0.55, 0.3, 2.2, 2.2], // 이젤
    [0x4a9fc9, 0.5, mc.x - 0.9, 2.0, mc.z + 0.7], // 음악 코너
  ];
  Object.keys(FACES).forEach((k) => {
    const wash = wallPoint(FACES[k], 0, 2.4, 3.4);
    lights.push([0xfff0dc, 0.85, wash.x, wash.y, wash.z]);
    const accent = wallPoint(FACES[k], 0, 1.4, 1.6);
    lights.push([colors[k], 0.45, accent.x, accent.y, accent.z]);
  });

  // 벽 가구는 전부 같은 거리·높이에서, 방 가운데 쪽에서 그 벽을 정면으로 봄 —
  // 가구 + 그 위 대표작 + 벽 글씨가 한 화면에 들어옴.
  const wallFocus = (phi) => ({ theta: -phi, phi: 1.1, radius: 7.6, target: wallPoint(phi, 0, 0.5, 2.35) });
  const cameraPresets = {
    // 책 벽이 정면 가운데에 오고 세 벽이 좌우 대칭으로 보이게, 거의 정면에서.
    // 목표 지점을 높여 방을 화면 아래쪽으로 내림 — 왼쪽 위 헤더(방 코드·
    // 구글 버튼)에 애니 벽 글씨가 가리지 않게.
    home: { theta: 0.12, phi: 1.08, radius: 18.2, target: new THREE.Vector3(0.3, 3.9, -1.4) },
    focus: {
      sketchbook: { theta: 0.2, phi: 1.05, radius: 4.6, target: new THREE.Vector3(0, 1.1, 0.8) },
      book: wallFocus(FACES.book),
      movie: wallFocus(FACES.movie),
      anime: wallFocus(FACES.anime),
      // LP 보관함을 정면(방 가운데 쪽)에서 — 턴테이블과 칸 속 LP가 같이 보이게.
      music: { theta: -0.85, phi: 1.12, radius: 4.4, target: new THREE.Vector3(mc.x, 0.95, mc.z) },
    },
    // 휠로 커서 쪽을 확대할 때 카메라 목표 지점이 방 밖으로 나가지 않게 하는 한계.
    targetLimit: { radius: APOTHEM - 0.5, minY: 0.5, maxY: 4.2 },
  };
  return { lights, cameraPresets };
}
