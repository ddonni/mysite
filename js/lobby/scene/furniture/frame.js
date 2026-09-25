import { FEATURED_Y } from '../roomDimensions.js';
import { drawCover, drawTitleCard, paintRecordImage } from '../coverImage.js';
import { canvasToTexture } from '../canvasTexture.js';

// 액자 캔버스에 그릴 기본 이미지 — 이 자리에 걸 인생작이 없을(기록이
// 모자랄) 때 대신 보여주는 빈 액자 느낌의 아이콘.
function drawFrameArtDefault(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#3a2c1f');
  g.addColorStop(1, '#201d1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,253,250,0.3)';
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.34);
  ctx.lineTo(w * 0.28, h * 0.7);
  ctx.lineTo(w * 0.5, h * 0.62);
  ctx.lineTo(w * 0.72, h * 0.7);
  ctx.lineTo(w * 0.72, h * 0.34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.62);
  ctx.lineTo(w * 0.5, h * 0.28);
  ctx.stroke();
}

// 책장 위 벽에 거는 책 인생작 액자 하나(벽 기준 좌표 — x는 벽 가운데에서
// 옆 위치, 셋이 나란히 걸림). setFeaturedWork로 책 기록 하나를 채움: 사진이
// 있으면 표지로, 없으면 제목 카드로. 기록 자체가 없으면 기본 아이콘.
export function buildFrame(x) {
  const group = new THREE.Group();
  group.userData.room = 'book';

  const FRAME_W = 0.85, FRAME_H = 1.05, FRAME_D = 0.05;
  const TEX_W = 220, TEX_H = 280; // 책 표지에 흔한 세로형 비율

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2016, roughness: 0.7 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(FRAME_W, FRAME_H, FRAME_D), frameMat);
  frame.castShadow = true;
  group.add(frame);

  const artCanvas = document.createElement('canvas');
  artCanvas.width = TEX_W; artCanvas.height = TEX_H;
  const artCtx = artCanvas.getContext('2d');
  drawFrameArtDefault(artCtx, TEX_W, TEX_H);
  const artTex = canvasToTexture(artCanvas);
  artTex.needsUpdate = true;
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(FRAME_W - 0.1, FRAME_H - 0.1),
    new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.85 })
  );
  art.position.z = FRAME_D / 2 + 0.002;
  group.add(art);

  group.position.set(x, FEATURED_Y, FRAME_D / 2 + 0.09);

  group.userData.setFeaturedWork = (work) => {
    if (!work) {
      drawFrameArtDefault(artCtx, TEX_W, TEX_H);
      artTex.needsUpdate = true;
      return;
    }
    paintRecordImage(artCtx, work, {
      drawImage: (img) => {
        artCtx.clearRect(0, 0, TEX_W, TEX_H);
        drawCover(artCtx, img, 0, 0, TEX_W, TEX_H);
      },
      drawFallback: () => drawTitleCard(artCtx, 0, 0, TEX_W, TEX_H, work.title),
      onDone: () => { artTex.needsUpdate = true; },
    });
  };

  return group;
}
