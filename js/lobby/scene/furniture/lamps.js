import { aoBlob } from '../aoBlob.js';

// 빛이 "어디서" 나오는지 눈에 보이게 해주는 장식 조명. 방 전체를 비추는
// 스포트라이트(lighting.js)만으로는 빛의 출처가 안 보여서 방이 밋밋해 보임 —
// 켜진 전등갓과 그 주변에 고인 따뜻한 빛이 있으면 명암 대비와 아늑함이 생김.
// 어느 방에도 속하지 않는 순수 장식이라 interactiveGroups엔 안 넣음.
//
// 전등갓은 emissive로 "켜진 램프"처럼 보이게 하고, 실제로 주변을 비추는 건
// 그 자리에 둔 PointLight. 포인트 라이트 그림자는 6방향 렌더라 비싸서 끔.

const WARM = 0xffd49a;

// 구석에 세우는 플로어 스탠드 — 천 전등갓이 은은하게 비쳐 보이고, 주변
// 벽과 바닥을 따뜻하게 물들임.
export function buildFloorLamp(x, z) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.5, metalness: 0.4 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 28), metal);
  base.position.y = 0.02;
  base.castShadow = true;
  group.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.55, 8), metal);
  pole.position.y = 0.8;
  pole.castShadow = true;
  group.add(pole);

  // 천 전등갓 — 안에서 불이 켜진 것처럼 살짝 비쳐 보이게 emissive로 밝힘.
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.28, 0.36, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf1e2c6, emissive: 0xffc98a, emissiveIntensity: 0.75, roughness: 0.9, side: THREE.DoubleSide })
  );
  shade.position.y = 1.62;
  group.add(shade);

  const light = new THREE.PointLight(WARM, 1.0, 5, 2);
  light.position.y = 1.55;
  group.add(light);

  group.add(aoBlob(0.35));
  group.position.set(x, 0, z);
  return group;
}
