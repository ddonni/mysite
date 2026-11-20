// 이웃 서가 — 통로 바깥에 "둘러보기에 공개"를 켠 다른 방들이 한 방에 서가 한 묶음씩(2026-11-18 사용자 요청: 빈 공간을
// 다른 사람들 기록으로 채우기). 가운데 통로는 늘 내 서가, 바깥은 이웃 — 남의 보관소 화면이라는 개념은 없앰.
//   - 이웃 서가: 그 사람의 **기록 전부**를 내 서가처럼 날짜순으로(2026-11-20 사용자 요청 — 전엔 인생작 12개만이라
//     인생작을 안 고른 방은 아예 안 보였음). 기록이 많으면 같은 쪽에 탑이 여러 개 이어짐 + 묶음 위에 이름표.
//   - 표지를 누르면 내 기록처럼 꺼내 봄(main.js), 이름표를 누르면 그 서가 앞으로 카메라가 감.
//   - lobby?room=코드로 들어오면(링크 복사·개발자의 방) 그 방을 맨 앞(입구 쪽)에 놓고 거기를 비춤.
import { SHELF, AISLE, archiveOrder } from './layout.js';
import { shelfKit, buildTower } from './shelves.js';
import { buildCovers } from './covers.js';
import { photoSrc } from '../../shared/photoSrc.js';
import { roomTitle } from '../../shared/room.js';

export const MAX_NEIGHBORS = 16;
// 이웃 탑 하나 — 내 탑보다 덜 둥글게(통로 쪽 면만) 열어서 바깥 줄에서도 표지가 통로 쪽을 봄.
export const NEIGHBOR_SHELF = { rows: SHELF.rows, span: Math.PI * 0.85 };
NEIGHBOR_SHELF.perRow = Math.floor((SHELF.radius * NEIGHBOR_SHELF.span) / SHELF.gap);
NEIGHBOR_SHELF.capacity = NEIGHBOR_SHELF.perRow * NEIGHBOR_SHELF.rows;
const OUT_X = AISLE.halfWidth + 6.3; // 통로 가운데에서 이웃 탑 중심까지
const TOWER_STEP = 4.1; // 한 사람의 탑 사이(z)
const BLOCK_GAP = 1.8; // 다른 사람 묶음과의 틈
const START_Z = AISLE.startZ + 3;

export function neighborTowerCount(recordCount) {
  return Math.max(1, Math.ceil(recordCount / NEIGHBOR_SHELF.capacity));
}

// 기록 수 목록 → 방마다 탑 자리 묶음. 묶음은 지금 더 짧은 쪽(왼쪽·오른쪽)에 붙여서 양쪽 길이가 비슷하게,
// 입구 쪽부터 안쪽(z가 작아지는 쪽)으로. 탑은 통로 쪽을 봄(입구 쪽으로 살짝).
export function layoutNeighbors(counts) {
  const cursor = { left: START_Z, right: START_Z - TOWER_STEP / 2 };
  const blocks = (counts || []).map((n) => {
    const key = cursor.left >= cursor.right ? 'left' : 'right';
    const side = key === 'left' ? -1 : 1;
    const towers = Array.from({ length: neighborTowerCount(n) }, (_, t) => ({
      x: side * OUT_X,
      z: cursor[key] - t * TOWER_STEP,
      facing: Math.atan2(-side, 0.25),
      side,
    }));
    cursor[key] = towers[towers.length - 1].z - TOWER_STEP - BLOCK_GAP;
    // 탑 높이는 기록이 차는 만큼만(최소 2줄) — 기록이 적은 이웃의 탑이 빈 선반만 높이 쌓여 보였음.
    const rows = towers.length > 1 ? NEIGHBOR_SHELF.rows
      : Math.min(NEIGHBOR_SHELF.rows, Math.max(2, Math.ceil(n / NEIGHBOR_SHELF.perRow)));
    return { side, towers, rows, centerZ: (towers[0].z + towers[towers.length - 1].z) / 2 };
  });
  const zs = blocks.flatMap((b) => b.towers.map((t) => t.z));
  return { blocks, endZ: zs.length ? Math.min(...zs) - TOWER_STEP / 2 : START_Z };
}

// 이웃 탑 안의 j번째 자리(아랫줄 → 윗줄, 줄 안에서는 호의 한쪽 끝 → 다른 끝) — layout.js의 slotPosition과 같은 생각.
export function neighborSlot(tower, j) {
  const { perRow, span } = NEIGHBOR_SHELF;
  const row = Math.floor(j / perRow), col = j % perRow;
  const a = tower.facing - span / 2 + ((col + 0.5) / perRow) * span;
  const r = SHELF.radius + 0.1;
  return { x: tower.x + Math.sin(a) * r, y: SHELF.baseY + row * SHELF.rowGap, z: tower.z + Math.cos(a) * r, angle: a };
}

