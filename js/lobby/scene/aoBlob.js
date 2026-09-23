import { makeCanvasTexture } from './canvasTexture.js';

// 가구 아래에 깔아서 "그림자가 살짝 진 느낌"을 흉내 내는 원형 그라데이션
// (진짜 앰비언트 오클루전 계산을 하는 대신 쓰는 값싼 트릭). 바닥에 서는
// 가구(이젤, 책장, 냉장고, 턴테이블, 곰인형 …)가 다 이걸 하나씩 깔고 씀.
export function aoBlob(radius) {
  const tex = makeCanvasTexture((ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, 256, 256);
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}
