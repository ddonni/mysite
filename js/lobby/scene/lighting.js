// 조명 한 세트를 장면에 붙임: 은은한 반구 조명(hemi, 전체 밝기),
// 위에서 비추는 스포트라이트(그림자를 만듦 — "무대 조명" 느낌),
// 그리고 각 가구 옆에 그 방 색깔을 띤 포인트 라이트(방 색은 lobby.css의
// --ember/--gold/--rose/--crimson/--teal과 맞춤).
//
// 전체 조명은 일부러 약간 어둡고 중립적인 색으로 둠 — 따뜻한 빛은 구석의
// 플로어 스탠드(furniture/lamps.js)에서 나오게 해서, 방 전체가 한 가지
// 주황빛으로 뭉개지지 않고 램프 주변이 도드라지는 명암 대비가 생기게 함.
// main.js의 ACES 톤매핑과 짝을 이룬 값이라, 둘 중 하나를 바꾸면 같이 봐야 함.
// 가구별 포인트 조명 — [색, 세기, x, y, z]. 색으로 "이 가구가 무슨 기록인지"만
// 살짝 알려주는 정도라 세기는 낮게. 배치가 다르면(둥근 방 시안) 그 배치의
// 목록을 accents로 넘겨받음.
const RECT_ACCENTS = [
  [0xd9793a, 0.55, -0.6, 2.2, 2.4], // 이젤(캔버스)
  [0xc79a4b, 0.55, -2.9, 2.6, -3.0], // 책장
  [0xd97aa0, 0.5, -5.0, 2.4, -0.4], // 애니 진열장
  [0xc9564a, 0.5, 3.3, 2.6, -3.0], // 영화 포스터
  [0x4a9fc9, 0.5, 0.1, 1.7, -2.0], // 턴테이블
];

export function addLighting(scene, accents = RECT_ACCENTS) {
  const hemi = new THREE.HemisphereLight(0x3d3833, 0x0c0a08, 0.55);
  scene.add(hemi);

  // 방이 넓어서 높이·멀리 두고 원뿔도 넓혀, 뒷벽 양 끝(책장/포스터)과
  // 왼쪽 벽(진열장)까지 한 번에 비추게 함.
  const spot = new THREE.SpotLight(0xfff3e6, 2.6, 30, 1.05, 0.7, 1.1);
  spot.position.set(0.8, 8.2, 4.8);
  spot.target.position.set(-0.6, 0.3, -1.3);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 3;
  spot.shadow.camera.far = 20;
  scene.add(spot, spot.target);

  accents.forEach(([color, intensity, x, y, z]) => {
    const light = new THREE.PointLight(color, intensity, 12, 1.5);
    light.position.set(x, y, z);
    scene.add(light);
  });
}
