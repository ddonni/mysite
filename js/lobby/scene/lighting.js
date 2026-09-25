// 조명 한 세트를 장면에 붙임: 은은한 반구 조명(hemi, 전체 밝기), 위에서
// 비추는 스포트라이트(그림자를 만듦 — "무대 조명" 느낌), 그리고
// roomLayout.js가 정해주는 포인트 조명들(lights) — 벽마다 벽을 고르게 밝히는
// 흰빛 하나와, 그 기록의 색(lobby.css의 --ember/--gold/--rose/--crimson/--teal)을
// 띤 은은한 빛 하나.
//
// 멀리서(첫 화면) 봐도 벽 가구와 인생작이 어둡게 묻히지 않을 만큼 전체를
// 밝히되, 색은 중립적으로 둬서 방 전체가 한 가지 주황빛으로 뭉개지지 않게 함.
// main.js의 ACES 톤매핑/노출값과 짝을 이룬 값이라, 둘 중 하나를 바꾸면 같이 봐야 함.
export function addLighting(scene, lights) {
  const hemi = new THREE.HemisphereLight(0x4a443d, 0x100d0a, 0.8);
  scene.add(hemi);

  // 둥근 방 앞쪽 높은 곳에서 방 가운데를 향해 — 원뿔을 넓혀 네 벽을 한 번에 비춤.
  const spot = new THREE.SpotLight(0xfff3e6, 3.2, 34, 1.1, 0.75, 1.0);
  spot.position.set(0, 9.2, 6.2);
  spot.target.position.set(0, 0.5, -2.2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 3;
  spot.shadow.camera.far = 24;
  scene.add(spot, spot.target);

  (lights || []).forEach(([color, intensity, x, y, z]) => {
    const light = new THREE.PointLight(color, intensity, 12, 1.5);
    light.position.set(x, y, z);
    scene.add(light);
  });
}
