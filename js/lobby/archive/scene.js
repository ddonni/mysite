// 기억 보관소 장면 조립 — 보랏빛 안개 속 끝없는 통로, 양옆의 서가 탑, 거기 꽂힌 책·포스터·앨범(covers.js),
// 바닥에 고이는 빛, 떠다니는 빛가루, 입구 옆 이젤(캔버스로 가는 길). 사용자 입력은 controls.js.
// THREE는 lobby.html에서 <script>로 먼저 불러온 전역 변수.
import { SHELF, AISLE, layoutArchive, aisleEnd } from './layout.js';
import { buildCovers } from './covers.js';
import { glowTexture } from './glow.js';
import { buildNeighbors } from './neighbors.js';
import { shelfKit, buildTower, buildDistantTower, socketTexture } from './shelves.js';
import { buildEasel } from '../scene/furniture/easel.js';

// 색(2026-11-18 평가 후): 전기 파랑 대신 짙은 남보라 + 금빛 조명 — 카드 홈의 차분한 톤과 어울리게.
const FOG = 0x1f1a33;

function backgroundTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#09080f');
  g.addColorStop(0.45, '#1c182c');
  g.addColorStop(0.62, '#28223c');
  g.addColorStop(1, '#0e0c18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 반짝이는 바닥(살짝 비치는 느낌) — 아주 큰 판 하나.
function buildFloor(endZ) {
  const len = 12 - endZ + 30;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, len),
    new THREE.MeshStandardMaterial({ color: 0x17141f, roughness: 0.35, metalness: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 12 - len / 2);
  floor.userData.isFloor = true;
  return floor;
}

// 통로 가운데 은은한 길(빛 띠).
function buildPath(endZ) {
  const len = 8 - endZ;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(255,214,150,0)');
  g.addColorStop(0.5, 'rgba(255,214,150,0.12)');
  g.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 4);
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, len),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.005, 8 - len / 2);
  return path;
}

// 떠다니는 빛가루.
function buildMotes(endZ) {
  const count = 360;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const palette = [[1, 0.85, 0.5], [1, 0.75, 0.45], [0.95, 0.9, 0.75], [0.8, 0.72, 1]];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 1] = Math.random() * 6;
    pos[i * 3 + 2] = 6 + Math.random() * (endZ - 6);
    const c = palette[i % palette.length];
    col.set(c, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.06, map: glowTexture(), vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  }));
}

