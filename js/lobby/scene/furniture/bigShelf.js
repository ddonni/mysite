import { makeCanvasTexture, canvasToTexture } from '../canvasTexture.js';
import { aoBlob } from '../aoBlob.js';
import { claimCanvas, drawCover, drawTitleCard, paintRecordImage } from '../coverImage.js';
import { FEATURED_Y } from '../roomDimensions.js';

// 책·애니·영화를 한데 꽂는 큰 붙박이 책장(뒷벽, 벽 기준 좌표 — roomLayout.js가 벽에 담).
// 2026-11-11 사용자 결정: 카테고리마다 따로 있던 책장·애니 진열장·영화 포스터 벽을 하나로
// 합치고, 구분 없이 **기록한 순서대로** 꽂음(위 칸 왼쪽이 가장 오래된 기록, 아래로 갈수록 최근).
// 섞여 있어도 무엇인지 보이게 모양은 카테고리마다 다름:
//   책 = 책등에 제목, 영화·시리즈 = 얇은 DVD 케이스, 애니 = 작은 아크릴 스탠드(사진이 보임).
// 위 벽엔 인생작 액자가 SHELF_FEATURED개까지 한 줄로 걸림(책·애니·영화 합쳐 — 백엔드
// crud.SHELF_FEATURED와 같은 수). 칸이 모자라면 최근 기록부터 남기고 오래된 것부터 뺌.
//
// 꽂힌 물건과 액자엔 userData.record가 붙어 있어서, 책장을 확대한 상태에서 누르면
// 그 기록의 상세 창으로 감(controls.js의 recordOf → main.js의 onRecordClick).

export const SHELF_W = 10;
const SH = 2.6, SD = 0.4;
const LEVELS = 4;
const BAYS = 5;
export const SHELF_FEATURED = 9;
const FRAME_GAP = 1.08;

const BOOK_COLORS = [0x8a3a2e, 0xc79a4b, 0x2f4a45, 0x5a3d24, 0x9c5b3c, 0x38343a, 0xb0673f];
const DVD_COLORS = ['#16161a', '#1d2a44', '#232026', '#2a3550'];