// 이웃 후보 정리: 내 방은 빼고, focusCode는 맨 앞, 최대 MAX_NEIGHBORS(기록은 그다음에 받음 — roomContext.js).
export function pickNeighbors(rooms, myCode, focusCode) {
  const list = (rooms || []).filter((r) => r && r.code && r.code !== myCode);
  const i = focusCode ? list.findIndex((r) => r.code === focusCode) : -1;
  if (i > 0) list.unshift(list.splice(i, 1)[0]);
  return list.slice(0, MAX_NEIGHBORS);
}

// 이름표(사진 + 이름) — 늘 카메라를 보는 스프라이트.
function namePlate(room) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const name = roomTitle(room.name);
  const draw = (img) => {
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = "700 44px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    const w = Math.min(500, 128 + ctx.measureText(name).width + 40);
    const x0 = (512 - w) / 2;
    ctx.fillStyle = 'rgba(20,17,32,0.82)';
    ctx.strokeStyle = 'rgba(199,154,75,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x0 + 2, 14, w - 4, 100, 50);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x0 + 64, 64, 38, 0, Math.PI * 2);
    ctx.clip();
    if (img) {
      const k = Math.max(76 / img.width, 76 / img.height);
      ctx.drawImage(img, x0 + 64 - (img.width * k) / 2, 64 - (img.height * k) / 2, img.width * k, img.height * k);
    } else {
      ctx.fillStyle = '#3a3350';
      ctx.fillRect(x0 + 26, 26, 76, 76);
      ctx.fillStyle = '#c9bfe0';
      ctx.font = "700 38px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.slice(0, 1), x0 + 64, 66);
    }
    ctx.restore();
    ctx.font = "700 44px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = '#f6efe2';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x0 + 116, 66, w - 140);
    tex.needsUpdate = true;
  };
  draw(null);
  if (room.avatar_url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => draw(img);
    img.src = photoSrc(room.avatar_url);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.6, 0.65, 1);
  sprite.userData.room = room;
  return sprite;
}

// rooms: 기록(records)까지 받은 이웃들(roomContext.js의 publicRooms).
export function buildNeighbors(rooms, fog) {
  const group = new THREE.Group();
  const kits = new Map(); // 줄 수마다 하나
  const kitOf = (rows) => {
    if (!kits.has(rows)) kits.set(rows, shelfKit({ rows, span: NEIGHBOR_SHELF.span }));
    return kits.get(rows);
  };
  const { blocks, endZ } = layoutNeighbors(rooms.map((r) => r.records.length));
  const plates = [];
  const slots = [];
  const owner = []; // 표지 순서 k → 방
  rooms.forEach((room, i) => {
    const block = blocks[i];
    const kit = kitOf(block.rows);
    block.towers.forEach((t) => group.add(buildTower(kit, t)));
    const t0 = block.towers[0];
    const plate = namePlate(room);
    plate.position.set(t0.x + Math.sin(t0.facing) * 0.9, kit.height + 0.75, block.centerZ + Math.cos(t0.facing) * 0.9);
    group.add(plate);
    plates.push(plate);
    archiveOrder(room.records).forEach((record, j) => {
      const tower = block.towers[Math.floor(j / NEIGHBOR_SHELF.capacity)];
      slots.push({ tower: i, record, position: neighborSlot(tower, j % NEIGHBOR_SHELF.capacity) });
      owner.push(room);
    });
  });
  const covers = buildCovers(slots, fog);
  group.add(covers.group);

  return {
    group,
    covers,
    plates,
    count: rooms.length,
    endZ,
    ownerOf: (k) => owner[k],
    plateRoom(hit) { return plates.includes(hit.object) ? hit.object.userData.room : null; },
    // 그 이웃 서가 묶음 앞을 비스듬히 위에서 보는 시점(controls.goView에 넘김) — 탑이 많으면 조금 더 멀리서.
    viewOf(room) {
      const i = rooms.indexOf(room);
      const block = blocks[i < 0 ? 0 : i];
      if (!block) return null;
      const p = block.towers[0];
      return {
        target: new THREE.Vector3(p.x + Math.sin(p.facing) * 1.4, 1.0, block.centerZ + Math.cos(p.facing) * 1.4),
        r: 5.2 + (block.towers.length - 1) * 2.4,
        theta: p.facing + (p.side < 0 ? -0.55 : 0.55),
        phi: 1.0,
      };
    },
  };
}
