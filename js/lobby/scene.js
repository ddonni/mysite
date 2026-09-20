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

import { PAGE_BG, drawStroke } from '../shared/strokes.js';
import { drawDefaultAlbumArt } from '../shared/album.js';

const VOID = 0x120f0c;
const FLOOR_W = 9, FLOOR_D = 6.6, WALL_H = 4.1;
const BOARD_TEX_W = 260, BOARD_TEX_H = 200; // sketchbook.js 페이지 비율(가로가 긴 쪽)과 맞춤
const PLATTER_TEX_SIZE = 256;
const FRAME_TEX_W = 220, FRAME_TEX_H = 280; // 책/애니/영화 포스터에 흔한 세로형 비율

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

// 턴테이블 위에 떠서 대표곡의 제목/가수를 보여주는 두 줄짜리 라벨 —
// 배경/테두리 없이 글자만. Sprite라서 카메라가 어느 각도에 있든 항상
// 정면으로 보임. 그림자를 살짝 넣어 배경 없이도 글자가 눈에 띄게 함.
function twoLineLabelSprite(line1, line2) {
  const tex = makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f3ece0';
    ctx.font = '600 38px Manrope, sans-serif';
    ctx.fillText(line1, w / 2, h * 0.38);
    ctx.fillStyle = 'rgba(243,236,224,0.75)';
    ctx.font = '500 28px Manrope, sans-serif';
    ctx.fillText(line2, w / 2, h * 0.72);
  }, 560, 200);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.1, 0.75, 1);
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
// 이젤 보드에 실제 스케치북 1페이지 내용을 그려주는 헬퍼. 로비가 뜬
// 직후엔 빈 종이로 시작했다가, main.js가 서버에서 스트로크를 받아오면
// 이 함수로 다시 그려서 보드 텍스처를 갱신함.
function drawBoardPreview(ctx, strokes) {
  ctx.clearRect(0, 0, BOARD_TEX_W, BOARD_TEX_H);
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, BOARD_TEX_W, BOARD_TEX_H);
  (strokes || []).forEach((st) => drawStroke(ctx, st, BOARD_TEX_W, BOARD_TEX_H));
}

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

  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = BOARD_TEX_W; boardCanvas.height = BOARD_TEX_H;
  const boardCtx = boardCanvas.getContext('2d');
  drawBoardPreview(boardCtx, []); // 실제 데이터가 도착하기 전까지는 빈 종이로 시작
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.needsUpdate = true;
  const boardSideMat = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.8 });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 1.0, 0.04),
    [boardSideMat, boardSideMat, boardSideMat, boardSideMat,
      new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), boardSideMat]
  );
  // z를 앞다리(z=0.18)보다 확실히 앞으로 빼서, 다리 막대가 그림을
  // 가로막지 않고 보드가 다리 앞에 놓인 것처럼 보이게 함.
  board.position.set(0, 1.2, 0.34); // 바닥 쪽 가장자리(~0.7)는 이전 세로형 보드와 맞춤
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

  easel.position.set(-3.7, 0, 0.6);
  easel.rotation.y = 0.5;

  // main.js가 서버에서 스트로크를 받아온 뒤 이걸 호출해서 보드에 실제
  // 1페이지 그림을 채워넣음.
  easel.userData.setPreview = (strokes) => {
    drawBoardPreview(boardCtx, strokes);
    boardTex.needsUpdate = true;
  };

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

  shelf.position.set(1.9, 0, -FLOOR_D / 2 + SD / 2 + 0.06);
  return shelf;
}

// 액자 캔버스에 그릴 기본 이미지 — 아직 이달의 작품이 정해지지
// 않았을(기록이 하나도 없을) 때 대신 보여주는 빈 액자 느낌의 아이콘.
function drawFrameArtDefault(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#3a2c1f');
  g.addColorStop(1, '#201d1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,253,250,0.3)';
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.34);
  ctx.lineTo(w * 0.28, h * 0.7);
  ctx.lineTo(w * 0.5, h * 0.62);
  ctx.lineTo(w * 0.72, h * 0.7);
  ctx.lineTo(w * 0.72, h * 0.34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.62);
  ctx.lineTo(w * 0.5, h * 0.28);
  ctx.stroke();
}

