// 이웃 서가 — 통로 바깥에 "둘러보기에 공개"를 켠 다른 방들이 한 방에 서가 하나씩(2026-11-18 사용자 요청: 빈 공간을
// 다른 사람들 기록으로 채우기). 가운데 통로는 늘 내 서가, 바깥은 이웃 — 남의 보관소 화면이라는 개념은 없앰.
//   - 이웃 서가: 2줄짜리 낮은 진열대에 그 사람의 인생작(최대 12개 — GET /api/rooms의 featured) + 위에 이름표.
//   - 표지를 누르면 내 기록처럼 꺼내 봄(main.js), 이름표를 누르면 그 서가 앞으로 카메라가 감.
//   - lobby?room=코드로 들어오면(링크 복사·개발자의 방) 그 방을 맨 앞(입구 왼쪽)에 놓고 거기를 비춤.
import { SHELF, AISLE } from './layout.js';
import { shelfKit, buildTower } from './shelves.js';
import { buildCovers } from './covers.js';
import { photoSrc } from '../../shared/photoSrc.js';
import { roomTitle } from '../../shared/room.js';

export const MAX_NEIGHBORS = 16;
const PER_ROW = 6;
const ROWS = 2;
const OUT_X = AISLE.halfWidth + 6.3; // 통로 가운데에서 이웃 서가 중심까지
const STEP = AISLE.step * 0.9;

// i번째 이웃 서가 자리 — 왼쪽·오른쪽 번갈아, 입구 쪽부터 안쪽으로. 내 서가처럼 통로 쪽을 봄.
export function neighborPlacement(i) {
  const side = i % 2 === 0 ? -1 : 1;
  const k = Math.floor(i / 2);
  return {
    x: side * OUT_X,
    z: AISLE.startZ + 3 - k * STEP - (side > 0 ? STEP / 2 : 0),
    facing: Math.atan2(-side, 0.25),
    side,
  };
}
// 이웃 서가들이 차지하는 가장 안쪽 z(그 너머로는 장식 탑만).
export function neighborsEndZ(count) {
  return count ? neighborPlacement(count - 1).z - STEP / 2 : AISLE.startZ + 3;
}

// 이웃 목록 정리: 내 방은 빼고, 인생작이 있는 방만, focusCode는 맨 앞, 최대 MAX_NEIGHBORS.
export function pickNeighbors(rooms, myCode, focusCode) {
  const list = (rooms || []).filter((r) => r && r.code !== myCode && r.featured && r.featured.length);
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

export function buildNeighbors(rooms, fog) {
  const group = new THREE.Group();
  const kit = shelfKit({ rows: ROWS, span: Math.PI * 0.85 });
  const R = SHELF.radius;
  const towers = [];
  const plates = [];
  const slots = [];
  const owner = []; // 표지 순서 k → 방
  rooms.forEach((room, i) => {
    const pl = neighborPlacement(i);
    const tower = buildTower(kit, pl);
    group.add(tower);
    towers.push({ room, placement: pl, group: tower });
    const plate = namePlate(room);
    plate.position.set(pl.x + Math.sin(pl.facing) * 0.9, kit.height + 0.75, pl.z + Math.cos(pl.facing) * 0.9);
    group.add(plate);
    plates.push(plate);
    room.featured.slice(0, PER_ROW * ROWS).forEach((work, j) => {
      const row = Math.floor(j / PER_ROW), col = j % PER_ROW;
      const a = pl.facing + ((col - (PER_ROW - 1) / 2) * SHELF.gap) / R;
      slots.push({
        tower: i,
        record: { ...work, featured: false },
        position: {
          x: pl.x + Math.sin(a) * (R + 0.1),
          y: SHELF.baseY + row * SHELF.rowGap,
          z: pl.z + Math.cos(a) * (R + 0.1),
          angle: a,
        },
      });
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
    ownerOf: (k) => owner[k],
    plateRoom(hit) { return plates.includes(hit.object) ? hit.object.userData.room : null; },
    // 그 이웃 서가 앞을 비스듬히 위에서 보는 시점(controls.goView에 넘김).
    viewOf(room) {
      const t = towers.find((x) => x.room === room) || towers[0];
      if (!t) return null;
      const p = t.placement;
      return {
        target: new THREE.Vector3(p.x + Math.sin(p.facing) * 1.4, 1.0, p.z + Math.cos(p.facing) * 1.4),
        r: 5.2,
        theta: p.facing + (p.side < 0 ? -0.55 : 0.55),
        phi: 1.0,
      };
    },
  };
}
