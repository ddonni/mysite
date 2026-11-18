// 서가에 꽂힌 기록들 — 책은 두께 있는 책, 영화·애니는 포스터, 음악은 앨범 재킷. 앞면은 실제 표지.
// (2026-11-18: 처음엔 빛나는 구슬이었다가 사용자 요청 "예전처럼 책이나 포스터로"로 바꿈.)
//
// 기록이 수백 개여도 가볍게: 표지는 큰 캔버스 몇 장(아틀라스, 한 장에 160칸)에 모아 그리고, 상자 모양 하나를
// 기록마다 크기만 바꿔 InstancedMesh로 그림(아틀라스 한 장 = 그리기 한 번). 앞면만 표지, 옆·위는 표지 가운데
// 색을 어둡게(책등처럼). 표지가 오기 전·없으면 카테고리 색 바탕에 제목.
import { photoSrc } from '../../shared/photoSrc.js';
import { catGlow, vibrantColor } from './orbColor.js';

export const SHAPES = {
  book: { w: 0.25, h: 0.36, d: 0.07 },
  movie: { w: 0.27, h: 0.4, d: 0.012 },
  anime: { w: 0.27, h: 0.38, d: 0.025 },
  music: { w: 0.32, h: 0.32, d: 0.02 },
};
const shapeOf = (cat) => SHAPES[cat] || SHAPES.book;
const FEATURED_SCALE = 1.14;
const LEAN = 0.2; // 뒤(벽 쪽)로 기댄 각도 — 위에서 내려다볼 때도 앞면이 보이게

const CELL_W = 128, CELL_H = 192, COLS = 16, ROWS = 10;
const PER_ATLAS = COLS * ROWS;
const ATLAS_W = CELL_W * COLS, ATLAS_H = 2048;

// 상자(1×1×1) — 앞면(+z)만 표지 uv, 나머지 면은 uv를 표지 가운데 한 점으로 + 면마다 어둡기(shade).
function itemGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const uv = g.attributes.uv;
  const shade = new Float32Array(uv.count);
  const FACE_SHADE = [0.62, 0.62, 0.8, 0.4, 1, 0.5]; // px, nx, py, ny, pz(앞), nz
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      shade[i] = FACE_SHADE[f];
      if (f !== 4) uv.setXY(i, 0.5, 0.55);
    }
  }
  g.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
  g.translate(0, 0.5, 0.5); // 바닥 가운데 뒤쪽이 원점 — 선반 위, 벽에 등을 대고 섬
  return g;
}

const VERT = `
  attribute float shade;
  attribute vec4 uvRect;
  attribute vec3 tint;
  attribute float featured;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying float vShade;
  varying vec3 vTint;
  varying float vFeatured;
  varying float vDepth;
  void main() {
    vLocal = uv;
    vUv = uvRect.xy + uv * uvRect.zw;
    vShade = shade;
    vTint = tint;
    vFeatured = featured;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = `
  uniform sampler2D atlas;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying float vShade;
  varying vec3 vTint;
  varying float vFeatured;
  varying float vDepth;
  void main() {
    vec3 c = texture2D(atlas, vUv).rgb * vShade;
    if (vFeatured > 0.5 && vShade > 0.99) {
      // 인생작: 앞면 테두리에 금테.
      float e = min(min(vLocal.x, 1.0 - vLocal.x), min(vLocal.y, 1.0 - vLocal.y));
      c = mix(c, vec3(1.0, 0.74, 0.3), 1.0 - smoothstep(0.035, 0.06, e));
    }
    c *= vTint;
    c = mix(c, fogColor, smoothstep(fogNear, fogFar, vDepth));
    gl_FragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0);
  }
