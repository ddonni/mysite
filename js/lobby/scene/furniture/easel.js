import { PAGE_BG, drawStroke } from '../../../shared/strokes.js';
import { aoBlob } from '../aoBlob.js';
import { canvasToTexture } from '../canvasTexture.js';
import { stick } from '../stick.js';

const BOARD_TEX_W = 260, BOARD_TEX_H = 200; // 캔버스 페이지 비율(가로가 긴 쪽)과 맞춤

// 이젤에 걸린 캔버스에 실제 캔버스 페이지(1페이지) 그림을 그려주는 헬퍼.
// 로비가 뜬 직후엔 빈 캔버스로 시작했다가, 서버에서 스트로크를 받아오면
// 이 함수로 다시 그려서 텍스처를 갱신함.
function drawBoardPreview(ctx, strokes) {
  ctx.clearRect(0, 0, BOARD_TEX_W, BOARD_TEX_H);
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, BOARD_TEX_W, BOARD_TEX_H);
  (strokes || []).forEach((st) => drawStroke(ctx, st, BOARD_TEX_W, BOARD_TEX_H));
}

// 캔버스(그림판) 방을 나타내는 가구: 화실에 있는 A자 이젤 + 걸린 캔버스 +
// 스툴과 팔레트. userData.room = 'sketchbook'(페이지 주소가 sketchbook이라
// 내부 이름은 그대로) — controls.js가 레이캐스팅으로 "이게 어느 가구
// 소속인지" 바로 알 수 있게 함.
//
// 진짜 이젤처럼: 앞다리 둘이 아래로 벌어진 A자 틀 전체가 뒤로 TILT만큼
// 기울어 있고, 뒤에서 세 번째 다리가 비스듬히 받쳐줌. 캔버스는 틀에 달린
// 받침대(선반)에 얹혀 있고 위에서 집게가 눌러줌.
const TILT = 0.2; // 약 11° — 뒤로 기댄 느낌

export function buildEasel() {
  const easel = new THREE.Group();
  easel.userData.room = 'sketchbook';
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.7 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.7 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // 앞쪽 A자 틀 — 이 그룹을 통째로 뒤로 기울임(바닥 쪽이 회전축이라 다리
  // 끝은 바닥에 그대로 붙어 있음). 좌표는 기울이기 전 기준.
  const H = 2.35; // 틀 높이
  const frame = new THREE.Group();
  frame.add(stick(V(-0.46, 0, 0), V(-0.07, H, 0), 0.028, wood));
  frame.add(stick(V(0.46, 0, 0), V(0.07, H, 0), 0.028, wood));
  // 가운데 기둥 — 캔버스 뒤를 받치고 위로 살짝 삐져나옴.
  frame.add(stick(V(0, 0.55, -0.035), V(0, H + 0.12, -0.035), 0.024, wood));
  // 아래 가로대(다리 사이 보강).
  frame.add(stick(V(-0.4, 0.34, 0), V(0.4, 0.34, 0), 0.018, wood));

  // 캔버스 받침대 — 앞쪽에 턱이 있는 좁은 선반.
  const TRAY_Y = 0.74;
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.13), wood);
  tray.position.set(0, TRAY_Y, 0.05);
  tray.castShadow = true;
  frame.add(tray);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.018), wood);
  lip.position.set(0, TRAY_Y + 0.03, 0.11);
  frame.add(lip);

  // 캔버스 — 앞면엔 실제 그림, 옆면은 틀에 감긴 천(리넨) 색.
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = BOARD_TEX_W; boardCanvas.height = BOARD_TEX_H;
  const boardCtx = boardCanvas.getContext('2d');
  drawBoardPreview(boardCtx, []); // 실제 데이터가 도착하기 전까지는 빈 캔버스로 시작
  const boardTex = canvasToTexture(boardCanvas);
  boardTex.needsUpdate = true;
  const linen = new THREE.MeshStandardMaterial({ color: 0xe9e0cf, roughness: 0.95 });
  const CW = 1.3, CH = 1.0, CD = 0.045;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(CW, CH, CD),
    [linen, linen, linen, linen, new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), linen]
  );
  board.position.set(0, TRAY_Y + 0.02 + CH / 2, 0.02 + CD / 2);
  board.castShadow = true;
  frame.add(board);

  // 위에서 캔버스를 눌러 고정하는 집게.
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.1), darkWood);
  clamp.position.set(0, board.position.y + CH / 2 + 0.03, 0.02);
  clamp.castShadow = true;
  frame.add(clamp);

  frame.rotation.x = -TILT; // 윗부분이 뒤(-z)로 넘어가게
  easel.add(frame);

  // 뒷다리 — 틀 윗부분(기울어진 위치)에서 뒤쪽 바닥으로 비스듬히 뻗어 받침.
  const hinge = V(0, H - 0.2, -0.04).applyAxisAngle(V(1, 0, 0), -TILT);
  easel.add(stick(hinge, V(0, 0, -1.0), 0.026, wood));

  // 스툴 + 그 위에 놓인 팔레트(물감 몇 방울) — 그림 그리는 자리라는 느낌.
  const stool = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.07, 16), darkWood);
  seat.position.y = 0.5; seat.castShadow = true;
  stool.add(seat);
  [[-0.18, -0.18], [0.18, -0.18], [0, 0.2]].forEach((p) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), darkWood);
    l.position.set(p[0], 0.25, p[1]);
    l.castShadow = true;
    stool.add(l);
  });
  const palette = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.012, 24),
    new THREE.MeshStandardMaterial({ color: 0xc9a47a, roughness: 0.6 })
  );
  palette.scale.set(1, 1, 0.75);
  palette.position.set(0, 0.542, 0);
  palette.rotation.y = 0.4;
  stool.add(palette);
  [0xd9793a, 0x33456b, 0x365c3f, 0x9c3f34, 0xf1e7cf].forEach((c, i) => {
    const a = (i / 5) * Math.PI * 1.4 + 0.6;
    const dab = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 6),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 })
    );
    dab.scale.set(1, 0.35, 1);
    dab.position.set(Math.cos(a) * 0.11, 0.552, Math.sin(a) * 0.08);
    stool.add(dab);
  });
  stool.position.set(0.8, 0, 0.5);
  easel.add(stool);

  easel.add(aoBlob(1.15));
  // 자리(방 가운데 러그 위)는 roomLayout.js가 잡음.

  // 로비가 서버에서 스트로크를 받아온 뒤 이걸 호출해서 캔버스에 실제
  // 1페이지 그림을 채워넣음.
  easel.userData.setPreview = (strokes) => {
    drawBoardPreview(boardCtx, strokes);
    boardTex.needsUpdate = true;
  };

  return easel;
}
