// 서가의 기록을 누르면 그 책·포스터·앨범이 빠져나와 눈앞으로 날아오며 커지고(앞면 = 큰 표지), 닫으면 다시
// 제자리로 날아가 꽂힘. 화면 옆(폰은 아래)의 기록 패널은 main.js가 띄움.
import { photoSrc } from '../../shared/photoSrc.js';
import { glowTexture } from './glow.js';
import { SHAPES } from './covers.js';
import { catGlow } from './orbColor.js';

const W = 384;
const FLY = 0.55; // 초
const DIST = 1.6; // 카메라 앞 거리
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function paintTitle(ctx, w, h, rec) {
  const rgb = catGlow(rec.cat).map((v) => Math.round(v * 255));
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgb(${rgb.map((v) => v * 0.8).join(',')})`);
  g.addColorStop(1, `rgb(${rgb.map((v) => v * 0.35).join(',')})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.font = "700 34px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = [];
  let line = '';
  for (const ch of (rec.title || '').slice(0, 40)) {
    if (ctx.measureText(line + ch).width > w - 50 && line) { lines.push(line); line = ch; } else line += ch;
  }
  if (line) lines.push(line);
  lines.slice(0, 5).forEach((l, i, arr) => ctx.fillText(l, w / 2, h / 2 + (i - (arr.length - 1) / 2) * 42));
}

export function createHeldCover(scene, camera) {
  const group = new THREE.Group();
  group.visible = false;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false, side: THREE.DoubleSide, transparent: true }),
  );
  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false, transparent: true }),
  );
  frame.position.z = -0.002;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  halo.position.z = -0.01;
  group.add(halo, frame, face);
  // 서가 위에 늘 보이게(깊이 무시) — 셋 다 투명 단계에서 후광 → 테두리 → 표지 순서로 그림(테두리가 표지를 덮으면 뿌옇게 보였음).
  [halo, frame, face].forEach((o, i) => { o.renderOrder = 10 + i; o.material.depthTest = false; o.material.depthWrite = false; });
  scene.add(group);

  let from = new THREE.Vector3();
  const fromQ = new THREE.Quaternion();
  let t = 0, dir = 0, onBack = null, seq = 0;
  let size = { w: 0.6, h: 0.9 };
  let offset = { x: 0, y: 0 };
  const target = new THREE.Vector3();
  const qq = new THREE.Quaternion();

  return {
    // rec를 fromPos(서가 자리, 앞면이 angle 쪽)에서 꺼내 옴. rgb: 대표색(sRGB 0~1).
    open(rec, fromPos, angle, rgb, wide) {
      const shp = SHAPES[rec.cat] || SHAPES.book;
      // 1.6m 앞에서 화면에 보이는 크기에 맞춤 — 넓은 화면은 높이의 60%, 세로 화면은 폭의 72%·높이의 38%까지.
      const viewH = 2 * DIST * Math.tan((camera.fov * Math.PI) / 360);
      const viewW = viewH * camera.aspect;
      const aspect = shp.w / shp.h;
      const H = Math.min(viewH * (wide ? 0.6 : 0.38), (viewW * (wide ? 0.4 : 0.72)) / aspect);
      size = { w: aspect * H, h: H };
      offset = wide ? { x: -viewW * 0.14, y: 0.02 } : { x: 0, y: viewH * 0.04 }; // 세로 화면: 머리말과 아래 패널 사이
      canvas.width = W; canvas.height = Math.round(W * (shp.h / shp.w));
      paintTitle(ctx, canvas.width, canvas.height, rec);
      tex.needsUpdate = true;
      const my = ++seq;
      if (rec.photo_url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (my !== seq) return;
          const k = Math.max(canvas.width / img.width, canvas.height / img.height);
          ctx.drawImage(img, (canvas.width - img.width * k) / 2, (canvas.height - img.height * k) / 2, img.width * k, img.height * k);
          tex.needsUpdate = true;
        };
        img.src = photoSrc(rec.photo_url);
      }
      const c = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
      halo.material.color.copy(c);
      frame.material.color.copy(rec.featured ? new THREE.Color(1, 0.78, 0.35) : new THREE.Color(1, 1, 1));
      face.scale.set(size.w, size.h, 1);
      frame.scale.set(size.w + 0.03, size.h + 0.03, 1);
      halo.scale.set(size.w * 2.6, size.h * 2.0, 1);
      from = fromPos.clone();
      fromQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      t = 0; dir = 1; onBack = null;
      group.visible = true;
    },
    close(done) { if (!group.visible) { if (done) done(); return; } dir = -1; onBack = done || null; },
    isOpen: () => group.visible,
    update(dt) {
      if (!group.visible) return;
      t = Math.max(0, Math.min(1, t + (dir * dt) / FLY));
      const k = ease(t);
      target.set(offset.x, offset.y, -DIST).applyMatrix4(camera.matrixWorld);
      group.position.lerpVectors(from, target, k);
      // 서가에서 나올 땐 꽂혀 있던 방향 → 날아오며 카메라 쪽으로 돌아섬(살짝 한 바퀴 비틀며).
      qq.slerpQuaternions(fromQ, camera.quaternion, k);
      group.quaternion.copy(qq);
      group.rotateY(Math.sin(k * Math.PI) * 0.5);
      group.scale.setScalar(0.3 + k * 0.7);
      halo.material.opacity = 0.5 * k;
      if (dir < 0 && t === 0) {
        group.visible = false;
        dir = 0;
        const cb = onBack;
        onBack = null;
        if (cb) cb();
      }
    },
  };
}
