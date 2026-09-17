// 로비의 "생김새"만 담당하는 모듈: 바닥, 벽, 러그, 이젤, 책장, 조명,
// 떠다니는 먼지 파티클을 만들어서 THREE.Scene 하나로 조립함.
//
// 여긴 사용자 입력(드래그, 클릭)을 전혀 다루지 않음 — 그건
// controls.js의 역할. 이 파일은 "3D 공간에 뭘 놓을지"만 결정하고,
// controls.js/main.js가 필요로 하는 것들(장면 자체, 클릭 가능한
// 가구 그룹들, 먼지를 매 프레임 움직이는 함수)을 돌려줌.
//
// THREE는 index.html에서 <script>로 먼저 불러온 전역 변수라서 따로
// import할 필요 없음 (UMD 빌드라 window.THREE에 붙어 있음).

const VOID = 0x120f0c;
const FLOOR_W = 9, FLOOR_D = 6.6, WALL_H = 4.1;

// 캔버스 2D로 그림을 그려서 THREE 텍스처로 만드는 공용 헬퍼.
// (이미지 파일 없이도 라벨 글자나 그라데이션 같은 걸 만들 수 있음)
function makeCanvasTexture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// 가구 아래에 깔아서 "그림자가 살짝 진 느낌"을 흉내 내는 원형 그라데이션
// (진짜 앰비언트 오클루전 계산을 하는 대신 쓰는 값싼 트릭).
function aoBlob(radius) {
  const tex = makeCanvasTexture((ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, 256, 256);
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

// 가구 위에 둥둥 떠 있는 이름표(알약 모양 배경 + 글자)를 만드는 헬퍼.
// Sprite라서 카메라가 어느 각도에 있든 항상 정면으로 보임.
function labelSprite(text, colorHex) {
  const tex = makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = 26;
    ctx.fillStyle = 'rgba(18,15,12,0.62)';
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r, h * 0.5 - 32);
    ctx.arcTo(w - 8, h * 0.5 - 32, w - 8, h * 0.5 + 32, r);
    ctx.arcTo(w - 8, h * 0.5 + 32, 8, h * 0.5 + 32, r);
    ctx.arcTo(8, h * 0.5 + 32, 8, h * 0.5 - 32, r);
    ctx.arcTo(8, h * 0.5 - 32, w - 8, h * 0.5 - 32, r);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f3ece0';
    ctx.font = '600 40px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h * 0.5 + 2);
  }, 512, 160);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.9, 0.6, 1);
  return sprite;
}

// 방의 뼈대: 나무 바닥(판자 여러 개를 이어붙여 살짝 얼룩덜룩하게),
// 뒷벽 + 왼쪽 벽(카메라가 있는 쪽은 뚫려 있어야 안이 들여다보임),
// 걸레받이, 가운데 러그.
function buildRoomShell() {
  const room = new THREE.Group();

  const plankCount = 16, plankW = FLOOR_W / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const shade = (i % 2 === 0) ? 0x2a2016 : 0x251c13;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(plankW * 0.96, 0.05, FLOOR_D),
      new THREE.MeshStandardMaterial({ color: shade, roughness: 0.9, metalness: 0.02 })
    );
    plank.position.set(-FLOOR_W / 2 + plankW * (i + 0.5), -0.025, 0);
    plank.receiveShadow = true;
    room.add(plank);
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcdbfa4, roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, WALL_H, 0.12), wallMat);
  backWall.position.set(0, WALL_H / 2, -FLOOR_D / 2);
  backWall.receiveShadow = true;
  room.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, WALL_H, FLOOR_D), wallMat);
  leftWall.position.set(-FLOOR_W / 2, WALL_H / 2, 0);
  leftWall.receiveShadow = true;
  room.add(leftWall);

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.8 });
  const baseBack = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 0.16, 0.14), baseMat);
  baseBack.position.set(0, 0.08, -FLOOR_D / 2 + 0.05);
  room.add(baseBack);
  const baseLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, FLOOR_D), baseMat);
  baseLeft.position.set(-FLOOR_W / 2 + 0.05, 0.08, 0);
  room.add(baseLeft);

  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.7, 0.03, 40),
    new THREE.MeshStandardMaterial({ color: 0x5a2e22, roughness: 0.95 })
  );
  rug.position.set(-0.4, 0.015, 1.3);
  rug.receiveShadow = true;
  room.add(rug);

  return room;
}

