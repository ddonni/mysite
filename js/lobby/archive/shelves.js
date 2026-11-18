// 서가 탑 — 통로 쪽으로 볼록한 둥근 벽 + 줄마다 책·포스터를 받치는 선반 + 위 뚜껑·아래 받침.
// 모양(기하)은 탑마다 같아서 한 번만 만들고, 탑마다 그룹을 돌려(rotation.y = facing) 세움.
// 각도 기준은 layout.js와 같음: 각도 a의 점 = (sin a, cos a)·r, a=0이 +z.
import { SHELF } from './layout.js';

// 바닥에 눕힌 부채꼴 고리(r0~r1, 가운데 각도 0 기준 ±half)를 두께 depth로 세운 기하. 바닥이 y=0.
function sector(r0, r1, half, depth, seg = 40) {
  const shape = new THREE.Shape();
  // 눕히면 (sx, sy) → 세계 (sx, ·, -sy)라서, 세계 z = r cos a 가 되게 sy = -r cos a.
  for (let k = 0; k <= seg; k++) {
    const a = -half + (2 * half * k) / seg;
    const x = Math.sin(a) * r1, y = -Math.cos(a) * r1;
    if (k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  for (let k = seg; k >= 0; k--) {
    const a = -half + (2 * half * k) / seg;
    shape.lineTo(Math.sin(a) * r0, -Math.cos(a) * r0);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// 탑 하나를 지을 재료(공유).
// rows: 줄 수(내 서가는 SHELF.rows, 바깥 이웃 서가는 2줄짜리 낮은 진열대 — neighbors.js), span: 호의 각도.
export function shelfKit({ rows = SHELF.rows, span = SHELF.span } = {}) {
  const half = span / 2 + 0.06;
  const R = SHELF.radius;
  const H = SHELF.baseY + SHELF.rowGap * rows + 0.1;
  return {
    rows,
    height: H,
    wall: new THREE.CylinderGeometry(R, R, H, 48, 1, true, -half, half * 2),
    ledge: sector(R - 0.02, R + 0.24, half, 0.03),
    cap: sector(R - 0.25, R + 0.42, half + 0.03, 0.26),
    capLip: sector(R + 0.36, R + 0.46, half + 0.03, 0.08),
    plinth: sector(R - 0.2, R + 0.36, half + 0.02, 0.2),
    rib: new THREE.BoxGeometry(0.1, H, 0.36),
    wallMat: new THREE.MeshStandardMaterial({ color: 0x1e1a2e, roughness: 0.8, side: THREE.DoubleSide }),
    ledgeMat: new THREE.MeshStandardMaterial({ color: 0x2e2840, roughness: 0.6, emissive: 0x0b0912 }),
    capMat: new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.55, emissive: 0x0c0a16 }),
    goldMat: new THREE.MeshStandardMaterial({ color: 0xc79a4b, roughness: 0.35, metalness: 0.6, emissive: 0x3a2808 }),
    half,
  };
}

export function buildTower(kit, placement) {
  const g = new THREE.Group();
  const H = kit.height;
  // 벽 재질은 탑마다 따로 — 그 탑 표지 색으로 안쪽이 은은하게 물들게(scene.js의 refreshTowerGlow).
  const wall = new THREE.Mesh(kit.wall, kit.wallMat.clone());
  wall.position.y = H / 2;
  g.add(wall);
  g.userData.wall = wall;
  for (let row = 0; row < kit.rows; row++) {
    const ledge = new THREE.Mesh(kit.ledge, kit.ledgeMat);
    ledge.position.y = SHELF.baseY + row * SHELF.rowGap - 0.035;
    g.add(ledge);
  }
  const cap = new THREE.Mesh(kit.cap, kit.capMat);
  cap.position.y = H;
  const lip = new THREE.Mesh(kit.capLip, kit.goldMat); // 뚜껑 둘레 금테
  lip.position.y = H - 0.08;
  const plinth = new THREE.Mesh(kit.plinth, kit.capMat);
  g.add(cap, lip, plinth);
  // 호의 양 끝을 마감하는 기둥.
  [-kit.half, kit.half].forEach((a) => {
    const rib = new THREE.Mesh(kit.rib, kit.capMat);
    rib.position.set(Math.sin(a) * (SHELF.radius + 0.14), H / 2, Math.cos(a) * (SHELF.radius + 0.14));
    rib.rotation.y = a;
    g.add(rib);
  });
  g.position.set(placement.x, 0, placement.z);
  g.rotation.y = placement.facing;
  return g;
}

// 통로 바깥, 안개 속으로 이어지는 장식용 탑(흐릿한 책등 무늬만 — 기록과는 상관없음). 둥근 기둥 하나 + 뚜껑.
export function buildDistantTower(socketTex, x, z, h) {
  const g = new THREE.Group();
  const R = SHELF.radius * 0.95;
  const tex = socketTex.clone();
  tex.needsUpdate = true;
  // 둘레·높이를 무늬 한 칸 크기에 맞춰 나눠야 옆으로 눌려 번져 보이지 않음.
  tex.repeat.set(Math.round((2 * Math.PI * R) / 0.7), Math.round(h / 0.52));
  tex.anisotropy = 4;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, h, 32, 1, true),
    new THREE.MeshStandardMaterial({ map: tex, color: 0x6a6488, roughness: 0.7, emissive: 0x08070e }),
  );
  body.position.y = h / 2;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.18, 32),
    // 위에서 내려다보면 뚜껑이 크게 보여서 어둡게(밝으면 기록 탑보다 눈에 띄었음).
    new THREE.MeshStandardMaterial({ color: 0x1a1726, roughness: 0.7 }),
  );
  cap.position.y = h + 0.09;
  g.add(body, cap);
  g.position.set(x, 0, z);
  return g;
}

// 먼 탑에 감을 무늬(타일) — 선반 한 칸에 흐릿한 책등 몇 권. 색은 보랏빛 계열만(기록과 헷갈리지 않게).
export function socketTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b1828';
  ctx.fillRect(0, 0, 64, 64);
  const tones = ['#34304a', '#2a263c', '#3c3654', '#302b44'];
  let x = 3;
  let i = 0;
  while (x < 60) {
    const w = 6 + ((i * 7) % 5);
    const h = 34 + ((i * 13) % 14);
    ctx.fillStyle = tones[i % tones.length];
    ctx.fillRect(x, 54 - h, w, h);
    x += w + 2;
    i++;
  }
  ctx.fillStyle = '#3a3350';
  ctx.fillRect(0, 54, 64, 10); // 선반
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
