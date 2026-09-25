import { FACE_W, FACES, FLOOR_R, WALL_H } from './roomDimensions.js';
import { wallPoint } from './roomLayout.js';

// 방의 뼈대: 둥근 원목 바닥 + 꺾인 벽 여러 면(뒤쪽 반원, 앞은 트여 있어야
// 카메라가 안을 들여다봄) + 걸레받이 + 가운데 러그. palette는 scene.js의
// THEMES 중 하나(바닥/벽/러그 색만 담당 — 가구 색은 테마와 무관).

function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

export function buildRoomShell(palette) {
  const room = new THREE.Group();

  // 바닥 — 판자 무늬(판자 사이 세로 틈 + 판자마다 다른 높이의 이음매)를
  // 캔버스로 그려 원판에 입힘.
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  const planks = 26, pw = 1024 / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = hex(i % 2 === 0 ? palette.floorA : palette.floorB);
    ctx.fillRect(i * pw, 0, pw, 1024);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(i * pw, 0, 2, 1024);
    ctx.fillRect(i * pw, (i * 397) % 1024, pw, 2);
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

  // 바닥 바깥으로 번지는 그림자 바닥 — 원목 바닥 가장자리에서 바닥색이
  // 이어지다가 점점 투명해져 배경으로 녹아듦. 둥근 바닥이 새까만 허공에
  // 뚝 끊겨 떠 있는 것처럼 보이지 않게 함.
  const FADE_R = FLOOR_R * 2.4;
  const fc = document.createElement('canvas');
  fc.width = 512; fc.height = 512;
  const fctx = fc.getContext('2d');
  const base = hex(palette.floorB);
  const rgb = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16)).join(',');
  const inner = FLOOR_R / FADE_R;
  const fg = fctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  fg.addColorStop(0, `rgba(${rgb},1)`);
  fg.addColorStop(inner, `rgba(${rgb},0.9)`);
  fg.addColorStop(inner + (1 - inner) * 0.45, `rgba(${rgb},0.35)`);
  fg.addColorStop(1, `rgba(${rgb},0)`);
  fctx.fillStyle = fg;
  fctx.fillRect(0, 0, 512, 512);
  const fadeTex = new THREE.CanvasTexture(fc);
  fadeTex.colorSpace = THREE.SRGBColorSpace;
  const fade = new THREE.Mesh(
    new THREE.CircleGeometry(FADE_R, 96),
    new THREE.MeshStandardMaterial({ map: fadeTex, transparent: true, depthWrite: false, roughness: 1 })
  );
  fade.rotation.x = -Math.PI / 2;
  fade.position.y = -0.02;
  fade.receiveShadow = true;
  room.add(fade);

  const wallMat = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.95 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.8 });
  // 이웃 벽과 꺾이는 모서리에서 틈이 안 생기게 살짝 겹치도록 폭을 조금 더 줌.
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
