// 캔버스 2D로 그림을 그려서 THREE 텍스처로 만드는 공용 헬퍼.
// (이미지 파일 없이도 라벨 글자나 그라데이션 같은 걸 만들 수 있음)
// 이 방의 거의 모든 가구(책등, 액자, 포스터, 스탠드, 공, 곰인형 털 …)가
// "그림 없이 캔버스로 텍스처를 직접 그린다"는 같은 트릭을 쓰기 때문에
// 별도 모듈로 뺌.

// 캔버스를 텍스처로 감쌀 때는 항상 이걸 씀 — 캔버스에 그린 색(과 올린
// 사진)은 sRGB라서 그렇게 표시해둬야 main.js의 ACES 톤매핑을 거쳐도 원래
// 색 그대로 나옴. 표시가 없으면 선형 색으로 취급돼 사진이 허옇게 바래 보임.
export function canvasToTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCanvasTexture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = canvasToTexture(c);
  tex.needsUpdate = true;
  return tex;
}
