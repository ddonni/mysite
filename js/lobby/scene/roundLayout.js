// [시안] 둥근(다각형) 방 배치 — ?layout=round 로 켤 때만 씀. 기본 사각 방은
// 그대로 두고, 같은 가구들을 이 배치로 옮겨 달아서 두 방을 비교해보려는 것.
//
// 생김새: 폭 FACE_W짜리 평평한 벽 4면을 STEP 각도씩 꺾어서 방 뒤쪽 반원
// (약 200°)을 감쌈. 앞(카메라 쪽)은 사각 방처럼 트여 있음. 가구마다 벽 한
// 면씩 정면으로 차지함(왼쪽부터 애니 → 책 → 영화 → 음악). 면이 평평하니
// 기존 책장/진열장/포스터 벽을 그대로 붙일 수 있음.
//
// 각도 φ는 방 가운데(원점)에서 봤을 때 "뒤(-z)"가 0, 오른쪽(+x)이 +.
import { WALL_H, WALL_LABEL_Y, BACK_WALL_Z, LEFT_WALL_X } from './roomDimensions.js';

const DEG = Math.PI / 180;
const FACE_W = 6.0;
const STEP = 50 * DEG;
export const APOTHEM = FACE_W / (2 * Math.tan(STEP / 2)); // 방 가운데 → 벽 안쪽 면까지 거리(≈6.43)
const FLOOR_R = APOTHEM / Math.cos(STEP / 2) + 0.3; // 꺾인 모서리까지 덮는 바닥 반지름

export const FACES = { anime: -75 * DEG, book: -25 * DEG, movie: 25 * DEG, music: 75 * DEG };

// 벽 φ 위의 한 점: 벽 가운데에서 옆으로 lx(벽을 마주 봤을 때 오른쪽이 +),
// 벽에서 방 안쪽으로 lz만큼 떨어진 곳.
function wallPoint(phi, lx = 0, lz = 0, y = 0) {
  const d = APOTHEM - lz;
  return new THREE.Vector3(Math.sin(phi) * d + Math.cos(phi) * lx, y, -Math.cos(phi) * d + Math.sin(phi) * lx);
}

// 사각 방 기준으로 이미 자리 잡힌 물체를 벽 φ로 옮겨 닮 — 벽 기준 옆 위치(lx)와
// 벽에서 떨어진 거리(lz), 높이는 그대로 유지하고 방 가운데를 보게 돌림.
function mount(obj, phi, lx, lz) {
  obj.position.copy(wallPoint(phi, lx, lz, obj.position.y));
  obj.rotation.set(0, -phi, 0);
}

function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

// 방 껍데기: 둥근 원목 바닥 + 꺾인 벽 4면 + 걸레받이 + 러그.
export function buildRoundShell(palette) {
  const room = new THREE.Group();

  // 바닥 — 판자 무늬를 캔버스로 그려 원판에 입힘(판자 사이 틈까지).
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  const planks = 26, pw = 1024 / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = hex(i % 2 === 0 ? palette.floorA : palette.floorB);
    ctx.fillRect(i * pw, 0, pw, 1024);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(i * pw, 0, 2, 1024);
    // 판자 이음매(가로 틈)를 판자마다 다른 높이에 하나씩.
    ctx.fillRect(i * pw, ((i * 397) % 1024), pw, 2);
  }
  const floorTex = new THREE.CanvasTexture(c);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(FLOOR_R, 96),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0.02 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.95 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.8 });
  // 이웃 벽과 모서리에서 틈이 안 생기게 살짝 겹치도록 폭을 조금 더 줌.
  const WALL_T = 0.12, OVER = 0.12;
  Object.values(FACES).forEach((phi) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(FACE_W + OVER, WALL_H, WALL_T), wallMat);
    wall.position.copy(wallPoint(phi, 0, -WALL_T / 2, WALL_H / 2));
    wall.rotation.y = -phi;
    wall.receiveShadow = true;
    room.add(wall);
    const base = new THREE.Mesh(new THREE.BoxGeometry(FACE_W + OVER, 0.16, 0.14), baseMat);
    base.position.copy(wallPoint(phi, 0, 0.05, 0.08));
    base.rotation.y = -phi;
    room.add(base);
  });

  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 0.03, 48),
    new THREE.MeshStandardMaterial({ color: palette.rug, roughness: 0.95 })
  );
  rug.position.set(0, 0.015, 0.9);
  rug.receiveShadow = true;
  room.add(rug);

  return room;
}