// 스케치북 방을 나타내는 가구: 이젤 + 캔버스 보드(그림이 그려진 척하는
// 텍스처) + 스툴. userData.room = 'sketchbook' 을 붙여둬서, 나중에
// controls.js가 레이캐스팅(마우스가 가리키는 3D 오브젝트 찾기)으로
// "이게 어느 방 소속인지" 바로 알 수 있게 함.
function buildEasel() {
  const easel = new THREE.Group();
  easel.userData.room = 'sketchbook';
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.7 });

  function leg(x, z, tiltZ, tiltX) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 8), legMat);
    l.position.set(x, 0.95, z);
    l.rotation.z = tiltZ || 0;
    l.rotation.x = tiltX || 0;
    l.castShadow = true;
    return l;
  }
  easel.add(leg(-0.34, 0.18, 0.16, 0));
  easel.add(leg(0.34, 0.18, -0.16, 0));
  easel.add(leg(0, -0.32, 0, -0.22));

  const boardTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#efe6d4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d9793a';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(20, h * 0.7); ctx.quadraticCurveTo(w * 0.35, h * 0.25, w * 0.55, h * 0.5); ctx.quadraticCurveTo(w * 0.7, h * 0.68, w - 20, h * 0.3); ctx.stroke();
    ctx.strokeStyle = '#c79a4b';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(30, h * 0.85); ctx.quadraticCurveTo(w * 0.5, h * 0.95, w - 30, h * 0.8); ctx.stroke();
  }, 200, 260);
  const boardSideMat = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.8 });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.3, 0.04),
    [boardSideMat, boardSideMat, boardSideMat, boardSideMat,
      new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), boardSideMat]
  );
  board.position.set(0, 1.35, 0.05);
  board.rotation.x = -0.12;
  board.castShadow = true;
  easel.add(board);

  const stool = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.07, 16), legMat);
  seat.position.y = 0.5; seat.castShadow = true;
  stool.add(seat);
  [[-0.18, -0.18], [0.18, -0.18], [0, 0.2]].forEach((p) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), legMat);
    l.position.set(p[0], 0.25, p[1]);
    l.castShadow = true;
    stool.add(l);
  });
  stool.position.set(0.75, 0, 0.55);
  easel.add(stool);

  easel.add(aoBlob(1.15));
  const label = labelSprite('스케치북', '#d9793a');
  label.position.set(0, 2.35, 0);
  easel.add(label);

  easel.position.set(-2.9, 0, -0.5);
  easel.rotation.y = 0.5;
  return easel;
}

// 기록 보관소 방을 나타내는 가구: 3단 책장 + 무작위로 채운 책들.
function buildBookshelf() {
  const shelf = new THREE.Group();
  shelf.userData.room = 'library';
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.75 });
  const SW = 2.15, SH = 2.5, SD = 0.36;

  const back = new THREE.Mesh(new THREE.BoxGeometry(SW, SH, 0.04), caseMat);
  back.position.set(0, SH / 2, -SD / 2);
  shelf.add(back);
  [-SW / 2, SW / 2].forEach((x) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, SH, SD), caseMat);
    side.position.set(x, SH / 2, 0);
    side.castShadow = true;
    shelf.add(side);
  });
  [0, SH * 0.34, SH * 0.67, SH].forEach((y) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(SW, 0.05, SD), caseMat);
    board.position.set(0, y, 0);
    board.castShadow = true; board.receiveShadow = true;
    shelf.add(board);
  });

  const bookColors = [0x8a3a2e, 0xc79a4b, 0x2f4a45, 0x5a3d24, 0x9c5b3c, 0x38343a, 0xb0673f];
  const shelfYs = [0.09, SH * 0.34 + 0.09, SH * 0.67 + 0.09];
  shelfYs.forEach((y) => {
    let x = -SW / 2 + 0.14;
    let guard = 0; // 무한루프 방지용 안전장치 (책 너비가 랜덤이라 이론상 끝이 안 날 수도 있어서)
    while (x < SW / 2 - 0.14 && guard < 40) {
      guard++;
      const bw = 0.07 + Math.random() * 0.05;
      const bh = 0.32 + Math.random() * 0.16;
      const bd = SD - 0.1;
      const col = bookColors[Math.floor(Math.random() * bookColors.length)];
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, bd),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })
      );
      book.position.set(x + bw / 2, y + bh / 2, 0);
      book.rotation.y = (Math.random() - 0.5) * 0.05; // 살짝 삐뚤빼뚤하게 꽂힌 느낌
      book.castShadow = true; book.receiveShadow = true;
      shelf.add(book);
      x += bw + 0.012;
    }
  });

  shelf.add(aoBlob(1.4));
  const label = labelSprite('기록 보관소', '#c79a4b');
  label.position.set(0, SH + 0.5, 0);
  shelf.add(label);

  shelf.position.set(1.9, 0, -FLOOR_D / 2 + SD / 2 + 0.06);
  return shelf;
}

