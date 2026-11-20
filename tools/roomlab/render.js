// 방 설계도(window.ROOM) → Three.js 장면. 실험용(2026-11-20 "방 사진 → AI가 읽어서 3D로" — README.md).
// 좌표: 미터, 원점 = 방 바닥 가운데. x 오른쪽, y 위, z 앞(카메라 쪽). 뒷벽 z=-d/2, 왼벽 x=-w/2, 오른벽 x=+w/2.
// 물건: { name, x, z, rot(도), parts:[{ shape, pos:[x,y,z](물건 기준, y는 바닥에서), size, color, rot:[x,y,z](도) }] }
//   box size=[가로, 높이, 깊이], cylinder size=[윗반지름, 높이, 아랫반지름], sphere size=[반지름], cone size=[반지름, 높이]
(function () {
  const R = window.ROOM;
  const deg = (d) => (d || 0) * Math.PI / 180;
  // 원본 사진은 저장소에 넣지 않음(인터넷에서 가져온 사진이라 — 같은 폴더에 photo.png를 두면 보임).
  const photoEl = document.getElementById('photo');
  photoEl.onerror = () => {
    photoEl.replaceWith(Object.assign(document.createElement('p'), { textContent: '같은 폴더에 photo.png(원본 사진)를 두면 여기 보여요', style: 'color:#888;font-size:13px' }));
  };
  photoEl.src = R.photo || 'photo.png';
  document.getElementById('legend').textContent = R.objects.map((o) => o.name).join(' · ');

  const host = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#F4F2EE');

  const { w, d, h } = R.room;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

  // 바닥 무늬(나무 판자·타일·카펫)는 캔버스로 그림.
  function floorTexture(f) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = f.color;
    g.fillRect(0, 0, 512, 512);
    const shade = (a) => `rgba(0,0,0,${a})`;
    if (f.pattern === 'wood') {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = shade(0.03 + (i % 3) * 0.025);
        g.fillRect(0, i * 64, 512, 64);
        g.fillStyle = shade(0.18);
        g.fillRect(0, i * 64, 512, 2);
        g.fillRect(((i * 197) % 512), i * 64, 2, 64);
      }
    } else if (f.pattern === 'tile') {
      g.strokeStyle = shade(0.15);
      g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
    } else if (f.pattern === 'carpet') {
      for (let i = 0; i < 4000; i++) { g.fillStyle = shade(Math.random() * 0.06); g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 2, d / 2);
    return t;
  }

  // 방 껍데기 — 바닥, 뒷벽·왼벽·오른벽(앞은 열어 둠), 걸레받이.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat('#FFFFFF', { map: floorTexture(R.room.floor) }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const walls = {
    back: { pos: [0, h / 2, -d / 2], rot: 0, len: w },
    left: { pos: [-w / 2, h / 2, 0], rot: Math.PI / 2, len: d },
    right: { pos: [w / 2, h / 2, 0], rot: -Math.PI / 2, len: d },
  };
  const wallColor = (side) => (R.room.walls && R.room.walls[side]) || R.room.wall;
  Object.entries(walls).forEach(([side, s]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.len, h), mat(wallColor(side)));
    m.position.set(...s.pos);
    m.rotation.y = s.rot;
    m.receiveShadow = true;
    scene.add(m);
    const base = new THREE.Mesh(new THREE.BoxGeometry(s.len, 0.08, 0.02), mat(R.room.trim || '#FFFFFF'));
    base.position.set(s.pos[0], 0.04, s.pos[2]);
    base.rotation.y = s.rot;
    base.translateZ(0.01);
    scene.add(base);
  });

  // 창문·문 — 벽 위에 얇은 판(창은 하늘빛이 은은히 빛나고 창틀, 문은 문짝 색).
  (R.openings || []).forEach((o) => {
    const s = walls[o.wall];
    if (!s) return;
    const g = new THREE.Group();
    g.position.set(...s.pos);
    g.position.y = 0;
    g.rotation.y = s.rot;
    const isWin = o.kind === 'window';
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h),
      isWin ? mat('#CFE6F5', { emissive: '#BFDDF2', emissiveIntensity: 0.55 }) : mat(o.color || '#B89B7A'));
    pane.position.set(o.x, o.y + o.h / 2, 0.012);
    g.add(pane);
    const fc = o.frame || '#FFFFFF';
    const bar = (bw, bh, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.05), mat(fc)); b.position.set(x, y, 0.03); g.add(b); };
    bar(o.w + 0.08, 0.05, o.x, o.y + o.h);
    bar(0.05, o.h, o.x - o.w / 2, o.y + o.h / 2);
    bar(0.05, o.h, o.x + o.w / 2, o.y + o.h / 2);
    if (isWin) { bar(o.w + 0.08, 0.05, o.x, o.y); if (o.mullion !== false) bar(0.04, o.h, o.x, o.y + o.h / 2); }
    if (o.curtain) {
      [-1, 1].forEach((sd) => {
        const c = new THREE.Mesh(new THREE.BoxGeometry(o.w * 0.28, o.h + 0.3, 0.04), mat(o.curtain));
        c.position.set(o.x + sd * (o.w / 2 + 0.05), o.y + o.h / 2 - 0.05, 0.08);
        c.castShadow = true;
        g.add(c);
      });
    }
    scene.add(g);
  });

  // 물건 — 도형 조각을 모아 하나의 그룹으로.
  function part(p) {
    let geo;
    const s = p.size || [0.2, 0.2, 0.2];
    if (p.shape === 'cylinder') geo = new THREE.CylinderGeometry(s[0], s[2] != null ? s[2] : s[0], s[1], 24);
    else if (p.shape === 'sphere') geo = new THREE.SphereGeometry(s[0], 24, 16);
    else if (p.shape === 'cone') geo = new THREE.ConeGeometry(s[0], s[1], 24);
    else geo = new THREE.BoxGeometry(s[0], s[1], s[2]);
    const m = new THREE.Mesh(geo, mat(p.color || '#CCCCCC', p.emissive ? { emissive: p.color, emissiveIntensity: 0.6 } : {}));
    // pos의 y는 조각의 "바닥" 높이 — 상자·원기둥은 높이의 절반만큼 올려서 놓음(구는 중심).
    const lift = p.shape === 'sphere' ? 0 : s[1] / 2;
    m.position.set(p.pos[0], p.pos[1] + lift, p.pos[2]);
    if (p.rot) m.rotation.set(deg(p.rot[0]), deg(p.rot[1]), deg(p.rot[2]));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  R.objects.forEach((o) => {
    const g = new THREE.Group();
    o.parts.forEach((p) => g.add(part(p)));
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = deg(o.rot);
    scene.add(g);
  });

  // 빛 — 방 안 전체를 부드럽게 + 창 쪽에서 들어오는 햇빛 그림자.
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#B9A88F', R.ambient || 0.9));
  const sun = new THREE.DirectionalLight('#FFF4E0', R.sun != null ? R.sun : 1.6);
  const sunFrom = R.light || [w * 0.8, h * 2.2, d * 0.6];
  sun.position.set(...sunFrom);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -w; sc.right = w; sc.top = d; sc.bottom = -d;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  // 켜진 조명(emissive 조각이 있는 물건) — 둘레를 따뜻하게 밝히는 점광원.
  (R.lamps || []).forEach((l) => {
    const p = new THREE.PointLight(l.color || '#FFD9A0', l.power || 1.2, l.range || 3, 2);
    p.position.set(...l.pos);
    scene.add(p);
  });

  // 카메라 — 설계도의 시점(사진과 비슷한 각도)에서 시작. 끌면 바라보는 점을 중심으로 돔, 휠은 가까이.
  const cam = new THREE.PerspectiveCamera((R.camera && R.camera.fov) || 55, 1, 0.05, 100);
  const look = new THREE.Vector3(...((R.camera && R.camera.look) || [0, 1, -d / 4]));
  const start = new THREE.Vector3(...((R.camera && R.camera.pos) || [0, 1.6, d / 2 + 1]));
  const off = start.clone().sub(look);
  let radius = off.length();
  let theta = Math.atan2(off.x, off.z);
  let phi = Math.acos(off.y / radius);
  function place() {
    cam.position.set(look.x + radius * Math.sin(phi) * Math.sin(theta), look.y + radius * Math.cos(phi), look.z + radius * Math.sin(phi) * Math.cos(theta));
    cam.lookAt(look);
  }
  let drag = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!drag) return;
    theta -= (e.clientX - drag.x) * 0.006;
    phi = Math.min(Math.PI / 2 - 0.05, Math.max(0.15, phi - (e.clientY - drag.y) * 0.006));
    drag = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener('pointerup', () => { drag = null; });
  renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); radius = Math.min(15, Math.max(1, radius * (1 + e.deltaY * 0.001))); }, { passive: false });

  function resize() {
    const r = host.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    cam.aspect = r.width / r.height;
    cam.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();
  (function loop() { place(); renderer.render(scene, cam); requestAnimationFrame(loop); })();
  window.__ready = true;
})();
