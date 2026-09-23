// 조명 한 세트를 장면에 붙임: 은은한 반구 조명(hemi, 전체 밝기),
// 위에서 비추는 스포트라이트(그림자를 만듦 — "무대 조명" 느낌),
// 그리고 각 가구 옆에 그 방 색깔을 띤 포인트 라이트.
export function addLighting(scene) {
  const hemi = new THREE.HemisphereLight(0x3a2c1e, 0x0a0806, 0.45);
  scene.add(hemi);

  const spot = new THREE.SpotLight(0xfff1de, 2.7, 22, 0.95, 0.6, 1.1);
  spot.position.set(0.5, 6.4, 3.2);
  spot.target.position.set(-0.4, 0.3, -0.8);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 2;
  spot.shadow.camera.far = 14;
  scene.add(spot, spot.target);

  // distance를 방 대각선 길이(~11)보다 넉넉히 키우고 decay를 낮춰서,
  // 각 가구 옆 불빛이 그 자리에만 고이지 않고 방 전체로 은은하게 퍼지게 함.
  const emberLight = new THREE.PointLight(0xd9793a, 0.9, 13, 1.4);
  emberLight.position.set(-2.6, 1.9, 0.2);
  scene.add(emberLight);

  const goldLight = new THREE.PointLight(0xc79a4b, 0.85, 13, 1.4);
  goldLight.position.set(1.9, 2.4, -1.9);
  scene.add(goldLight);

  const tealLight = new THREE.PointLight(0x4a9fc9, 0.75, 13, 1.4);
  tealLight.position.set(-0.9, 1.7, -2.4);
  scene.add(tealLight);
}