// 벽에 거는 액자: 이달의 작품(가장 최근 책/애니/영화 기록)의 표지 이미지를
// 담음. main.js가 setFeaturedWork로 실제 데이터를 채워줌 — 없으면 위의
// 기본 아이콘 그대로 둠.
function buildFeaturedFrame() {
  const group = new THREE.Group();
  group.userData.room = 'library';

  const FRAME_W = 0.85, FRAME_H = 1.05, FRAME_D = 0.05;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2016, roughness: 0.7 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(FRAME_W, FRAME_H, FRAME_D), frameMat);
  frame.castShadow = true;
  group.add(frame);

  const artCanvas = document.createElement('canvas');
  artCanvas.width = FRAME_TEX_W; artCanvas.height = FRAME_TEX_H;
  const artCtx = artCanvas.getContext('2d');
  drawFrameArtDefault(artCtx, FRAME_TEX_W, FRAME_TEX_H);
  const artTex = new THREE.CanvasTexture(artCanvas);
  artTex.needsUpdate = true;
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(FRAME_W - 0.1, FRAME_H - 0.1),
    new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.85 })
  );
  art.position.z = FRAME_D / 2 + 0.002;
  group.add(art);

  group.position.set(1.9, 3.3, -FLOOR_D / 2 + FRAME_D / 2 + 0.09);

  // main.js가 라이브러리의 최근 책/애니/영화 기록을 받아온 뒤 이걸
  // 호출해서 액자를 실제 표지 이미지로 채워넣음. work가 없으면(기록이
  // 하나도 없으면) 기본 아이콘 그대로 둠.
  group.userData.setFeaturedWork = (work) => {
    const url = work && work.photo_url;
    if (!url) {
      drawFrameArtDefault(artCtx, FRAME_TEX_W, FRAME_TEX_H);
      artTex.needsUpdate = true;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        artCtx.clearRect(0, 0, FRAME_TEX_W, FRAME_TEX_H);
        // 커버 이미지 비율이 액자와 달라도 잘리지 않고 꽉 채워지도록
        // (object-fit: cover와 같은 계산) 중앙을 기준으로 크롭해서 그림.
        const scale = Math.max(FRAME_TEX_W / img.width, FRAME_TEX_H / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        artCtx.drawImage(img, (FRAME_TEX_W - dw) / 2, (FRAME_TEX_H - dh) / 2, dw, dh);
        // S3 버킷에 CORS 설정이 없는 이미지면 캔버스가 "오염"돼서 이
        // 텍스처를 GPU에 올리는 순간 에러가 남 — getImageData로 미리
        // 오염 여부를 확인해서, 문제가 있으면 기본 이미지로 대체함.
        artCtx.getImageData(0, 0, 1, 1);
        artTex.needsUpdate = true;
      } catch (e) {
        drawFrameArtDefault(artCtx, FRAME_TEX_W, FRAME_TEX_H);
        artTex.needsUpdate = true;
      }
    };
    img.onerror = () => { drawFrameArtDefault(artCtx, FRAME_TEX_W, FRAME_TEX_H); artTex.needsUpdate = true; };
    img.src = url;
  };

  return group;
}

