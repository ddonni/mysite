// 가구를 네모난 방의 어느 자리에 둘지 정하는 곳 — 벽 가구 마운트, 가운데
// 소품(이젤/턴테이블 등) 위치, 가구별 포인트 조명, 카메라 프리셋(첫 화면/
// 가구 포커스)까지.
// 가구 모듈(furniture/*.js)은 "자기 벽 기준" 좌표로만 지어짐(x = 벽을 마주
// 봤을 때 옆 위치, z = 벽에서 방 안쪽으로 떨어진 거리) — 여기서 그걸 실제
// 벽 위치로 옮김.
import { FACES, INNER_R, BACK_Z } from './roomDimensions.js';

// 벽(roomDimensions.js의 { phi, d, c }) 위의 한 점: 벽 자리에서 옆으로 lx(벽을
// 마주 봤을 때 오른쪽이 +), 벽에서 방 안쪽으로 lz만큼 떨어진 곳, 높이 y.
export function wallPoint(wall, lx = 0, lz = 0, y = 0) {
  const { phi } = wall;
  const d = wall.d - lz;
  const s = wall.c + lx;
  return new THREE.Vector3(Math.sin(phi) * d + Math.cos(phi) * s, y, -Math.cos(phi) * d + Math.sin(phi) * s);
}

// 벽 기준 좌표로 지어진 물체를 그 벽으로 옮겨 달고 방 안쪽을 보게 돌림.
function mount(obj, wall) {
  const { x, y, z } = obj.position;
  obj.position.copy(wallPoint(wall, x, z, y));
  obj.rotation.y = -wall.phi;
}

