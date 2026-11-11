import { aoBlob } from '../aoBlob.js';
import { claimCanvas, drawCover, paintRecordImage } from '../coverImage.js';
import { canvasToTexture } from '../canvasTexture.js';
import { colorOf } from '../../../library/modal/wardrobeFields.js';

// 옷장 기록을 나타내는 가구: 양문이 활짝 열린 나무 옷장(뒷벽 오른쪽 구석, roomLayout.js).
// (2026-11-11 처음엔 옷 행거였다가 사용자 요청으로 옷장으로 바꿈.)
//   봉:   안쪽 봉의 옷걸이에 옷이 HANG_SLOTS벌까지 걸림 — 최애옷이 먼저(showcase.js의 pickWardrobe).
//   서랍 위: 신발·가방·액세서리가 SHELF_SLOTS개까지 섬.
// 옷 하나 = 종류(상의·하의…) 모양으로 오린 판. 사진이 있으면 그 모양 안에 사진,
// 없으면 고른 색으로 칠함(색도 없으면 연한 베이지). 옷이 없으면 빈 옷걸이만 걸려 있음.

// 옷장 바깥 치수(폭·높이·깊이)와 안쪽 봉 높이, 아래 서랍 높이(서랍 위가 소품 자리).
const W = 2.0, H = 2.35, D = 0.62, T = 0.05;
const BAR_Y = 1.98;
const DRAWER_H = 0.34;
// showcase.js의 pickWardrobe가 고르는 수와 같음.
const HANG_SLOTS = 6;
const SHELF_SLOTS = 4;

const GARMENT = { w: 0.46, h: 0.64, texW: 184, texH: 256 };
const SMALL = { w: 0.32, h: 0.26, texW: 160, texH: 130 };
const PLAIN = '#d9cdb8';

// 종류별 실루엣 — 0..1로 정규화한 좌표(x는 폭, y는 위에서 아래). 캔버스 크기에 맞춰 늘림.
const SHAPES = {
  top: [[0.34, 0.02], [0.42, 0.08], [0.58, 0.08], [0.66, 0.02], [0.98, 0.18], [0.9, 0.4], [0.78, 0.34], [0.78, 0.98], [0.22, 0.98], [0.22, 0.34], [0.1, 0.4], [0.02, 0.18]],
  outer: [[0.32, 0.02], [0.5, 0.2], [0.68, 0.02], [0.98, 0.16], [0.98, 0.9], [0.84, 0.9], [0.82, 0.38], [0.82, 1.0], [0.18, 1.0], [0.18, 0.38], [0.16, 0.9], [0.02, 0.9], [0.02, 0.16]],
  dress: [[0.36, 0.02], [0.44, 0.08], [0.56, 0.08], [0.64, 0.02], [0.74, 0.08], [0.7, 0.36], [0.96, 1.0], [0.04, 1.0], [0.3, 0.36], [0.26, 0.08]],
  bottom: [[0.18, 0.04], [0.82, 0.04], [0.92, 1.0], [0.6, 1.0], [0.5, 0.32], [0.4, 1.0], [0.08, 1.0]],
  shoes: [[0.06, 0.34], [0.36, 0.34], [0.42, 0.52], [0.94, 0.68], [0.96, 0.92], [0.04, 0.92]],
  bag: [[0.12, 0.38], [0.3, 0.38], [0.32, 0.14], [0.68, 0.14], [0.7, 0.38], [0.88, 0.38], [0.94, 0.94], [0.06, 0.94]],
  acc: [[0.5, 0.1], [0.86, 0.3], [0.86, 0.7], [0.5, 0.9], [0.14, 0.7], [0.14, 0.3]],
};

function tracePath(ctx, pts, x, y, w, h) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * w, y + py * h) : ctx.moveTo(x + px * w, y + py * h)));
  ctx.closePath();
}

function fillOf(ctx, color, w, h) {
  const c = colorOf(color);
  if (!c) return PLAIN;
  if (c.key !== 'multi') return c.hex;
  const g = ctx.createLinearGradient(0, 0, w, h);
  ['#c8322f', '#f0cf45', '#3f7d4a', '#2f64c8', '#7b52ab'].forEach((hex, i) => g.addColorStop(i / 4, hex));
  return g;
}

