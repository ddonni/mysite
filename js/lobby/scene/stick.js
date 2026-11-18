// 두 점 a→b를 잇는 둥근 막대 — 벌어진 이젤 다리나 턴테이블 톤암처럼 축에 안
// 맞는 부재를 좌표 두 개만으로 세우려고 씀.
export function stick(a, b, radius, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, len, 8), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  return mesh;
}
