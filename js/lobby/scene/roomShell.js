import { FLOOR_W, FLOOR_D, WALL_H } from './roomDimensions.js';

// 방의 뼈대: 나무 바닥(판자 여러 개를 이어붙여 살짝 얼룩덜룩하게),
// 뒷벽 + 왼쪽 벽(카메라가 있는 쪽은 뚫려 있어야 안이 들여다보임),
// 걸레받이, 가운데 러그. palette는 scene.js의 THEMES 중 하나(바닥/벽/
// 러그 색만 담당 — 가구 자체 색은 테마와 무관하게 항상 같음).
export function buildRoomShell(palette) {
  const room = new THREE.Group();

  const plankCount = 22, plankW = FLOOR_W / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const shade = (i % 2 === 0) ? palette.floorA : palette.floorB;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(plankW * 0.96, 0.05, FLOOR_D),
      new THREE.MeshStandardMaterial({ color: shade, roughness: 0.9, metalness: 0.02 })
    );
    plank.position.set(-FLOOR_W / 2 + plankW * (i + 0.5), -0.025, 0);
    plank.receiveShadow = true;
    room.add(plank);
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, WALL_H, 0.12), wallMat);
  backWall.position.set(0, WALL_H / 2, -FLOOR_D / 2);
  backWall.receiveShadow = true;
  room.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, WALL_H, FLOOR_D), wallMat);
  leftWall.position.set(-FLOOR_W / 2, WALL_H / 2, 0);
  leftWall.receiveShadow = true;
  room.add(leftWall);

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.8 });
  const baseBack = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 0.16, 0.14), baseMat);
  baseBack.position.set(0, 0.08, -FLOOR_D / 2 + 0.05);
  room.add(baseBack);
  const baseLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, FLOOR_D), baseMat);
  baseLeft.position.set(-FLOOR_W / 2 + 0.05, 0.08, 0);
  room.add(baseLeft);

  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 0.03, 48),
    new THREE.MeshStandardMaterial({ color: palette.rug, roughness: 0.95 })
  );
  rug.position.set(-0.6, 0.015, 1.4);
  rug.receiveShadow = true;
  room.add(rug);

  return room;
}
