import { aoBlob } from '../aoBlob.js';

// 방 왼쪽 앞 구석의 싱글 침대 — 어느 기록에도 속하지 않는 순수 장식이라
// 클릭 대상(interactiveGroups)에 안 넣음. 방이 "기록 전시장"이 아니라 실제로
// 사는 방처럼 보이게 함.
// 원점은 침대 바닥 가운데, 길이 방향이 x축(머리 쪽이 -x). 자리는 roomLayout.js가 잡음.
//   - 다리 넷 + 나무 프레임 + 매트리스
//   - 머리 쪽 높은 헤드보드(윗모서리는 둥글게), 발 쪽 낮은 풋보드
//   - 베개, 끝을 한 번 접어 내린 이불(양옆·발치로 늘어짐)

const L = 2.1, W = 1.15; // 길이(x), 폭(z)
const LEG_H = 0.12, FRAME_H = 0.16, MATT_H = 0.2;
const FRAME_TOP = LEG_H + FRAME_H;
const MATT_TOP = FRAME_TOP + MATT_H;

export function buildBed() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 0.65 });
  const linen = new THREE.MeshStandardMaterial({ color: 0xf2ece2, roughness: 0.95 });
  const duvet = new THREE.MeshStandardMaterial({ color: 0x77856a, roughness: 0.95 });

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // 다리 + 프레임 + 매트리스.
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    add(new THREE.BoxGeometry(0.07, LEG_H, 0.07), wood, sx * (L / 2 - 0.06), LEG_H / 2, sz * (W / 2 - 0.06));
  });
  add(new THREE.BoxGeometry(L, FRAME_H, W), wood, 0, LEG_H + FRAME_H / 2, 0);
  add(new THREE.BoxGeometry(L - 0.08, MATT_H, W - 0.08), linen, 0, FRAME_TOP + MATT_H / 2, 0);

  // 헤드보드(윗모서리는 옆으로 누운 원기둥으로 둥글게) + 낮은 풋보드.
  const HEAD_H = 0.82;
  add(new THREE.BoxGeometry(0.08, HEAD_H, W + 0.04), wood, -L / 2 - 0.02, LEG_H + HEAD_H / 2, 0);
  const cap = add(new THREE.CylinderGeometry(0.04, 0.04, W + 0.04, 16), wood, -L / 2 - 0.02, LEG_H + HEAD_H, 0);
  cap.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.06, 0.34, W + 0.04), wood, L / 2 + 0.01, LEG_H + 0.17, 0);

  // 베개 — 납작하게 누른 구.
  const pillow = add(new THREE.SphereGeometry(1, 24, 12), linen, -L / 2 + 0.3, MATT_TOP + 0.06, 0);
  pillow.scale.set(0.2, 0.08, 0.4);

  // 이불 — 베개 아래부터 발치까지 덮고, 양옆과 발치로 늘어짐. 머리 쪽 끝은
  // 한 번 접어 내려서 안쪽 흰 천이 둥글게 보임.
  const DUVET_X0 = -L / 2 + 0.55; // 이불 머리 쪽 끝
  const dl = L / 2 - DUVET_X0 + 0.02, dcx = (DUVET_X0 + L / 2 + 0.02) / 2;
  add(new THREE.BoxGeometry(dl, 0.06, W + 0.02), duvet, dcx, MATT_TOP + 0.03, 0);
  [-1, 1].forEach((s) => add(new THREE.BoxGeometry(dl, 0.22, 0.03), duvet, dcx, MATT_TOP - 0.08, s * (W / 2 + 0.02)));
  add(new THREE.BoxGeometry(0.03, 0.22, W + 0.07), duvet, L / 2 + 0.03 - 0.01, MATT_TOP - 0.08, 0);
  const fold = add(new THREE.CylinderGeometry(0.045, 0.045, W + 0.02, 16), linen, DUVET_X0 + 0.02, MATT_TOP + 0.05, 0);
  fold.rotation.x = Math.PI / 2;

  const blob = aoBlob(L / 2 + 0.15);
  blob.scale.y = W / L;
  group.add(blob);

  return group;
}