// 판 하나(옷걸이에 건 옷 또는 아래칸 소품) — paint(record)로 다시 그림.
function makePiece(size, { hanger }) {
  const canvas = document.createElement('canvas');
  canvas.width = size.texW; canvas.height = size.texH;
  const ctx = canvas.getContext('2d');
  const tex = canvasToTexture(canvas);
  const group = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size.w, size.h),
    // 판 바깥(옷 모양 밖)은 투명 — alphaTest로 잘라서 정렬 문제 없이 그림.
    new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 })
  );
  plane.position.y = hanger ? -size.h / 2 - 0.07 : size.h / 2;
  plane.castShadow = true;
  group.add(plane);

  function paint(record) {
    const kind = (record && record.attrs && record.attrs.kind) || (hanger ? 'top' : 'bag');
    const pts = SHAPES[kind] || SHAPES.top;
    const W = size.texW, H = size.texH, pad = 4;
    const draw = (fill) => {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      tracePath(ctx, pts, pad, pad, W - pad * 2, H - pad * 2);
      ctx.clip();
      fill();
      // 옷감 느낌의 아래쪽 그늘 + 테두리.
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(255,255,255,0.08)');
      shade.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      tracePath(ctx, pts, pad, pad, W - pad * 2, H - pad * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    const solid = () => draw(() => { ctx.fillStyle = fillOf(ctx, record && record.attrs && record.attrs.color, W, H); ctx.fillRect(0, 0, W, H); });
    if (!record) { claimCanvas(ctx); ctx.clearRect(0, 0, W, H); tex.needsUpdate = true; return; }
    paintRecordImage(ctx, record, {
      drawImage: (img) => draw(() => drawCover(ctx, img, 0, 0, W, H)),
      drawFallback: solid,
      onDone: () => { tex.needsUpdate = true; },
    });
  }
  return { group, plane, paint };
}

// 철사 옷걸이 — 갈고리 + 어깨선 두 개 + 아래 가로대.
function makeHanger(mat) {
  const g = new THREE.Group();
  const wire = (len, x, y, rotZ) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 6), mat);
    m.position.set(x, y, 0);
    m.rotation.z = rotZ;
    g.add(m);
  };
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI * 1.3), mat);
  hook.rotation.z = -0.3;
  g.add(hook);
  wire(0.06, 0, -0.05, 0);
  wire(0.25, -0.11, -0.12, 1.05);
  wire(0.25, 0.11, -0.12, -1.05);
  wire(0.42, 0, -0.18, Math.PI / 2);
  return g;
}