// 이미 지어진 가구들을 둥근 방 자리로 옮기고, 이 배치에 맞는 포인트 조명
// 위치와 카메라 프리셋을 돌려줌. 사각 방용 좌표(뒷벽 BACK_WALL_Z, 왼쪽 벽
// LEFT_WALL_X, 구역 가운데 bookX/movieX/animeZ)를 벽 기준 상대 좌표로 풀어서 옮김.
export function arrangeRound(p, { bookX, movieX, animeZ }) {
  const fromBack = (obj, phi, zoneX) => mount(obj, phi, obj.position.x - zoneX, obj.position.z - BACK_WALL_Z);

  [p.shelf, ...p.frames, p.bookLabel].forEach((o) => fromBack(o, FACES.book, bookX));
  [p.posterWall, p.movieLabel].forEach((o) => fromBack(o, FACES.movie, movieX));
  // 왼쪽 벽용으로 90° 돌려 지은 진열장/글씨 — 벽에서 떨어진 거리는 x, 옆 위치는 z.
  [p.displayCase, p.animeLabel].forEach((o) => mount(o, FACES.anime, -(o.position.z - animeZ), o.position.x - LEFT_WALL_X));

  // 음악: 턴테이블을 오른쪽 면 앞에 두고 벽에 MUSIC 글씨.
  mount(p.turntable, FACES.music, 0, 1.1);
  p.musicLabel.position.y = WALL_LABEL_Y;
  mount(p.musicLabel, FACES.music, 0, 0.08);

  // 가운데 자리들.
  p.easel.position.set(0, 0, 0.8);
  p.easel.rotation.y = 0.15;
  p.teddyBear.position.set(4.2, 0, 2.3);
  p.teddyBear.rotation.y = -0.8;
  p.floorLamp.position.set(-5.4, 0, 2.2);

  const accentLights = [
    [0xd9793a, 0.55, 0.3, 2.2, 2.2], // 이젤
    ...[['book', 0xc79a4b], ['anime', 0xd97aa0], ['movie', 0xc9564a], ['music', 0x4a9fc9]]
      .map(([k, color]) => { const v = wallPoint(FACES[k], 0, 1.4, 2.5); return [color, 0.5, v.x, v.y, v.z]; }),
  ];

  // 벽 가구는 전부 같은 거리·높이에서, 방 가운데 쪽에서 그 벽을 정면으로 봄.
  const wallFocus = (phi) => ({ theta: -phi, phi: 1.1, radius: 7.6, target: wallPoint(phi, 0, 0.5, 2.35) });
  const cameraPresets = {
    home: { theta: 0.22, phi: 1.12, radius: 15.5, target: new THREE.Vector3(0, 2.3, -1.6) },
    focus: {
      sketchbook: { theta: 0.3, phi: 1.05, radius: 4.6, target: new THREE.Vector3(0, 1.1, 0.8) },
      book: wallFocus(FACES.book),
      movie: wallFocus(FACES.movie),
      anime: wallFocus(FACES.anime),
      // 턴테이블은 벽에서 떨어져 바닥에 있어서, 턴테이블부터 벽 글씨까지 들어오게
      // 다른 벽보다 조금 낮은 곳을 가까이서 봄.
      music: { theta: -FACES.music, phi: 1.14, radius: 7.4, target: wallPoint(FACES.music, 0, 1.0, 2.3) },
    },
  };
  return { accentLights, cameraPresets };
}
