// 보관소를 둘러보는 조작 — 지도 앱처럼 "한 지점(target)을 중심으로 도는 카메라".
// 2026-11-18 사용자 요청: "이동이 더 자연스럽게, 원하는 시점에서 보기가 불편함, 기본은 위에서 내려다보기".
// (그 전엔 사람 눈높이로 걷기·날기였음 — 보고 싶은 곳을 맞추기가 어려웠음.)
//   - 끌기(한 손가락): 돌려 보기 — 좌우로 빙 돌고, 위아래로 내려다보는 각도(거의 바로 위 ~ 거의 눈높이)
//   - 오른쪽 끌기 / Shift+끌기 / 두 손가락 끌기: 지도처럼 옮기기(바닥을 잡고 끄는 느낌)
//   - 휠 / 두 손가락 벌리기·오므리기: 커서(손가락 사이) 쪽으로 다가가기·물러나기
//   - 바닥을 누르면 그곳이 가운데로, 기록(내 것·이웃 것)을 누르면 onPick(item), 이웃 이름표 → onPlate(room),
//     이젤 → onEasel. 무엇을 맞혔는지는 itemOf(hit)가 알려 줌(main.js — { kind: 'item', item } | { kind: 'plate', room })
//   - W·A·S·D / 방향키: 옮기기, Q·E: 돌기, +·-: 다가가기
// 손을 떼도 조금 미끄러지다 멈춤(관성), 모든 움직임은 목표값을 부드럽게 따라감.
import { AISLE } from './layout.js';

const MIN_R = 1.6, MAX_R = 42;
const MIN_PHI = 0.08, MAX_PHI = 1.48; // 0 = 바로 위, π/2 = 수평