// 기록마다 항상 같은 값(새로고침해도 같은 책이 같은 색·두께로) — 제목+id로 만든 해시.
function hashOf(r) {
  const s = `${r.id}:${r.title}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 물건 하나가 차지하는 폭 — 칸 채우기 전에 미리 계산해서, 넘치면 오래된 것부터 뺌.
function widthOf(r) {
  const h = hashOf(r);
  if (r.cat === 'movie') return 0.05;
  if (r.cat === 'anime') return 0.36;
  return 0.07 + (h % 50) / 1000; // 책 0.07~0.12
}

function drawSpine(ctx, w, h, bg, title, { band = 'rgba(243,236,224,0.16)', size = 0.6 } = {}) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.07, w, h * 0.05);
  ctx.fillRect(0, h * 0.88, w, h * 0.05);
  const label = title.length > 16 ? title.slice(0, 15) + '…' : title;
  ctx.fillStyle = 'rgba(243,236,224,0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.floor(w * size)}px 'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(label, 0, 0, h * 0.8);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 상자 모양 물건(책·DVD) — 앞면(+z)에만 책등 그림, 나머지는 단색.
function makeBox(w, h, d, sideColor, drawFront) {
  const sideMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.85 });
  const front = makeCanvasTexture(drawFront, 64, 256);
  const frontMat = new THREE.MeshStandardMaterial({ map: front, roughness: 0.6 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat]);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

function makeBook(r, w) {
  const h = 0.4 + (hashOf(r) % 13) / 100; // 0.40~0.52
  const col = BOOK_COLORS[hashOf(r) % BOOK_COLORS.length];
  const hex = '#' + col.toString(16).padStart(6, '0');
  const mesh = makeBox(w, h, SD - 0.1, col, (ctx, cw, ch) => drawSpine(ctx, cw, ch, hex, r.title));
  mesh.position.y = h / 2;
  mesh.rotation.y = ((hashOf(r) % 7) - 3) * 0.008; // 살짝 삐뚤빼뚤
  return mesh;
}

function makeDvd(r, w) {
  const h = 0.48;
  const bg = DVD_COLORS[hashOf(r) % DVD_COLORS.length];
  const mesh = makeBox(w, h, SD - 0.08, 0x141418, (ctx, cw, ch) => drawSpine(ctx, cw, ch, bg, r.title, { band: 'rgba(201,86,74,0.55)', size: 0.5 }));
  mesh.position.y = h / 2;
  return mesh;
}

// 아크릴 스탠드 — 투명판에 사진(없으면 제목 카드)이 인쇄된 모양.
function makeStand(r, acrylicMat) {
  const W = 0.32, H = 0.42, TW = 112, TH = 148;
  const canvas = document.createElement('canvas');
  canvas.width = TW; canvas.height = TH;
  const ctx = canvas.getContext('2d');
  const tex = canvasToTexture(canvas);
  const group = new THREE.Group();
  const print = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })
  );
  print.position.y = H / 2 + 0.03;
  group.add(print);
  const board = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, H + 0.02, 0.012), acrylicMat);
  board.position.set(0, print.position.y, -0.008);
  group.add(board);
  const base = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.025, W * 0.35), acrylicMat);
  base.position.y = 0.0125;
  group.add(base);
  const inset = TW * 0.06, radius = TW * 0.08;
  const clipAndDraw = (draw) => {
    ctx.clearRect(0, 0, TW, TH);
    ctx.save();
    roundRect(ctx, 0, 0, TW, TH, radius);
    ctx.fillStyle = '#fbf8f2';
    ctx.fill();
    roundRect(ctx, inset, inset, TW - inset * 2, TH - inset * 2, radius * 0.6);
    ctx.clip();
    draw(inset, inset, TW - inset * 2, TH - inset * 2);
    ctx.restore();
  };
  paintRecordImage(ctx, r, {
    drawImage: (img) => clipAndDraw((x, y, w, h) => drawCover(ctx, img, x, y, w, h)),
    drawFallback: () => clipAndDraw((x, y, w, h) => drawTitleCard(ctx, x, y, w, h, r.title, 'rgba(217,122,160,0.9)')),
    onDone: () => { tex.needsUpdate = true; },
  });
  group.userData.dispose = () => tex.dispose();
  return group;
}

// 인생작 액자 하나 — 사진이 있으면 표지, 없으면 제목 카드.
function makeFrame() {
  const FW = 0.85, FH = 1.05, FD = 0.05, TW = 220, TH = 280;
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(FW, FH, FD), new THREE.MeshStandardMaterial({ color: 0x2a2016, roughness: 0.7 }));
  frame.castShadow = true;
  group.add(frame);
  const canvas = document.createElement('canvas');
  canvas.width = TW; canvas.height = TH;
  const ctx = canvas.getContext('2d');
  const tex = canvasToTexture(canvas);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(FW - 0.1, FH - 0.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  art.position.z = FD / 2 + 0.002;
  group.add(art);
  function paintEmpty() {
    claimCanvas(ctx);
    const g = ctx.createLinearGradient(0, 0, TW, TH);
    g.addColorStop(0, '#3a2c1f');
    g.addColorStop(1, '#201d1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TW, TH);
    ctx.strokeStyle = 'rgba(255,253,250,0.25)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(TW * 0.12, TH * 0.1, TW * 0.76, TH * 0.8);
    ctx.setLineDash([]);
    tex.needsUpdate = true;
  }
  group.userData.paint = (r) => {
    group.userData.record = r || null;
    if (!r) { paintEmpty(); return; }
    paintRecordImage(ctx, r, {
      drawImage: (img) => { ctx.clearRect(0, 0, TW, TH); drawCover(ctx, img, 0, 0, TW, TH); },
      drawFallback: () => drawTitleCard(ctx, 0, 0, TW, TH, r.title),
      onDone: () => { tex.needsUpdate = true; },
    });
  };
  paintEmpty();
  return group;
}

export function buildBigShelf() {
  const shelf = new THREE.Group();
  shelf.userData.room = 'shelf';
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.75 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x2b2018, roughness: 0.85 });
  const acrylicMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false,
  });

  const back = new THREE.Mesh(new THREE.BoxGeometry(SHELF_W, SH, 0.04), backMat);
  back.position.set(0, SH / 2, -SD / 2);
  shelf.add(back);
  const bayW = SHELF_W / BAYS;
  for (let i = 0; i <= BAYS; i++) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(i === 0 || i === BAYS ? 0.07 : 0.045, SH, SD), caseMat);
    side.position.set(-SHELF_W / 2 + i * bayW, SH / 2, 0);
    side.castShadow = true;
    shelf.add(side);
  }
  const levelH = SH / LEVELS;
  for (let l = 0; l <= LEVELS; l++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(SHELF_W, l === LEVELS ? 0.07 : 0.045, SD), caseMat);
    board.position.set(0, l * levelH, 0);
    board.castShadow = true; board.receiveShadow = true;
    shelf.add(board);
  }
  // 맨 아래 걸레받이 같은 굽 — 붙박이 가구처럼 바닥에 묵직하게.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(SHELF_W, 0.1, 0.06), caseMat);
  plinth.position.set(0, 0.05, SD / 2 - 0.03);
  shelf.add(plinth);

  // 칸(레벨 × 구획) 순서: 위 칸부터, 왼쪽 구획부터 — 한 줄을 끝까지 읽고 다음 줄.
  const slots = [];
  for (let l = LEVELS - 1; l >= 0; l--) {
    for (let b = 0; b < BAYS; b++) {
      slots.push({ y: l * levelH + 0.025, x0: -SHELF_W / 2 + b * bayW + 0.08, x1: -SHELF_W / 2 + (b + 1) * bayW - 0.08 });
    }
  }
  const GAP = 0.012;
  // records(오래된 것부터)를 칸에 차례로 넣을 자리 — 다 못 넣으면 null.
  function place(records) {
    const out = [];
    let s = 0, x = slots[0].x0;
    for (const r of records) {
      const w = widthOf(r);
      while (s < slots.length && x + w > slots[s].x1) { s++; if (s < slots.length) x = slots[s].x0; }
      if (s >= slots.length) return null;
      out.push({ r, w, x: x + w / 2, y: slots[s].y });
      x += w + GAP;
    }
    return out;
  }

  let items = [];
  function clearItems() {
    items.forEach((o) => {
      shelf.remove(o);
      o.traverse((m) => {
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => { if (mat !== acrylicMat) { if (mat.map) mat.map.dispose(); mat.dispose(); } });
      });
    });
    items = [];
  }

  function fill(records) {
    clearItems();
    // 칸이 모자라면 최근 기록을 남기고 오래된 것부터 뺌.
    let list = records;
    let placed = place(list);
    while (!placed && list.length) {
      list = list.slice(Math.max(1, Math.ceil(list.length * 0.05)));
      placed = place(list);
    }
    (placed || []).forEach(({ r, w, x, y }) => {
      const obj = r.cat === 'anime' ? makeStand(r, acrylicMat) : r.cat === 'movie' ? makeDvd(r, w) : makeBook(r, w);
      obj.position.x = x;
      obj.position.y += y;
      obj.position.z = r.cat === 'anime' ? 0.02 : 0;
      obj.userData.record = r;
      shelf.add(obj);
      items.push(obj);
    });
  }

  // 위 벽 인생작 액자 — 고른 것만 가운데 정렬로. 하나도 없으면 빈 액자 3개(여기 걸 수 있다는 표시).
  const frames = [...Array(SHELF_FEATURED)].map(() => {
    const f = makeFrame();
    f.visible = false;
    shelf.add(f);
    return f;
  });
  function hang(featured) {
    const list = featured.length ? featured.slice(0, SHELF_FEATURED) : [null, null, null];
    frames.forEach((f, i) => {
      f.visible = i < list.length;
      if (!f.visible) return;
      f.position.set((i - (list.length - 1) / 2) * FRAME_GAP, FEATURED_Y, -SD / 2 - 0.01); // 벽에 붙임
      f.userData.paint(list[i]);
    });
  }
  hang([]);

  const blob = aoBlob(SHELF_W / 2);
  blob.scale.y = 0.18;
  shelf.add(blob);

  shelf.position.set(0, 0, SD / 2 + 0.06); // 벽에 바짝 붙임

  // loadRoomIntoScene.js가 showcase.js의 pickShelf 결과를 넘겨줌:
  // items = 책·애니·영화 전부(오래된 것부터), featured = 인생작(액자, 최대 9개).
  shelf.userData.setShelf = ({ items: records, featured }) => {
    fill(records || []);
    hang(featured || []);
  };

  return shelf;
}