// p: scene.js가 지은 가구들. 각 벽 가구를 마운트하고 가운데 소품 자리를
// 잡은 뒤, 이 배치에 맞는 포인트 조명 목록과 카메라 프리셋을 돌려줌.
export function arrangeRoom(p) {
  p.walls.forEach(({ face, items }) => items.forEach((o) => mount(o, FACES[face])));

  // 가운데 — 러그(roomShell.js) 위 이젤, 앞쪽 양 구석의 침대+스탠드/음악 코너,
  // 곰인형과 공. 음악은 벽 없이 오른쪽 앞에 턴테이블을 얹은 LP 보관함(레코드
  // 콘솔) — 방 가운데 쪽을 보게 비스듬히. 옷장은 뒷벽 오른쪽 구석.
  p.easel.position.set(0, 0, 0.6);
  p.easel.rotation.y = 0;
  p.recordConsole.position.set(5.6, 0, 2.4);
  p.recordConsole.rotation.y = -0.85;
  p.teddyBear.position.set(-3.0, 0, 3.4);
  p.teddyBear.rotation.y = 0.5;
  // 토끼 인형은 곰인형 오른쪽 옆에, 곰 쪽으로 살짝 몸을 돌려 나란히 앉음.
  p.bunny.position.set(-1.85, 0, 3.75);
  p.bunny.rotation.y = 0.15;
  // 왼쪽 앞 구석 침대 — 머리를 왼쪽 벽 쪽으로, 발치가 방 가운데를 향하게.
  // 스탠드는 머리맡 안쪽 옆(카메라에서 먼 쪽)에 둬서 침대 옆 조명처럼
  // 보이면서 헤드보드를 가리지 않게 함.
  p.bed.position.set(-6.3, 0, 2.3);
  p.bed.rotation.y = 0.05;
  p.floorLamp.position.set(-7.3, 0, 1.0);
  p.ball.position.set(2.2, p.ball.position.y, 3.4);
  // 옷장 — 뒷벽 오른쪽 구석(책장 끝과 오른쪽 벽 사이)에 벽을 등지고. 문이 열려 있어서
  // 정면(첫 화면)에서 안에 걸린 옷이 보임.
  p.wardrobe.position.set(6.6, 0, BACK_Z + 0.35);
  p.wardrobe.rotation.y = 0;

  // 포인트 조명 [색, 세기, x, y, z]:
  //  - 벽마다 따뜻한 흰빛 하나씩(wash) — 멀리서도 벽 가구와 인생작이 어둡게
  //    묻히지 않게 벽을 고르게 밝힘.
  //  - 벽마다 그 기록의 색을 띤 은은한 빛(accent) — "무슨 기록인지"만 살짝.
  const colors = { shelf: 0xc79a4b };
  const mc = p.recordConsole.position;
  const wr = p.wardrobe.position;
  // 세기는 2026-10-25에 전부 ×0.6(방 한 단계 어둡게 — lighting.js 설명).
  const lights = [
    [0xd9793a, 0.33, 0.3, 2.2, 2.0], // 이젤
    [0x4a9fc9, 0.3, mc.x - 0.9, 2.0, mc.z + 0.7], // 음악 코너
    [0x8baa6e, 0.25, wr.x - 0.4, 2.2, wr.z + 1.6], // 옷장
  ];
  // 책장은 넓어서 흰빛을 양쪽에 하나씩 더. 양옆 벽은 흰빛만.
  [-3.2, 0, 3.2].forEach((lx) => {
    const wash = wallPoint(FACES.shelf, lx, 2.4, 3.4);
    lights.push([0xfff0dc, lx ? 0.36 : 0.51, wash.x, wash.y, wash.z]);
  });
  const accent = wallPoint(FACES.shelf, 0, 1.4, 1.6);
  lights.push([colors.shelf, 0.27, accent.x, accent.y, accent.z]);
  ['left', 'right'].forEach((k) => {
    const wash = wallPoint(FACES[k], 0, 2.4, 3.4);
    lights.push([0xfff0dc, 0.36, wash.x, wash.y, wash.z]);
  });

  // 벽 가구는 전부 같은 거리·높이에서, 방 가운데 쪽에서 그 벽을 정면으로 봄 —
  // 가구 + 그 위 인생작 + 벽 글씨가 한 화면에 들어옴.
  const wallFocus = (wall) => ({ theta: -wall.phi, phi: 1.1, radius: 7.6, target: wallPoint(wall, 0, 0.5, 2.35) });
  const cameraPresets = {
    // 뒷벽(책)이 정면 가운데에 오고 양옆 벽이 좌우 대칭으로 보이게, 거의 정면에서.
    // 목표 지점을 높여 방을 화면 아래쪽으로 내림 — 왼쪽 위 헤더(방 코드·
    // 구글 버튼)에 벽 글씨가 가리지 않게.
    home: { theta: 0.08, phi: 0.92, radius: 21.5, target: new THREE.Vector3(0.2, 2.4, -1.0) },
    focus: {
      sketchbook: { theta: 0.2, phi: 1.05, radius: 4.6, target: new THREE.Vector3(0, 1.1, 0.6) },
      // 큰 책장은 폭이 넓어서 조금 더 뒤에서 — 칸 전체와 위 액자 줄이 한 화면에.
      shelf: { ...wallFocus(FACES.shelf), radius: 10.5 },
      // LP 보관함을 정면(방 가운데 쪽)에서 — 턴테이블과 칸 속 LP가 같이 보이게.
      music: { theta: -0.85, phi: 1.12, radius: 4.4, target: new THREE.Vector3(mc.x, 0.95, mc.z) },
      // 옷장을 정면에서 — 열린 문 안의 옷과 서랍 위 소품이 같이 보이게.
      wardrobe: { theta: -0.2, phi: 1.2, radius: 5.4, target: new THREE.Vector3(wr.x - 0.3, 1.2, wr.z + 0.3) },
    },
    // 휠로 커서 쪽을 확대할 때 카메라 목표 지점이 방 밖으로 나가지 않게 하는 한계.
    targetLimit: { radius: INNER_R + 1.5, minY: 0.5, maxY: 4.2 },
  };
  return { lights, cameraPresets };
}
