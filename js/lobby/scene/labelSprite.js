import { makeCanvasTexture } from './canvasTexture.js';

// 턴테이블 위에 떠서 대표곡의 제목/가수를 보여주는 두 줄짜리 라벨 —
// 배경/테두리 없이 글자만. Sprite라서 카메라가 어느 각도에 있든 항상
// 정면으로 보임. 그림자를 살짝 넣어 배경 없이도 글자가 눈에 띄게 함.
export function twoLineLabelSprite(line1, line2) {
  const tex = makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f3ece0';
    ctx.font = '600 38px Manrope, sans-serif';
    ctx.fillText(line1, w / 2, h * 0.38);
    ctx.fillStyle = 'rgba(243,236,224,0.75)';
    ctx.font = '500 28px Manrope, sans-serif';
    ctx.fillText(line2, w / 2, h * 0.72);
  }, 560, 200);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.1, 0.75, 1);
  return sprite;
}