export function buildWardrobe() {
  const cab = new THREE.Group();
  cab.userData.room = 'wardrobe';

  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.7 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.35, metalness: 0.7 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    cab.add(m);
    return m;
  };

  // 몸통 — 뒤판(안쪽은 어둡게), 옆판 둘, 천판·바닥판, 위 장식 몰딩, 아래 받침.
  box(W, H, T, inner, 0, H / 2, -D / 2 + T / 2);
  [-1, 1].forEach((side) => box(T, H, D, wood, side * (W / 2 - T / 2), H / 2, 0));
  box(W, T, D, wood, 0, H - T / 2, 0);
  box(W + 0.08, 0.07, D + 0.06, wood, 0, H + 0.035, 0.01);
  box(W - 0.04, 0.1, D - 0.04, inner, 0, 0.05, 0);

  // 아래 서랍 — 앞판 + 손잡이 둘. 서랍 위 판이 소품 자리.
  box(W - T * 2, T, D - T, wood, 0, DRAWER_H, T / 2);
  box(W - T * 2 - 0.02, DRAWER_H - 0.12, 0.03, wood, 0, 0.1 + (DRAWER_H - 0.12) / 2, D / 2 - 0.015);
  [-0.4, 0.4].forEach((x) => box(0.16, 0.025, 0.03, metal, x, 0.1 + (DRAWER_H - 0.12) / 2, D / 2 + 0.01));

  // 옷 봉.
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, W - T * 2, 10), metal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, BAR_Y, 0);
  cab.add(bar);

  // 양쪽 문 — 경첩(옆판 앞 모서리)을 축으로 바깥쪽으로 활짝 열림. 문 안쪽엔 거울 하나.
  const DOOR_W = W / 2 - 0.01, DOOR_H = H - 0.08;
  const mirror = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.12, metalness: 0.85 });
  [-1, 1].forEach((side) => {
    const hinge = new THREE.Group();
    hinge.position.set(side * W / 2, 0.04, D / 2);
    const door = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.035), wood);
    door.position.set(-side * DOOR_W / 2, DOOR_H / 2, 0);
    door.castShadow = true;
    hinge.add(door);
    // 문 바깥면의 판넬 무늬 두 칸.
    [0.3, 0.72].forEach((fy) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.16, DOOR_H * 0.34, 0.012), inner);
      panel.position.set(-side * DOOR_W / 2, DOOR_H * fy, 0.022);
      hinge.add(panel);
    });
    if (side === 1) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W - 0.2, DOOR_H * 0.6), mirror);
      m.position.set(-side * DOOR_W / 2, DOOR_H * 0.55, -0.019);
      m.rotation.y = Math.PI;
      hinge.add(m);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), metal);
    knob.position.set(-side * (DOOR_W - 0.07), DOOR_H * 0.5, 0.035);
    hinge.add(knob);
    hinge.rotation.y = side * 1.75; // 약 100° — 안이 다 보이게 활짝(더 열면 옆 책장을 가림)
    cab.add(hinge);
  });

  // 봉에 건 옷 — 왼쪽부터, 살짝씩 겹치고 뒤로 물러나게(카드를 펼친 것처럼).
  const IN_W = W - T * 2;
  const pitch = (IN_W - 0.4) / (HANG_SLOTS - 1);
  const hangerMat = metal;
  const hangers = [];
  const garments = [];
  for (let i = 0; i < HANG_SLOTS; i++) {
    const x = -IN_W / 2 + 0.2 + i * pitch;
    const hg = makeHanger(hangerMat);
    hg.position.set(x, BAR_Y, 0);
    cab.add(hg);
    hangers.push(hg);
    const piece = makePiece(GARMENT, { hanger: true });
    piece.group.position.set(x, BAR_Y - 0.08, 0.04 - i * 0.012);
    piece.group.rotation.y = 0.12;
    piece.group.visible = false;
    cab.add(piece.group);
    garments.push(piece);
  }

  // 서랍 위 소품.
  const smalls = [];
  const sPitch = (IN_W - 0.2) / SHELF_SLOTS;
  for (let i = 0; i < SHELF_SLOTS; i++) {
    const piece = makePiece(SMALL, { hanger: false });
    piece.group.position.set(-IN_W / 2 + 0.1 + (i + 0.5) * sPitch, DRAWER_H + T / 2, 0.06);
    piece.group.visible = false;
    cab.add(piece.group);
    smalls.push(piece);
  }

  const blob = aoBlob(W / 2 + 0.3);
  blob.scale.y = 0.45;
  cab.add(blob);

  // loadRoomIntoScene.js가 pickWardrobe 결과를 넘겨줌: hang = 봉에 걸 옷, shelf = 서랍 위.
  // 옷이 없는 옷걸이는 빈 채로 걸려 있음(빈 옷장도 옷장처럼 보이게) — 빈 옷걸이는 3개만.
  cab.userData.setWardrobe = ({ hang, shelf: onShelf }) => {
    garments.forEach((g, i) => {
      const rec = hang[i];
      g.group.visible = !!rec;
      if (rec) g.paint(rec);
    });
    hangers.forEach((h, i) => { h.visible = i < Math.max(hang.length, 3); });
    smalls.forEach((s, i) => {
      const rec = onShelf[i];
      s.group.visible = !!rec;
      if (rec) s.paint(rec);
    });
  };
  cab.userData.setWardrobe({ hang: [], shelf: [] });

  return cab;
}