// 조명 한 세트를 장면에 붙임: 은은한 반구 조명(hemi, 전체 밝기),
// 위에서 비추는 스포트라이트(그림자를 만듦 — "무대 조명" 느낌),
// 그리고 각 가구 옆에 그 방 색깔을 띤 포인트 라이트.
function addLighting(scene) {
  const hemi = new THREE.HemisphereLight(0x3a2c1e, 0x0a0806, 0.55);
  scene.add(hemi);

  const spot = new THREE.SpotLight(0xfff1de, 3.2, 18, 0.62, 0.55, 1.4);
  spot.position.set(0.5, 6.4, 3.2);
  spot.target.position.set(-0.4, 0.3, -0.8);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 2;
  spot.shadow.camera.far = 14;
  scene.add(spot, spot.target);

  const emberLight = new THREE.PointLight(0xd9793a, 1.1, 5.5, 2);
  emberLight.position.set(-2.6, 1.9, 0.2);
  scene.add(emberLight);

  const goldLight = new THREE.PointLight(0xc79a4b, 1.0, 6, 2);
  goldLight.position.set(1.9, 2.4, -1.9);
  scene.add(goldLight);
}

// 스포트라이트 빛줄기 속을 천천히 떠오르는 먼지 입자들 — 조명이 진짜
// 공간을 비추고 있다는 느낌을 값싸게 더해주는 장식.
function buildDustMotes() {
  const count = 46;
  const positions = new Float32Array(count * 3);
  for (let m = 0; m < count; m++) {
    positions[m * 3] = -3 + Math.random() * 6;
    positions[m * 3 + 1] = 0.3 + Math.random() * 3.4;
    positions[m * 3 + 2] = -3 + Math.random() * 5.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xf3ece0, size: 0.02, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
}

// 이 모듈에서 밖으로 내놓는 단 하나의 함수. 로비 장면 전체를 한 번에
// 만들어서, main.js/controls.js가 필요로 하는 것들을 돌려줌.
export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VOID);
  // 멀어질수록 안개에 잠기게 해서, 방의 경계가 딱딱 잘려 보이는 대신
  // 어둠 속으로 자연스럽게 사라지는 느낌을 줌.
  scene.fog = new THREE.Fog(VOID, 7, 17);

  const room = buildRoomShell();
  const easel = buildEasel();
  const shelf = buildBookshelf();
  room.add(easel, shelf);
  scene.add(room);

  addLighting(scene);

  const motes = buildDustMotes();
  scene.add(motes);
  const moteCount = motes.geometry.attributes.position.count;

  return {
    scene,
    // 클릭/호버 대상이 되는 가구 그룹들 — controls.js가 레이캐스팅할 때 씀.
    interactiveGroups: [easel, shelf],
    // 매 프레임 먼지를 살짝 위로 움직이고, 천장 높이를 넘으면 바닥으로
    // 되돌려서 계속 떠다니는 것처럼 보이게 함.
    updateMotes(dt) {
      const pos = motes.geometry.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        pos[i * 3 + 1] += dt * 0.05;
        if (pos[i * 3 + 1] > 3.8) pos[i * 3 + 1] = 0.3;
      }
      motes.geometry.attributes.position.needsUpdate = true;
    },
  };
}
