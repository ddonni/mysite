// 캔버스 2D로 그림을 그려서 THREE 텍스처로 만드는 공용 헬퍼.
// (이미지 파일 없이도 라벨 글자나 그라데이션 같은 걸 만들 수 있음)
// 이 방의 거의 모든 가구(책등, 액자, 냉장고 문, 공, 곰인형 털 …)가
// "그림 없이 캔버스로 텍스처를 직접 그린다"는 같은 트릭을 쓰기 때문에
// 별도 모듈로 뺌.
export function makeCanvasTexture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
