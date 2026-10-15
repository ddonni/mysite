import { makeCanvasTexture } from '../canvasTexture.js';
import { aoBlob } from '../aoBlob.js';
import { drawFurTexture } from './teddyBear.js';

// 곰인형 옆에 앉은 토끼 인형 — 곰인형(teddyBear.js)과 같은 방식(구를 크기·비율만
// 다르게 겹치고 잔털 텍스처를 입힘)의 순수 장식이라 클릭 대상(interactiveGroups)엔
// 안 넣음. 곰보다 조금 작고, 크림색 털에 분홍 귀 안쪽·볼터치. 긴 귀 한쪽은
// 살짝 접혀 내려와서 축 늘어진 인형 느낌. 원점은 바닥 가운데, 앞이 +z.
// 자리(곰인형 옆)는 roomLayout.js가 잡음.
export function buildBunnyPlush() {
  const group = new THREE.Group();

  const furTex = makeCanvasTexture((ctx, w, h) => drawFurTexture(ctx, w, h, '#f1e6d6'), 128, 128);
  furTex.wrapS = THREE.RepeatWrapping; furTex.wrapT = THREE.RepeatWrapping; furTex.repeat.set(3, 3);
  const furMat = new THREE.MeshStandardMaterial({ map: furTex, roughness: 0.95 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf2b3bf, roughness: 0.9 });
  const blushMat = new THREE.MeshStandardMaterial({ color: 0xf29aa9, roughness: 0.9, transparent: true, opacity: 0.75 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.25, metalness: 0.1 });
  const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const add = (geo, mat, x, y, z, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow) m.castShadow = true;
    group.add(m);
    return m;
  };

  // 몸통 — 배가 볼록한 공 모양.
  const body = add(new THREE.SphereGeometry(0.2, 20, 16), furMat, 0, 0.2, 0);
  body.scale.set(1, 1.02, 0.92);
  body.receiveShadow = true;

  // 머리 — 몸통보다 살짝 크게(치비 비율).
  add(new THREE.SphereGeometry(0.18, 20, 16), furMat, 0, 0.43, 0.02);

  // 긴 귀: 바깥(털) + 안쪽(분홍). 왼쪽 귀는 곧게, 오른쪽 귀는 중간에서 접혀 내려옴.
  function ear(side, folded) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.08, 0.57, 0.0);
    pivot.rotation.z = -side * 0.18;
    group.add(pivot);
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 12), furMat);
    outer.scale.set(0.9, folded ? 1.6 : 2.7, 0.55);
    outer.position.y = folded ? 0.08 : 0.15;
    outer.castShadow = true;
    pivot.add(outer);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), pinkMat);
    inner.scale.set(0.9, folded ? 1.9 : 3.2, 0.4);
    inner.position.set(0, outer.position.y, 0.025);
    pivot.add(inner);
    if (folded) {
      // 접힌 끝 — 옆으로 꺾여 축 늘어진 부분.
      const tip = new THREE.Group();
      tip.position.y = 0.17;
      tip.rotation.z = -side * 1.9;
      pivot.add(tip);
      const tipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), furMat);
      tipMesh.scale.set(0.9, 1.5, 0.55);
      tipMesh.position.y = 0.07;
      tipMesh.castShadow = true;
      tip.add(tipMesh);
    }
  }
  ear(-1, false);
  ear(1, true);

  // 주둥이(작은 흰 볼록) + 분홍 코 + 볼터치.
  const muzzle = add(new THREE.SphereGeometry(0.07, 14, 10), furMat, 0, 0.385, 0.15, false);
  muzzle.scale.set(1.15, 0.75, 0.8);
  add(new THREE.SphereGeometry(0.02, 8, 6), pinkMat, 0, 0.41, 0.21, false);
  [-1, 1].forEach((side) => {
    const cheek = add(new THREE.SphereGeometry(0.032, 10, 8), blushMat, side * 0.105, 0.39, 0.15, false);
    cheek.scale.set(1, 0.6, 0.4);
  });

  // 눈 — 곰인형처럼 머리 표면보다 확실히 앞으로(안 그러면 파묻혀 안 보임).
  [-1, 1].forEach((side) => {
    add(new THREE.SphereGeometry(0.026, 10, 8), eyeMat, side * 0.07, 0.45, 0.17, false);
    add(new THREE.SphereGeometry(0.008, 6, 6), sparkleMat, side * 0.07 + 0.009, 0.46, 0.192, false);
  });

  // 팔(앞으로 모은 작은 손) + 앞으로 뻗은 발 + 발바닥 분홍 패치.
  [-1, 1].forEach((side) => {
    const arm = add(new THREE.SphereGeometry(0.065, 12, 10), furMat, side * 0.16, 0.24, 0.12);
    arm.scale.set(0.8, 1.1, 0.8);
    const foot = add(new THREE.SphereGeometry(0.075, 12, 10), furMat, side * 0.11, 0.065, 0.16);
    foot.scale.set(0.9, 0.65, 1.35);
    const pad = add(new THREE.SphereGeometry(0.035, 10, 8), pinkMat, side * 0.11, 0.06, 0.255, false);
    pad.scale.set(1, 0.8, 0.4);
  });

  // 뒤쪽 동그란 꼬리.
  add(new THREE.SphereGeometry(0.06, 12, 10), furMat, 0, 0.12, -0.19);

  group.add(aoBlob(0.32));

  // 곰인형(앉은키 1.1)보다 조금 작게 — 귀 끝까지 1.0 정도.
  const NATURAL_HEIGHT = 0.86, TARGET_HEIGHT = 1.0;
  group.scale.setScalar(TARGET_HEIGHT / NATURAL_HEIGHT);
  return group;
}
