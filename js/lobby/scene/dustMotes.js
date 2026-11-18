import { APOTHEM } from './roomDimensions.js';

// 스포트라이트 빛줄기 속을 천천히 떠오르는 먼지 입자들 — 조명이 진짜
// 공간을 비추고 있다는 느낌을 값싸게 더해주는 장식. 둥근 방 안쪽(벽 가구
// 앞)에 고르게 퍼뜨림.
export function buildDustMotes() {
  const count = 80;
  const positions = new Float32Array(count * 3);
  const maxR = APOTHEM - 1.5;
  for (let m = 0; m < count; m++) {
    const r = Math.sqrt(Math.random()) * maxR; // 원 안에 고르게
    const a = Math.random() * Math.PI * 2;
    positions[m * 3] = Math.cos(a) * r;
    positions[m * 3 + 1] = 0.3 + Math.random() * 3.4;
    positions[m * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xf3ece0, size: 0.02, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
}