// 판(platter) 텍스처에 기본 앨범 이미지를 원형으로 잘라 그려넣음 — 실제
// 곡의 앨범 이미지가 없거나 아직 안 왔을 때 쓰는 상태.
function drawPlatterDefault(ctx) {
  ctx.clearRect(0, 0, PLATTER_TEX_SIZE, PLATTER_TEX_SIZE);
  ctx.save();
  ctx.beginPath();
  ctx.arc(PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  drawDefaultAlbumArt(ctx, PLATTER_TEX_SIZE, PLATTER_TEX_SIZE);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
}

// 음악 방을 나타내는 가구: 사이드 테이블 위의 턴테이블(계속 도는 LP +
// 톤암) + 대표곡 제목/가수 이름표. LP 위에 실제 앨범 이미지를 원형으로
// 감싸서 보여줌 — 없으면 기본 이미지로.
function buildTurntable() {
  const group = new THREE.Group();
  group.userData.room = 'music';

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.75 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.7), woodMat);
  table.position.set(0, 0.275, 0);
  table.castShadow = true; table.receiveShadow = true;
  group.add(table);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 32), bodyMat);
  body.position.set(0, 0.585, 0);
  body.castShadow = true;
  group.add(body);

  const platterCanvas = document.createElement('canvas');
  platterCanvas.width = PLATTER_TEX_SIZE; platterCanvas.height = PLATTER_TEX_SIZE;
  const platterCtx = platterCanvas.getContext('2d');
  drawPlatterDefault(platterCtx);
  const platterTex = new THREE.CanvasTexture(platterCanvas);
  platterTex.needsUpdate = true;
  const platter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.015, 48),
    new THREE.MeshStandardMaterial({ map: platterTex, roughness: 0.5 })
  );
  platter.position.set(0, 0.625, 0);
  platter.castShadow = true;
  group.add(platter);

  // 톤암: 뒤쪽 모서리에 얹혀서 판 가장자리 쪽으로만 살짝 걸침 — 중앙
  // 이미지는 안 가림.
  const armMat = new THREE.MeshStandardMaterial({ color: 0x9c9086, roughness: 0.4, metalness: 0.3 });
  const armPivot = new THREE.Group();
  armPivot.position.set(0.34, 0.63, -0.28);
  armPivot.rotation.y = 0.5;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), armMat);
  arm.position.set(-0.19, 0, 0);
  arm.rotation.z = Math.PI / 2;
  armPivot.add(arm);
  const armHead = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.03), armMat);
  armHead.position.set(-0.38, 0, 0);
  armPivot.add(armHead);
  group.add(armPivot);

  group.add(aoBlob(0.85));
  let label = twoLineLabelSprite('🎵 턴테이블', '노래를 추가해보세요');
  label.position.set(0, 1.55, 0);
  group.add(label);

  // 이젤(왼쪽, x=-2.9)과 책장(오른쪽, x=1.9) 사이, 스케치북 쪽으로
  // 더 뒤로 들어간 구석 자리 — 이젤이 회전해서 놓인 방향(rotation.y=0.5)과
  // 어긋나 있어서 이젤이 턴테이블을 가리지 않음.
  group.position.set(-0.9, 0, -2.4);
  group.rotation.y = 0.2;

  // main.js가 라이브러리의 최근 음악 기록을 받아온 뒤 이걸 호출해서
  // LP와 이름표를 실제 곡 정보로 채워넣음. song이 없으면(음악 기록이
  // 하나도 없으면) 기본 상태 그대로 둠.
  group.userData.setFeaturedSong = (song) => {
    group.remove(label);
    label = twoLineLabelSprite(
      `🎵 ${(song && song.title) || '턴테이블'}`,
      (song && (song.creator || '아티스트 미상')) || '노래를 추가해보세요'
    );
    label.position.set(0, 1.55, 0);
    group.add(label);

    const url = song && song.photo_url;
    if (!url) {
      drawPlatterDefault(platterCtx);
      platterTex.needsUpdate = true;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        platterCtx.clearRect(0, 0, PLATTER_TEX_SIZE, PLATTER_TEX_SIZE);
        platterCtx.save();
        platterCtx.beginPath();
        platterCtx.arc(PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, 0, Math.PI * 2);
        platterCtx.clip();
        platterCtx.drawImage(img, 0, 0, PLATTER_TEX_SIZE, PLATTER_TEX_SIZE);
        platterCtx.restore();
        // S3 버킷에 CORS 설정이 없는 이미지면 캔버스가 "오염"돼서 이
        // 텍스처를 GPU에 올리는 순간 에러가 남 — getImageData로 미리
        // 오염 여부를 확인해서, 문제가 있으면 기본 이미지로 대체함.
        platterCtx.getImageData(0, 0, 1, 1);
        platterTex.needsUpdate = true;
      } catch (e) {
        drawPlatterDefault(platterCtx);
        platterTex.needsUpdate = true;
      }
    };
    img.onerror = () => { drawPlatterDefault(platterCtx); platterTex.needsUpdate = true; };
    img.src = url;
  };

  // 매 프레임 LP를 천천히 돌림.
  group.userData.spin = (dt) => { platter.rotation.y += dt * 0.6; };

  return group;
}