`;

function newAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W; canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#26213a';
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx, tex };
}

// 칸 하나의 그릴 자리(캔버스 픽셀). 음악은 칸 위쪽 정사각형만.
function cellRect(k, cat) {
  const cell = k % PER_ATLAS;
  const x = (cell % COLS) * CELL_W, y = Math.floor(cell / COLS) * CELL_H;
  return cat === 'music' ? { x, y, w: CELL_W, h: CELL_W } : { x, y, w: CELL_W, h: CELL_H };
}
// 같은 자리의 uv(캔버스 위가 v=1 — CanvasTexture는 뒤집어 올림).
function uvOf({ x, y, w, h }) {
  const pad = 1; // 이웃 칸 색이 번지지 않게 1px 안쪽
  return [(x + pad) / ATLAS_W, 1 - (y + h - pad) / ATLAS_H, (w - 2 * pad) / ATLAS_W, (h - 2 * pad) / ATLAS_H];
}

const css = (rgb, k = 1) => `rgb(${rgb.map((v) => Math.round(v * 255 * k)).join(',')})`;

function paintPlaceholder(ctx, rect, rec) {
  const rgb = catGlow(rec.cat);
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, css(rgb, 0.75));
  g.addColorStop(1, css(rgb, 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = "600 17px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = (rec.title || '').slice(0, 24);
  const lines = [];
  let line = '';
  for (const ch of words) {
    if (ctx.measureText(line + ch).width > rect.w - 18 && line) { lines.push(line); line = ch; } else line += ch;
  }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((l, i, arr) => ctx.fillText(l, rect.x + rect.w / 2, rect.y + rect.h / 2 + (i - (arr.length - 1) / 2) * 21));
}

function drawCover(ctx, img, rect) {
  const k = Math.max(rect.w / img.width, rect.h / img.height);
  const w = img.width * k, h = img.height * k;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, rect.x + (rect.w - w) / 2, rect.y + (rect.h - h) / 2, w, h);
  ctx.restore();
}

function sampleColor(img) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 16, 16);
    return vibrantColor(x.getImageData(0, 0, 16, 16).data);
  } catch (e) { return null; }
}

export function buildCovers(slots, fog) {
  const filled = slots.filter((s) => s.record); // 앞에서부터 차 있음(layout.js) — 기록 순서 k = 자리 번호
  const n = filled.length;
  const atlases = Array.from({ length: Math.max(1, Math.ceil(n / PER_ATLAS)) }, newAtlas);
  const geo = itemGeometry();
  const group = new THREE.Group();
  const meshes = [];
  const color = filled.map((s) => catGlow(s.record.cat)); // 탑 바닥 빛에 쓰는 대표색(표지가 오면 바뀜)
  const scale = new Float32Array(n);
  const anim = new Float32Array(n);
  const where = []; // k → [mesh, instance]

  atlases.forEach((atlas, a) => {
    const from = a * PER_ATLAS, count = Math.min(PER_ATLAS, n - from);
    if (count <= 0) return;
    const g = geo.clone();
    const uvRect = new Float32Array(count * 4);
    const tint = new Float32Array(count * 3).fill(1);
    const feat = new Float32Array(count);
    for (let j = 0; j < count; j++) {
      const k = from + j;
      const rec = filled[k].record;
      const rect = cellRect(k, rec.cat);
      paintPlaceholder(atlas.ctx, rect, rec);
      uvRect.set(uvOf(rect), j * 4);
      feat[j] = rec.featured ? 1 : 0;
      scale[k] = rec.featured ? FEATURED_SCALE : 1;
      where[k] = [meshes.length, j];
    }
    g.setAttribute('uvRect', new THREE.InstancedBufferAttribute(uvRect, 4));
    g.setAttribute('tint', new THREE.InstancedBufferAttribute(tint, 3));
    g.setAttribute('featured', new THREE.InstancedBufferAttribute(feat, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        atlas: { value: atlas.tex },
        fogColor: { value: fog.color },
        fogNear: { value: fog.near },
        fogFar: { value: fog.far },
      },
    });
    const mesh = new THREE.InstancedMesh(g, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.from = from;
    meshes.push(mesh);
    group.add(mesh);
    atlas.tex.needsUpdate = true;
  });

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const e = new THREE.Euler();
  function setMatrix(k, hidden = false) {
    const pos = filled[k].position;
    const shp = shapeOf(filled[k].record.cat);
    const pop = anim[k];
    const sc = hidden ? 0.0001 : scale[k] * (1 + pop * 0.18);
    const out = 0.02 + pop * 0.12; // 마우스를 올리면 살짝 앞으로 빠져나옴
    p.set(pos.x + Math.sin(pos.angle) * out, pos.y, pos.z + Math.cos(pos.angle) * out);
    e.set(-LEAN * (1 - pop), pos.angle, 0, 'YXZ'); // 바깥을 보고, 뒤로 기댐(마우스를 올리면 똑바로)
    q.setFromEuler(e);
    s.set(shp.w * sc, shp.h * sc, shp.d * (hidden ? 0.0001 : 1));
    m.compose(p, q, s);
    const [mi, j] = where[k];
    meshes[mi].setMatrixAt(j, m);
    meshes[mi].instanceMatrix.needsUpdate = true;
  }
  for (let k = 0; k < n; k++) setMatrix(k);

  // ---- 표지 불러오기(동시에 6개씩) — 아틀라스 갱신은 몰아서 ----
  const dirty = new Set();
  let flushTimer = null;
  let onColor = () => {};
  const flush = () => {
    flushTimer = null;
    dirty.forEach((a) => { atlases[a].tex.needsUpdate = true; });
    dirty.clear();
  };
  const queue = [];
  for (let k = 0; k < n; k++) if (filled[k].record.photo_url) queue.push(k);
  let running = 0;
  function pump() {
    while (running < 6 && queue.length) {
      const k = queue.shift();
      running++;
      const rec = filled[k].record;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const done = () => { running--; pump(); };
      img.onload = () => {
        const a = Math.floor(k / PER_ATLAS);
        drawCover(atlases[a].ctx, img, cellRect(k, rec.cat));
        dirty.add(a);
        if (!flushTimer) flushTimer = setTimeout(flush, 350);
        const rgb = sampleColor(img);
        if (rgb) { color[k] = rgb; onColor(k); }
        done();
      };
      img.onerror = done;
      img.src = photoSrc(rec.photo_url);
    }
  }
  pump();

  let filter = null;
  const shown = (k) => k < n && (!filter || filled[k].record.cat === filter);
  function paintTint(k) {
    const [mi, j] = where[k];
    const t = meshes[mi].geometry.attributes.tint;
    const v = shown(k) ? 1 : 0.16;
    t.setXYZ(j, v, v, v);
    t.needsUpdate = true;
  }

  let hover = null, hidden = null;
  return {
    group,
    meshes,
    count: n,
    // 레이캐스트 결과 → 기록 순서 번호(k), 아니면 null.
    indexOfHit(hit) {
      const mi = meshes.indexOf(hit.object);
      return mi < 0 || hit.instanceId == null ? null : hit.object.userData.from + hit.instanceId;
    },
    recordAt: (k) => (k != null && k < n ? filled[k].record : null),
    positionOf(k) {
      const pos = filled[k].position;
      const h = shapeOf(filled[k].record.cat).h * scale[k];
      return new THREE.Vector3(pos.x + Math.sin(pos.angle) * 0.1, pos.y + h / 2, pos.z + Math.cos(pos.angle) * 0.1);
    },
    angleOf: (k) => filled[k].position.angle,
    colorOf: (k) => color[k],
    towerOf: (k) => filled[k].tower,
    onColor(fn) { onColor = fn; },
    setFilter(cat) { filter = cat || null; for (let k = 0; k < n; k++) paintTint(k); },
    isShown: shown,
    setHover(k) { hover = k; },
    hide(k) { hidden = k; setMatrix(k, true); },
    show(k) { if (hidden === k) { hidden = null; setMatrix(k); } },
    update(dt) {
      for (let k = 0; k < n; k++) {
        const want = k === hover ? 1 : 0;
        if (anim[k] === want) continue;
        anim[k] += (want - anim[k]) * Math.min(1, dt * 12);
        if (Math.abs(anim[k] - want) < 0.01) anim[k] = want;
        if (k !== hidden) setMatrix(k);
      }
    },
  };
}
