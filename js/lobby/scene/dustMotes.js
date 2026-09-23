// 스포트라이트 빛줄기 속을 천천히 떠오르는 먼지 입자들 — 조명이 진짜
// 공간을 비추고 있다는 느낌을 값싸게 더해주는 장식.
export function buildDustMotes() {
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