export function createOrbitControls({ canvas, camera, pickables, itemOf, easel, endZ, onPick, onPlate, onEasel, onHover, home }) {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target = home.target.clone();
  const wantTarget = home.target.clone();
  const cur = { r: home.r, theta: home.theta, phi: home.phi };
  const want = { ...cur };
  const vel = { theta: 0, phi: 0, x: 0, z: 0 }; // 손 뗀 뒤 관성
  let enabled = true;

  function clampTarget(t) {
    const w = AISLE.halfWidth + 14; // 바깥 이웃 서가까지
    t.x = Math.max(-w, Math.min(w, t.x));
    t.z = Math.max(endZ - 4, Math.min(10, t.z));
    t.y = Math.max(0.3, Math.min(5, t.y));
  }
  const clampWant = () => {
    want.r = Math.max(MIN_R, Math.min(MAX_R, want.r));
    want.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, want.phi));
    clampTarget(wantTarget);
  };

  // ---- 화면 → 3D ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function ray(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster;
  }
  function pick(e) {
    const hit = ray(e).intersectObjects(pickables, true)[0];
    if (!hit) return null;
    const it = itemOf(hit);
    if (it) return { ...it, point: hit.point };
    let o = hit.object;
    while (o) { if (o === easel) return { kind: 'easel', point: hit.point }; o = o.parent; }
    if (hit.object.userData.isFloor) return { kind: 'floor', point: hit.point };
    return { kind: 'shelf', point: hit.point };
  }
  // 커서 아래의 점 — 물건에 닿으면 그 점, 아니면 바닥(목표 높이쯤의 수평면).
  function pointUnder(e) {
    const hit = ray(e).intersectObjects(pickables, true)[0];
    if (hit) return hit.point.clone();
    ground.constant = -target.y;
    return raycaster.ray.intersectPlane(ground, new THREE.Vector3());
  }

  // ---- 옮기기(바닥을 잡고 끄는 느낌): 화면 이동량을 지금 거리에 맞춰 바닥 위 이동으로 ----
  function panBy(dx, dy) {
    const h = canvas.clientHeight || 1;
    const perPx = (2 * cur.r * Math.tan((camera.fov * Math.PI) / 360)) / h;
    const sin = Math.sin(cur.theta), cos = Math.cos(cur.theta);
    // 화면 오른쪽 = (cos, -sin), 화면 위쪽(바닥 위에서 카메라가 보는 쪽) = (-sin, -cos)
    // 많이 기울여 볼수록 화면 위아래 이동은 바닥에서 더 멀리 감.
    const tilt = 1 / Math.max(0.35, Math.cos(cur.phi));
    const mx = (-dx * cos + dy * -sin * tilt) * perPx;
    const mz = (dx * sin + dy * -cos * tilt) * perPx;
    wantTarget.x += mx; wantTarget.z += mz;
    clampTarget(wantTarget);
    return { x: mx, z: mz };
  }
  function zoomBy(factor, at) {
    const oldR = want.r;
    want.r = Math.max(MIN_R, Math.min(MAX_R, want.r * factor));
    if (at && want.r < oldR) {
      const p = pointUnder(at);
      if (p) {
        p.y = Math.min(p.y, 4);
        wantTarget.lerp(p, 1 - want.r / oldR);
      }
    }
    clampWant();
  }

  // ---- 포인터 ----
  const touches = new Map();
  let mode = null; // 'rotate' | 'pan' | null
  let lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0, moved = false, lastMoveT = 0;
  let pinchGap = 0, pinchMid = null;
  const two = () => [...touches.values()];
  const gap = () => { const [a, b] = two(); return Math.hypot(a.x - b.x, a.y - b.y); };
  const mid = () => { const [a, b] = two(); return { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }; };

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    if (e.pointerType === 'touch') touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 없어도 됨 */ }
    vel.theta = vel.phi = vel.x = vel.z = 0;
    if (touches.size === 2) { mode = 'pinch'; pinchGap = gap(); pinchMid = mid(); moved = true; return; }
    if (touches.size > 2) return;
    mode = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
    lastX = downX = e.clientX; lastY = downY = e.clientY; downT = performance.now();
    moved = false;
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!enabled) return;
    if (mode === 'pinch' && touches.size >= 2) {
      const g = gap(), m = mid();
      if (g > 0 && pinchGap > 0) zoomBy(pinchGap / g, m);
      const p = panBy(m.clientX - pinchMid.clientX, m.clientY - pinchMid.clientY);
      vel.x = p.x; vel.z = p.z;
      pinchGap = g; pinchMid = m;
      lastMoveT = performance.now();
      return;
    }
    if (mode === 'rotate' || mode === 'pan') {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      lastMoveT = performance.now();
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) moved = true;
      if (mode === 'rotate') {
        const k = e.pointerType === 'touch' ? 0.006 : 0.0045;
        vel.theta = -dx * k; vel.phi = -dy * k;
        want.theta += vel.theta;
        want.phi += vel.phi;
        clampWant();
      } else {
        const p = panBy(dx, dy);
        vel.x = p.x; vel.z = p.z;
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      const hit = pick(e);
      canvas.classList.toggle('hover', !!hit && (hit.kind === 'item' || hit.kind === 'plate' || hit.kind === 'easel'));
      onHover(hit && hit.kind === 'item' ? hit.item : null, e.clientX, e.clientY);
    }
  });
  function release(e) {
    touches.delete(e.pointerId);
    if (mode === 'pinch') {
      if (touches.size === 1) { // 남은 손가락으로 이어서 돌리기
        const [rest] = two();
        mode = 'rotate'; lastX = downX = rest.x; lastY = downY = rest.y;
      } else if (touches.size === 0) mode = null;
      return false;
    }
    const was = mode;
    mode = null;
    canvas.classList.remove('dragging');
    return was;
  }
  window.addEventListener('pointercancel', (e) => { release(e); vel.theta = vel.phi = vel.x = vel.z = 0; });
  window.addEventListener('pointerup', (e) => {
    const was = release(e);
    if (!was || !enabled) return;
    const tapped = !moved && performance.now() - downT < 500;
    // 끌기였으면 관성으로 조금 더 미끄러짐(update) — 멈췄다가 뗀 거면 미끄러지지 않음.
    if (!tapped) { if (performance.now() - lastMoveT > 90) vel.theta = vel.phi = vel.x = vel.z = 0; return; }
    vel.theta = vel.phi = vel.x = vel.z = 0;
    const hit = pick(e);
    if (!hit) return;
    if (hit.kind === 'item') onPick(hit.item);
    else if (hit.kind === 'plate') onPlate(hit.room);
    else if (hit.kind === 'easel') onEasel();
    else if (hit.kind === 'floor') { wantTarget.set(hit.point.x, target.y, hit.point.z); clampTarget(wantTarget); }
  });
  canvas.addEventListener('mouseleave', () => onHover(null));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!enabled) return;
    const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    zoomBy(Math.exp(d * 0.0012), e);
  }, { passive: false });

  // ---- 키보드 ----
  const keys = new Set();
  const KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '+', '=', '-'];
  const typing = (e) => /input|textarea|select/i.test((e.target && e.target.tagName) || '');
  window.addEventListener('keydown', (e) => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (KEYS.includes(k)) { keys.add(k); if (k.startsWith('arrow')) e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  function place() {
    const s = Math.sin(cur.phi);
    camera.position.set(
      target.x + cur.r * s * Math.sin(cur.theta),
      Math.max(0.35, target.y + cur.r * Math.cos(cur.phi)),
      target.z + cur.r * s * Math.cos(cur.theta),
    );
    camera.lookAt(target);
  }
  place();

  return {
    setEnabled(v) { enabled = v; if (!v) { mode = null; keys.clear(); canvas.classList.remove('dragging', 'hover'); } },
    // 정해 둔 시점({ target, r, theta, phi })으로 부드럽게. 빠뜨리면 처음 시점(home).
    goView(v = home) {
      wantTarget.copy(v.target);
      Object.assign(want, { r: v.r, theta: v.theta, phi: v.phi });
      // 각도는 가까운 바퀴로(한 바퀴 빙 돌지 않게).
      while (want.theta - cur.theta > Math.PI) want.theta -= Math.PI * 2;
      while (want.theta - cur.theta < -Math.PI) want.theta += Math.PI * 2;
      vel.theta = vel.phi = vel.x = vel.z = 0;
      clampWant();
    },
    // 이 점을 가까이서 비스듬히 봄(이젤 등).
    focus(point, { r = 4.5, phi = 1.15, theta } = {}) {
      wantTarget.set(point.x, Math.min(point.y, 2), point.z);
      want.r = r; want.phi = phi;
      if (theta != null) want.theta = theta;
      clampWant();
    },
    distance: () => cur.r,
    height: () => camera.position.y,
    update(dt) {
      if (enabled && keys.size) {
        const sp = 260 * dt;
        let px = 0, py = 0;
        if (keys.has('w') || keys.has('arrowup')) py += sp;
        if (keys.has('s') || keys.has('arrowdown')) py -= sp;
        if (keys.has('a') || keys.has('arrowleft')) px += sp;
        if (keys.has('d') || keys.has('arrowright')) px -= sp;
        if (px || py) panBy(px, py);
        if (keys.has('q')) want.theta += 1.4 * dt;
        if (keys.has('e')) want.theta -= 1.4 * dt;
        if (keys.has('+') || keys.has('=')) zoomBy(1 - 1.2 * dt);
        if (keys.has('-')) zoomBy(1 + 1.2 * dt);
      }
      // 관성 — 손을 뗀 뒤(mode 없음) 조금씩 줄어들며 계속 감.
      if (!mode && !REDUCED) {
        const decay = Math.pow(0.0025, dt); // 1초에 0.25%까지
        if (Math.abs(vel.theta) + Math.abs(vel.phi) > 1e-5) {
          want.theta += vel.theta; want.phi += vel.phi;
          vel.theta *= decay; vel.phi *= decay;
          clampWant();
        }
        if (Math.abs(vel.x) + Math.abs(vel.z) > 1e-5) {
          wantTarget.x += vel.x; wantTarget.z += vel.z;
          vel.x *= decay; vel.z *= decay;
          clampTarget(wantTarget);
        }
      } else if (REDUCED) { vel.theta = vel.phi = vel.x = vel.z = 0; }
      const k = REDUCED ? 1 : 1 - Math.pow(0.0001, dt); // 프레임 속도와 상관없이 같은 빠르기로 따라감
      cur.r += (want.r - cur.r) * k;
      cur.theta += (want.theta - cur.theta) * k;
      cur.phi += (want.phi - cur.phi) * k;
      target.lerp(wantTarget, k);
      place();
    },
  };
}
