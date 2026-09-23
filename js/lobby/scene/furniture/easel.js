import { PAGE_BG, drawStroke } from '../../../shared/strokes.js';
import { aoBlob } from '../aoBlob.js';

const BOARD_TEX_W = 260, BOARD_TEX_H = 200; // sketchbook.js 페이지 비율(가로가 긴 쪽)과 맞춤

// 이젤 보드에 실제 스케치북 1페이지 내용을 그려주는 헬퍼. 로비가 뜬
// 직후엔 빈 종이로 시작했다가, main.js가 서버에서 스트로크를 받아오면
// 이 함수로 다시 그려서 보드 텍스처를 갱신함.
function drawBoardPreview(ctx, strokes) {
  ctx.clearRect(0, 0, BOARD_TEX_W, BOARD_TEX_H);
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, BOARD_TEX_W, BOARD_TEX_H);
  (strokes || []).forEach((st) => drawStroke(ctx, st, BOARD_TEX_W, BOARD_TEX_H));
}

// 스케치북 방을 나타내는 가구: 이젤 + 캔버스 보드(그림이 그려진 척하는
// 텍스처) + 스툴. userData.room = 'sketchbook' 을 붙여둬서, 나중에
// controls.js가 레이캐스팅(마우스가 가리키는 3D 오브젝트 찾기)으로
// "이게 어느 방 소속인지" 바로 알 수 있게 함.
export function buildEasel() {
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

  // z를 원래(0.6)보다 살짝 앞으로 당겨서, 뒤쪽(책장 방향)에 냉장고가
  // 들어설 자리를 내줌 — furniture/fridge.js 주석 참고.
  easel.position.set(-3.7, 0, 0.95);
  easel.rotation.y = 0.5;

  // main.js가 서버에서 스트로크를 받아온 뒤 이걸 호출해서 보드에 실제
  // 1페이지 그림을 채워넣음.
  easel.userData.setPreview = (strokes) => {
    drawBoardPreview(boardCtx, strokes);
    boardTex.needsUpdate = true;
  };

  return easel;
}
