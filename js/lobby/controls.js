// "방을 둘러보고 고르는" 인터랙션을 전부 담당하는 모듈: 드래그로
// 카메라 돌리기, 휠로 줌, 가구에 마우스를 올리면 커서 바뀌기, 가구를
// 클릭(또는 하단 버튼을 클릭)하면 카메라가 그 방으로 다가가면서 설명
// 카드가 뜨는 것까지.
//
// 카메라 회전(3D)과 설명 카드(2D 화면 위 UI)는 따로 떼어놓기엔 너무
// 긴밀하게 붙어 있는 동작(같은 클릭 한 번으로 둘 다 바뀜)이라 일부러
// 한 파일에 같이 둠 — 억지로 나누면 오히려 두 파일이 서로를 계속
// 호출하며 복잡해지기만 함.
export function createRoomInteraction({ canvas, camera, interactiveGroups, roomInfo, dom, onConfirm, kickBall, cameraPresets }) {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 첫 화면(HOME)과 가구를 클릭했을 때 카메라가 다가갈 자리(FOCUS) — 가구
  // 배치에 따라 정해지는 값이라 scene/roomLayout.js가 만들어 scene.js를 거쳐 넘겨줌.
  const HOME = cameraPresets.home;
  const FOCUS = cameraPresets.focus;
  const LIMIT = cameraPresets.targetLimit;
  // MAX_R는 첫 화면 거리(HOME.radius)보다 넉넉해야 휠로 줌 아웃할 때 안 튐.
  const MIN_R = 3, MAX_R = 22, MIN_PHI = 0.55, MAX_PHI = 1.5;
  // 세로로 긴 화면(폰 세로 등)에선 가로로 보이는 폭이 좁아서, 프리셋 거리에
  // 이 배율을 곱해 카메라를 뒤로 물림 — main.js가 화면 비율에 맞춰 setFit으로 정함.
  let fit = 1;
  const homeR = () => HOME.radius * fit;
  const maxR = () => Math.max(MAX_R, homeR() + 2);

  // 카메라 위치는 "구면 좌표"(target을 중심으로 반지름·수평각·수직각)로
  // 다룸 — 마우스로 드래그하면 각도만 바뀌고, updateCameraFromSpherical
  // 에서 이걸 실제 x/y/z 위치로 환산함. want*/wantTarget은 "가려는 목표"이고,
  // 실제 값은 그 목표를 향해 매 프레임 조금씩(감쇠하며) 따라가서 — 뚝뚝
  // 끊기지 않고 부드럽게 움직이는 느낌을 줌.
  const target = HOME.target.clone();
  const wantTarget = HOME.target.clone();
  const spherical = { radius: HOME.radius, theta: HOME.theta, phi: HOME.phi };
  const want = { radius: spherical.radius, theta: spherical.theta, phi: spherical.phi };

  function updateCameraFromSpherical() {
    const s = spherical;
    camera.position.set(
      target.x + s.radius * Math.sin(s.phi) * Math.sin(s.theta),
      target.y + s.radius * Math.cos(s.phi),
      target.z + s.radius * Math.sin(s.phi) * Math.cos(s.theta)
    );
    camera.lookAt(target);
  }

  // ---- 드래그로 회전 / 휠로 줌 ----
  let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0;
  let entered = null; // 지금 카드가 열려있는 방 이름, 없으면 null

  canvas.addEventListener('pointerdown', (e) => {
    downX = e.clientX; downY = e.clientY; downT = performance.now();
    if (entered) return; // 카드가 열려있는 동안은 드래그로 회전 안 되게 함 (탭 여부는 pointerup에서 판단)
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      want.theta -= dx * 0.0055;
      want.phi = Math.min(MAX_PHI, Math.max(MIN_PHI, want.phi - dy * 0.004));
    } else if (!entered) {
      checkHover(e);
    }
  });
  window.addEventListener('pointerup', (e) => {
    // 드래그 없이 살짝 눌렀다 뗀 것(450ms 안, 거의 안 움직인 것)만 "클릭"으로 침 —
    // 안 그러면 회전하려고 드래그할 때마다 가구를 잘못 클릭한 걸로 오해함.
    const tapped = Math.abs(e.clientX - downX) <= 4 && Math.abs(e.clientY - downY) <= 4
      && performance.now() - downT < 450;
    if (entered) {
      // 카드가 열려있을 땐 3D 캔버스(=카드 뒤 배경) 아무 데나 탭하면 포커스가 풀림.
      if (tapped) leaveRoom();
      return;
    }
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('dragging');
    if (tapped) handleClick(e);
  });
  // 휠 줌은 "커서가 가리키는 곳"을 향해 — 가까이 갈 땐 목표 지점을 커서 아래
  // 지점 쪽으로 끌어오고(가장자리의 턴테이블/곰인형도 확대해서 볼 수 있게),
  // 멀어질 땐 첫 화면 목표 지점으로 조금씩 되돌려서 끝까지 빼면 원래 시점이 됨.
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const oldR = want.radius;
    const newR = Math.min(maxR(), Math.max(MIN_R, oldR + e.deltaY * 0.012 * fit));
    if (newR < oldR) {
      const p = pointUnderCursor(e);
      if (p) wantTarget.lerp(p, 1 - newR / oldR);
    } else if (newR > oldR) {
      const back = oldR < homeR() ? Math.min(1, (newR - oldR) / (homeR() - oldR)) : 1;
      wantTarget.lerp(HOME.target, back);
    }
    want.radius = newR;
    clampTarget(wantTarget);
  }, { passive: false });

  // ---- 가구 위에 마우스를 올리면 커서 변경, 클릭하면 입장 ----
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();
  function setNDC(e) {
    const r = canvas.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  function roomOfObject(obj) {
    // 레이캐스터가 맞히는 건 가구를 이루는 낱개 메시(예: 책 한 권)라서,
    // 그 메시의 부모를 타고 올라가며 userData.room이 붙은 "가구 그룹"을 찾음.
    let o = obj;
    while (o) { if (o.userData && o.userData.room) return o.userData.room; o = o.parent; }
    return null;
  }
  function isBall(obj) {
    // 공은 어느 방에도 속하지 않는 장난감이라 userData.isBall로 따로 구분함.
    let o = obj;
    while (o) { if (o.userData && o.userData.isBall) return true; o = o.parent; }
    return false;
  }
  // 커서 아래의 3D 지점 — 가구에 닿으면 그 지점, 아니면(곰인형·바닥 등)
  // 가구 높이쯤의 수평면과 만나는 지점. 둘 다 없으면(허공) null.
  const cursorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8);
  function pointUnderCursor(e) {
    setNDC(e);
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(interactiveGroups, true);
    if (hits.length) return hits[0].point.clone();
    return raycaster.ray.intersectPlane(cursorPlane, new THREE.Vector3());
  }
  // 목표 지점이 방 밖(벽 너머/바닥 아래/너무 높이)으로 나가지 않게 가둠.
  function clampTarget(t) {
    const r = Math.hypot(t.x, t.z);
    if (r > LIMIT.radius) { t.x *= LIMIT.radius / r; t.z *= LIMIT.radius / r; }
    t.y = Math.min(LIMIT.maxY, Math.max(LIMIT.minY, t.y));
  }

  function checkHover(e) {
    setNDC(e);
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(interactiveGroups, true);
    canvas.classList.toggle('hover', hits.length > 0);
  }
  function handleClick(e) {
    setNDC(e);
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(interactiveGroups, true);
    if (!hits.length) return;
    if (isBall(hits[0].object)) { kickBall(); return; }
    const room = roomOfObject(hits[0].object);
    if (room) enterRoom(room);
  }

  // ---- 카드/버튼 DOM 연결 ----
  function setCTAState(room) {
    dom.ctaBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.room === room)));
  }
  function enterRoom(room) {
    entered = room;
    const f = FOCUS[room];
    want.theta = f.theta; want.phi = f.phi; want.radius = f.radius * fit;
    wantTarget.copy(f.target);

    const info = roomInfo[room];
    dom.card.setAttribute('data-room', room);
    if (dom.cardTag) dom.cardTag.textContent = info.tag || '';
    dom.cardTitle.textContent = info.title;
    dom.cardBody.textContent = info.body;
    dom.card.classList.add('show');
    setCTAState(room);
  }
  function leaveRoom() {
    entered = null;
    want.theta = HOME.theta; want.phi = HOME.phi; want.radius = homeR();
    wantTarget.copy(HOME.target);
    dom.card.classList.remove('show');
    setCTAState(null);
  }

  dom.cardBack.addEventListener('click', leaveRoom);
  dom.cardEnter.addEventListener('click', () => onConfirm(dom.card.getAttribute('data-room')));
  dom.ctaBtns.forEach((b) => {
    b.addEventListener('click', () => {
      if (entered === b.dataset.room) leaveRoom();
      else enterRoom(b.dataset.room);
    });
  });

  // 처음 만들어질 때 카메라를 HOME 위치로 한 번 맞춰둠 (첫 렌더 프레임이
  // 뜨기 전부터 카메라 위치가 올바르게 잡혀 있도록).
  updateCameraFromSpherical();

  return {
    // 화면 비율이 바뀔 때 main.js가 불러줌 — 지금 거리도 같은 비율로 늘이거나
    // 줄여서, 창 크기를 바꿔도 보던 구도가 그대로 유지되게 함.
    setFit(f) {
      const k = f / fit;
      fit = f;
      want.radius *= k;
      spherical.radius *= k;
      updateCameraFromSpherical();
    },
    // main.js의 렌더 루프가 매 프레임 불러줌: 목표 각도/거리(want)와 목표
    // 지점(wantTarget)을 향해 부드럽게 따라감(자동 회전은 하지 않음).
    update(dt) {
      const damp = REDUCED ? 1 : 0.09;
      spherical.theta += (want.theta - spherical.theta) * damp;
      spherical.phi += (want.phi - spherical.phi) * damp;
      spherical.radius += (want.radius - spherical.radius) * damp;
      target.lerp(wantTarget, damp);
      updateCameraFromSpherical();
    },
  };
}