// neighborRooms: 바깥 이웃 서가에 놓을 공개 방들(기록까지 받은 것 — roomContext.js의 publicRooms).
export function buildArchiveScene(records, neighborRooms = []) {
  const { towers, slots, filled } = layoutArchive(records);
  const endZ = aisleEnd(towers);

  const scene = new THREE.Scene();
  scene.background = backgroundTexture();
  scene.fog = new THREE.Fog(FOG, 9, 34);

  scene.add(new THREE.HemisphereLight(0xa8a0c8, 0x120f1c, 0.5));
  scene.add(new THREE.AmbientLight(0x3a3352, 0.9));
  const key = new THREE.DirectionalLight(0xffe2b8, 0.55);
  key.position.set(3, 10, 6);
  scene.add(key);

  const kit = shelfKit();
  const towerGroups = towers.map((t) => buildTower(kit, t));
  towerGroups.forEach((g) => scene.add(g));

  // 바로 바깥 줄은 이웃 서가(공개된 다른 방들), 그 너머와 더 바깥 줄은 안개 속 장식 탑.
  const neighbors = buildNeighbors(neighborRooms, scene.fog);
  scene.add(neighbors.group);
  const nEnd = neighbors.endZ;
  // 이웃 서가가 내 통로보다 길면(기록이 많은 이웃) 바닥·카메라가 갈 수 있는 곳도 거기까지.
  const worldEndZ = Math.min(endZ, nEnd);
  scene.add(buildFloor(worldEndZ), buildPath(endZ));
  const sockets = socketTexture();
  const farZ = Math.min(endZ, nEnd) - 14;
  for (let z = 2; z > farZ; z -= AISLE.step * 0.62) {
    [-1, 1].forEach((side) => {
      const jitter = Math.sin(z * 1.3 + side) * 0.8;
      if (z < nEnd) scene.add(buildDistantTower(sockets, side * (AISLE.halfWidth + 5.6 + jitter), z, SHELF.height + 0.4));
      scene.add(buildDistantTower(sockets, side * (AISLE.halfWidth + 12 - jitter), z - 2.4, SHELF.height + 1.6));
    });
  }
  // 통로 끝 너머에도 몇 개(길이 끝없이 이어지는 느낌).
  for (let k = 0; k < 4; k++) {
    scene.add(buildDistantTower(sockets, (k - 1.5) * 4.2, endZ - 9 - (k % 2) * 3, SHELF.height + 1));
  }

  const covers = buildCovers(slots, scene.fog);
  scene.add(covers.group);

  // 기록이 있는 탑마다 바닥에 고이는 빛(그 탑 표지 색의 평균) + 은은한 점광원 몇 개.
  const pool = glowTexture();
  const floorGlows = towers.map((t) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 6.5),
      new THREE.MeshBasicMaterial({ map: pool, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(t.x + Math.sin(t.facing) * (SHELF.radius + 0.6), 0.01, t.z + Math.cos(t.facing) * (SHELF.radius + 0.6));
    scene.add(m);
    return m;
  });
  const lights = towers.slice(0, 6).map((t) => {
    const l = new THREE.PointLight(0x000000, 1.4, 7.5, 2);
    l.position.set(t.x + Math.sin(t.facing) * (SHELF.radius + 1.2), 2.6, t.z + Math.cos(t.facing) * (SHELF.radius + 1.2));
    scene.add(l);
    return l;
  });
  // 탑마다 (보이는) 표지 색을 모아 평균 → 바닥 빛·점광원·탑 안쪽 색. 표지 색이 들어올 때마다 다시 부름.
  function refreshTowerGlow() {
    towers.forEach((_, ti) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = 0; j < SHELF.capacity; j++) {
        const k = ti * SHELF.capacity + j;
        if (k >= covers.count || !covers.isShown(k)) continue;
        const c = covers.colorOf(k);
        r += c[0]; g += c[1]; b += c[2]; n++;
      }
      const fill = Math.min(1, n / (SHELF.capacity * 0.5));
      const color = n ? new THREE.Color().setRGB(r / n, g / n, b / n, THREE.SRGBColorSpace) : new THREE.Color(0, 0, 0);
      floorGlows[ti].material.color.copy(color).multiplyScalar(0.25 + fill * 0.75);
      if (lights[ti]) lights[ti].color.copy(color).multiplyScalar(fill);
      towerGroups[ti].userData.wall.material.emissive.copy(color).multiplyScalar(0.05 + fill * 0.16);
    });
  }
  refreshTowerGlow();
  let glowQueued = false;
  covers.onColor(() => {
    if (glowQueued) return;
    glowQueued = true;
    setTimeout(() => { glowQueued = false; refreshTowerGlow(); }, 300);
  });

  // 입구 왼쪽의 이젤 — 누르면 캔버스(그림판)로(2026-11-18 사용자 결정: 캔버스는 3D 방에서만).
  const easel = buildEasel();
  easel.position.set(-2.3, 0, 1.6);
  easel.rotation.y = 0.75;
  const easelLight = new THREE.PointLight(0xffd9a0, 1.2, 5, 2);
  easelLight.position.set(-1.4, 2.6, 2.6);
  scene.add(easel, easelLight);

  const motes = buildMotes(endZ);
  scene.add(motes);
  const motePos = motes.geometry.attributes.position;

  return {
    scene,
    towers,
    slots,
    filled,
    endZ,
    worldEndZ,
    covers,
    neighbors,
    easel,
    // 누를 수 있는 것들(가까운 순으로 맞히려고 탑·바닥도 같이 — 탑 뒤 물건은 안 눌리게).
    pickables: [...covers.meshes, ...neighbors.covers.meshes, ...neighbors.plates, easel, ...towerGroups,
      neighbors.group, scene.children.find((o) => o.userData.isFloor)],
    refreshTowerGlow,
    // 카메라가 멀리(높이) 있을수록 안개를 멀리 밀어서, 위에서 내려다봐도 보관소가 뿌옇게 묻히지 않게.
    setViewDistance(d) {
      const far = Math.max(0, d - 4);
      scene.fog.near = 9 + far * 1.0;
      scene.fog.far = 34 + far * 1.6;
      [...covers.meshes, ...neighbors.covers.meshes].forEach((m) => {
        m.material.uniforms.fogNear.value = scene.fog.near;
        m.material.uniforms.fogFar.value = scene.fog.far;
      });
    },
    update(dt) {
      covers.update(dt);
      neighbors.covers.update(dt);
      for (let i = 0; i < motePos.count; i++) {
        let y = motePos.getY(i) + dt * 0.12;
        if (y > 6) y = 0.2;
        motePos.setY(i, y);
      }
      motePos.needsUpdate = true;
    },
  };
}