// 조명 한 세트를 장면에 붙임: 은은한 반구 조명(hemi, 전체 밝기),
// 위에서 비추는 스포트라이트(그림자를 만듦 — "무대 조명" 느낌),
// 그리고 각 가구 옆에 그 방 색깔을 띤 포인트 라이트.
function addLighting(scene) {
  const hemi = new THREE.HemisphereLight(0x3a2c1e, 0x0a0806, 0.45);
  scene.add(hemi);

  const spot = new THREE.SpotLight(0xfff1de, 2.7, 22, 0.95, 0.6, 1.1);
  spot.position.set(0.5, 6.4, 3.2);
  spot.target.position.set(-0.4, 0.3, -0.8);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 2;
  spot.shadow.camera.far = 14;
  scene.add(spot, spot.target);

  // distance를 방 대각선 길이(~11)보다 넉넉히 키우고 decay를 낮춰서,
  // 각 가구 옆 불빛이 그 자리에만 고이지 않고 방 전체로 은은하게 퍼지게 함.
  const emberLight = new THREE.PointLight(0xd9793a, 0.9, 13, 1.4);
  emberLight.position.set(-2.6, 1.9, 0.2);
  scene.add(emberLight);

  const goldLight = new THREE.PointLight(0xc79a4b, 0.85, 13, 1.4);
  goldLight.position.set(1.9, 2.4, -1.9);
  scene.add(goldLight);

  const tealLight = new THREE.PointLight(0x4a9fc9, 0.75, 13, 1.4);
  tealLight.position.set(-0.9, 1.7, -2.4);
  scene.add(tealLight);
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
  const turntable = buildTurntable();
  const frame = buildFeaturedFrame();
  room.add(easel, shelf, turntable, frame);
  scene.add(room);

  addLighting(scene);

  const motes = buildDustMotes();
  scene.add(motes);
  const moteCount = motes.geometry.attributes.position.count;

  return {
    scene,
    // 클릭/호버 대상이 되는 가구 그룹들 — controls.js가 레이캐스팅할 때 씀.
    interactiveGroups: [easel, shelf, turntable, frame],
    // main.js가 내 방의 1페이지 스트로크를 받아오면 이걸 호출해서
    // 이젤 보드에 실제 그림을 채워넣음.
    setSketchbookPreview: easel.userData.setPreview,
    // main.js가 라이브러리의 최근 음악 기록을 받아오면 이걸 호출해서
    // 턴테이블에 실제 대표곡을 채워넣음.
    setFeaturedSong: turntable.userData.setFeaturedSong,
    // main.js가 라이브러리의 최근 책/애니/영화 기록을 받아오면 이걸
    // 호출해서 벽 액자에 이달의 작품 표지를 채워넣음.
    setFeaturedWork: frame.userData.setFeaturedWork,
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
    // 매 프레임 LP를 계속 돌림.
    updateTurntable: turntable.userData.spin,
  };
}
