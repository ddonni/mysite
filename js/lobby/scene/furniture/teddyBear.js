import { FLOOR_W } from '../roomDimensions.js';
import { makeCanvasTexture } from '../canvasTexture.js';
import { aoBlob } from '../aoBlob.js';

// 곰인형 털 텍스처 — 매끈한 구슬처럼 안 보이게, 짧은 잔털처럼 보이는
// 무작위 획을 잔뜩 그려서 표면에 은은한 질감을 입힘(진짜 털 셰이더 대신
// 쓰는 값싼 트릭 — 다른 가구들의 캔버스 텍스처와 같은 방식).
function drawFurTexture(ctx, w, h, baseHex) {
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const len = 2.5 + Math.random() * 3.5;
    const angle = Math.random() * Math.PI;
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(40,24,10,0.10)' : 'rgba(255,244,225,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
}

// 러그 한쪽 구석에 앉아있는 곰인형 — 공처럼 어느 방에도 속하지 않는
// 순수 장식품. 구(sphere)를 크기/비율만 다르게 여러 개 겹쳐서 만든
// 값싼 형태지만, 배 무늬·반짝이는 눈·잔털 텍스처로 귀여움을 더함.
// 공과 달리 가만히 앉아있기만 하고 움직이지 않아서 interactiveGroups엔
// 안 넣음(클릭해도 아무 일도 안 일어남).
export function buildTeddyBear() {
  const group = new THREE.Group();

  const furTex = makeCanvasTexture((ctx, w, h) => drawFurTexture(ctx, w, h, '#c98a52'), 128, 128);
  furTex.wrapS = THREE.RepeatWrapping; furTex.wrapT = THREE.RepeatWrapping; furTex.repeat.set(3, 3);
  const furMat = new THREE.MeshStandardMaterial({ map: furTex, roughness: 0.95 });

  const bellyTex = makeCanvasTexture((ctx, w, h) => drawFurTexture(ctx, w, h, '#f3ece0'), 128, 128);
  bellyTex.wrapS = THREE.RepeatWrapping; bellyTex.wrapT = THREE.RepeatWrapping; bellyTex.repeat.set(2, 2);
  const bellyMat = new THREE.MeshStandardMaterial({ map: bellyTex, roughness: 0.95 });

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.25, metalness: 0.1 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.5 });
  const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // 예전보다 한 단계씩 키우고, 머리를 몸통만큼 크게 잡아서 아기자기한
  // (치비) 비율로 — 목이 안 보이고 머리가 커야 귀여워 보임.
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), furMat);
  body.scale.set(1, 0.95, 0.92);
  body.position.set(0, 0.228, 0);
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // 배 무늬 — 몸통 앞면에 얹은 크림색 타원 패치.
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), bellyMat);
  belly.scale.set(0.85, 0.95, 0.35);
  belly.position.set(0, 0.2, 0.185);
  group.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), furMat);
  head.position.set(0, 0.44, 0.03);
  head.castShadow = true;
  group.add(head);

  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), furMat);
    ear.position.set(side * 0.14, 0.575, 0.02);
    ear.castShadow = true;
    group.add(ear);
  });

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), bellyMat);
  snout.scale.set(1, 0.82, 0.88);
  snout.position.set(0, 0.385, 0.17);
  group.add(snout);

  // 코는 snout 표면(z≈0.25) 밖으로 확실히 튀어나오게 — 전엔 z가 그보다
  // 안쪽이라 snout 속에 파묻혀 안 보였음(실제 겪은 버그).
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeMat);
  nose.position.set(0, 0.4, 0.26);
  group.add(nose);

  // 눈은 흰자(대비용) + 검은 눈동자 + 작은 반짝임 점, 3겹으로 쌓음.
  // 머리 구체 표면(그 높이에서 z≈0.23)보다 확실히 앞으로 튀어나오게
  // z를 다시 잡음 — 전엔 표면보다 안쪽이라 파묻혀 안 보였음(실제 겪은
  // 버그, 코와 같은 원인).
  [-1, 1].forEach((side) => {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), eyeWhiteMat);
    eyeWhite.position.set(side * 0.078, 0.452, 0.238);
    group.add(eyeWhite);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), eyeMat);
    eye.position.set(side * 0.078, 0.448, 0.258);
    group.add(eye);
    const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), sparkleMat);
    sparkle.position.set(side * 0.078 + 0.011, 0.458, 0.278);
    group.add(sparkle);
  });

  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), furMat);
    arm.scale.set(0.85, 1.15, 0.85);
    arm.position.set(side * 0.275, 0.27, 0.04);
    arm.castShadow = true;
    group.add(arm);
  });

  // 앉은 자세라 발이 몸통 앞으로 살짝 삐져나온 것처럼 + 발바닥 패치.
  [-1, 1].forEach((side) => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), furMat);
    foot.scale.set(1, 0.68, 1.2);
    foot.position.set(side * 0.15, 0.09, 0.17);
    foot.castShadow = true;
    group.add(foot);

    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), bellyMat);
    pad.scale.set(1, 0.4, 1);
    pad.position.set(side * 0.15, 0.065, 0.235);
    group.add(pad);
  });

  group.add(aoBlob(0.42));

  // 책장(furniture/bookshelf.js의 SH=2.5)만큼 커지도록 통째로 스케일업
  // — 원래 크기(귀 끝, 가장 높은 점까지 y≈0.65) 기준으로 배율을 계산함.
  // group의 로컬 원점이 바닥(y=0) 기준이라, 이렇게 키워도 발은 그대로
  // 바닥에 붙어있고 위로만 커짐.
  const BEAR_HEIGHT = 0.65;
  const BOOKSHELF_HEIGHT = 2.5;
  group.scale.setScalar(BOOKSHELF_HEIGHT / BEAR_HEIGHT);

  // 로비엔 실제 오른쪽 벽이 없음(카메라 쪽이 트여있게 뒷벽+왼쪽 벽만
  // 있는 구조, roomShell.js 참고) — 대신 바닥 오른쪽 가장자리
  // (x=FLOOR_W/2=4.5)에 바짝 붙임. 지금 덩치(반지름 약 1.35)가 커서
  // 중심을 가장자리에 그대로 두면 바닥 밖으로 삐져나가므로, 그만큼
  // 안쪽으로 뺌. 방 안쪽(-x 방향)을 보게 90도 돌림.
  group.position.set(FLOOR_W / 2 - 1.6, 0, 0.8);
  group.rotation.y = -Math.PI / 2;

  return group;
}
