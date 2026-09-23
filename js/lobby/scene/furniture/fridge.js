import { FLOOR_W } from '../roomDimensions.js';
import { aoBlob } from '../aoBlob.js';

const FRIDGE_TEX_SIZE = 220; // 음식 사진은 보통 정사각형에 가까워서 그대로 맞춤

// 냉장고 문 기본 색(흰색 단색) — 사진이 없을 때 문 앞면을 이 색으로
// 채워서, 몸통의 다른 5면과 완전히 같은 색으로 이어지게 함(무늬 없음).
const FRIDGE_DOOR_HEX = '#f2f0ea';

function drawFridgeDefault(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = FRIDGE_DOOR_HEX;
  ctx.fillRect(0, 0, w, h);
}

// 냉장고 방(먹은 음식 기록)을 나타내는 가구: 위에 작은 냉동실 문,
// 아래에 큰 냉장실 문 — 실제 냉장고 실루엣(위 작은 문/아래 큰 문,
// 문마다 손잡이, 짧은 다리)에 최대한 가깝게 지음. 아래(큰) 문 앞면에
// 최근/인생 음식 사진을 자석으로 붙여둔 것처럼 보여줌. 책장 방과 안
// 겹치게 스케치북(이젤)과 책장 사이, 왼쪽 벽에 붙여 세워둠 —
// furniture/easel.js의 z 조정과 세트로 봐야 함. 왼쪽 벽은 로컬 +z가
// 아니라 +x쪽으로 열려 있어서, 다른 가구처럼 로컬 +z를 "정면"으로 짓고
// 그룹 전체를 90도 돌려 문이 방 안쪽(+x)을 보게 함.
export function buildFridge() {
  const group = new THREE.Group();
  group.userData.room = 'food';

  const FW = 0.85, FD = 0.62;
  const LEG_H = 0.06, BOTTOM_H = 1.28, GAP = 0.04, TOP_H = 0.31;

  // 깔끔한 흰색 단색 — 문/몸통/다리/손잡이 전부 같은 계열의 흰색이고,
  // 손잡이·다리·구분선만 살짝 더 차분한 톤이라 무늬 없이도 형태가
  // 구분됨(색 대비가 아니라 음영으로 읽힘).
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.4 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.35 });

  const photoCanvas = document.createElement('canvas');
  photoCanvas.width = FRIDGE_TEX_SIZE; photoCanvas.height = FRIDGE_TEX_SIZE;
  const photoCtx = photoCanvas.getContext('2d');
  drawFridgeDefault(photoCtx, FRIDGE_TEX_SIZE, FRIDGE_TEX_SIZE);
  const photoTex = new THREE.CanvasTexture(photoCanvas);
  photoTex.needsUpdate = true;

  // 다리 — 앞쪽으로 살짝 나와 있는 짧은 두 발.
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, LEG_H, 0.14), trimMat);
    leg.position.set(side * FW * 0.32, LEG_H / 2, FD * 0.2);
    leg.castShadow = true;
    group.add(leg);
  });

  // 손잡이는 문 밖으로 찔러 나온 막대가 아니라, 문에 거의 붙어서
  // 위아래로 긴 둥근 캡슐(알약/전화기 수화기 같은 실루엣) 모양 —
  // CapsuleGeometry(radius, length, ...)는 기본 축이 이미 Y(수직)라
  // 별도 회전 없이 세우기만 하면 됨. z는 문 앞면에서 살짝만 띔.
  function makeHandle(length) {
    return new THREE.Mesh(new THREE.CapsuleGeometry(0.028, length, 4, 10), trimMat);
  }

  // 아래쪽 냉장실 문 — 더 크고, 앞면(+z, BoxGeometry 재질 배열 순서
  // [+x,-x,+y,-y,+z,-z])에 실제 음식 사진을 보여줌.
  const bottomDoor = new THREE.Mesh(
    new THREE.BoxGeometry(FW, BOTTOM_H, FD),
    [doorMat, doorMat, doorMat, doorMat,
      new THREE.MeshStandardMaterial({ map: photoTex, roughness: 0.6 }), doorMat]
  );
  bottomDoor.position.set(0, LEG_H + BOTTOM_H / 2, 0);
  bottomDoor.castShadow = true; bottomDoor.receiveShadow = true;
  group.add(bottomDoor);

  const bottomHandle = makeHandle(BOTTOM_H * 0.3);
  bottomHandle.position.set(-FW * 0.34, LEG_H + BOTTOM_H * 0.68, FD / 2 + 0.035);
  bottomHandle.castShadow = true;
  group.add(bottomHandle);

  // 두 문을 가르는 얇은 가로줄 — 색은 문과 거의 같은 흰 계열이라
  // "무늬"가 아니라 음영으로만 살짝 읽히는 정도.
  const divider = new THREE.Mesh(new THREE.BoxGeometry(FW + 0.008, GAP, FD + 0.008), trimMat);
  divider.position.set(0, LEG_H + BOTTOM_H + GAP / 2, 0);
  group.add(divider);

  // 위쪽 냉동실 문 — 더 작고, 사진 없이 같은 색 문짝만.
  const topDoor = new THREE.Mesh(new THREE.BoxGeometry(FW, TOP_H, FD), doorMat);
  topDoor.position.set(0, LEG_H + BOTTOM_H + GAP + TOP_H / 2, 0);
  topDoor.castShadow = true; topDoor.receiveShadow = true;
  group.add(topDoor);

  const topHandle = makeHandle(TOP_H * 0.5);
  topHandle.position.set(-FW * 0.34, LEG_H + BOTTOM_H + GAP + TOP_H * 0.5, FD / 2 + 0.03);
  topHandle.castShadow = true;
  group.add(topHandle);

  group.add(aoBlob(0.75));

  // 왼쪽 벽에 붙임(왼쪽 벽은 x = -FLOOR_W/2) — 이젤(스케치북, z≈0.95)과
  // 책장 앞쪽 가장자리(z≈-2.9) 사이의 빈 자리에 놓음. 다리부터 위로
  // 쌓아 지어서 y=0이 곧 바닥이라, 별도 y 오프셋이 필요 없음.
  group.position.set(-FLOOR_W / 2 + FD / 2 + 0.05, 0, -1.15);
  group.rotation.y = Math.PI / 2;

  // main.js가 "음식" 기록 중 인생 음식(있으면)/가장 최근 걸 받아온 뒤
  // 이걸 호출해서 문에 실제 사진을 채워넣음. food가 없으면(기록이 하나도
  // 없으면) 문은 그냥 무늬 없는 흰색 그대로 둠.
  group.userData.setFeaturedFood = (food) => {
    const url = food && food.photo_url;
    if (!url) {
      drawFridgeDefault(photoCtx, FRIDGE_TEX_SIZE, FRIDGE_TEX_SIZE);
      photoTex.needsUpdate = true;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        photoCtx.clearRect(0, 0, FRIDGE_TEX_SIZE, FRIDGE_TEX_SIZE);
        const scale = Math.max(FRIDGE_TEX_SIZE / img.width, FRIDGE_TEX_SIZE / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        photoCtx.drawImage(img, (FRIDGE_TEX_SIZE - dw) / 2, (FRIDGE_TEX_SIZE - dh) / 2, dw, dh);
        // S3 버킷에 CORS 설정이 없는 이미지면 캔버스가 "오염"돼서 이
        // 텍스처를 GPU에 올리는 순간 에러가 남 — getImageData로 미리
        // 오염 여부를 확인해서, 문제가 있으면 기본 이미지로 대체함.
        photoCtx.getImageData(0, 0, 1, 1);
        photoTex.needsUpdate = true;
      } catch (e) {
        drawFridgeDefault(photoCtx, FRIDGE_TEX_SIZE, FRIDGE_TEX_SIZE);
        photoTex.needsUpdate = true;
      }
    };
    img.onerror = () => { drawFridgeDefault(photoCtx, FRIDGE_TEX_SIZE, FRIDGE_TEX_SIZE); photoTex.needsUpdate = true; };
    img.src = url;
  };

  return group;
}
