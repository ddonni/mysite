import { FLOOR_D } from '../roomDimensions.js';

const FRAME_TEX_W = 220, FRAME_TEX_H = 280; // 책/애니/영화 포스터에 흔한 세로형 비율

// 액자 캔버스에 그릴 기본 이미지 — 아직 인생작품이 정해지지
// 않았을(기록이 하나도 없을) 때 대신 보여주는 빈 액자 느낌의 아이콘.
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

// 벽에 거는 액자 하나. main.js가 setFeaturedWork로 책/애니/영화 기록
// 하나를 채워줌 — 없으면 아래 기본 아이콘 그대로 둠. x로 벽 위 위치를
// 잡음(왼쪽/가운데/오른쪽에 하나씩 걸 예정이라 위치를 파라미터로 뺌).
export function buildFrame(x) {
  const group = new THREE.Group();
  group.userData.room = 'library';

  const FRAME_W = 0.85, FRAME_H = 1.05, FRAME_D = 0.05;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2016, roughness: 0.7 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(FRAME_W, FRAME_H, FRAME_D), frameMat);
  frame.castShadow = true;
  group.add(frame);

  const artCanvas = document.createElement('canvas');
  artCanvas.width = FRAME_TEX_W; artCanvas.height = FRAME_TEX_H;
  const artCtx = artCanvas.getContext('2d');
  drawFrameArtDefault(artCtx, FRAME_TEX_W, FRAME_TEX_H);
  const artTex = new THREE.CanvasTexture(artCanvas);
  artTex.needsUpdate = true;
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(FRAME_W - 0.1, FRAME_H - 0.1),
    new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.85 })
  );
  art.position.z = FRAME_D / 2 + 0.002;
  group.add(art);

  group.position.set(x, 3.3, -FLOOR_D / 2 + FRAME_D / 2 + 0.09);

  // main.js가 라이브러리의 최근 책/애니/영화 기록을 받아온 뒤 이걸
  // 호출해서 액자를 실제 표지 이미지로 채워넣음. work가 없으면(기록이
  // 하나도 없으면) 기본 아이콘 그대로 둠.
  group.userData.setFeaturedWork = (work) => {
    const url = work && work.photo_url;
    if (!url) {
      drawFrameArtDefault(artCtx, FRAME_TEX_W, FRAME_TEX_H);
      artTex.needsUpdate = true;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        artCtx.clearRect(0, 0, FRAME_TEX_W, FRAME_TEX_H);
        // 커버 이미지 비율이 액자와 달라도 잘리지 않고 꽉 채워지도록
        // (object-fit: cover와 같은 계산) 중앙을 기준으로 크롭해서 그림.
        const scale = Math.max(FRAME_TEX_W / img.width, FRAME_TEX_H / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        artCtx.drawImage(img, (FRAME_TEX_W - dw) / 2, (FRAME_TEX_H - dh) / 2, dw, dh);
        // S3 버킷에 CORS 설정이 없는 이미지면 캔버스가 "오염"돼서 이
        // 텍스처를 GPU에 올리는 순간 에러가 남 — getImageData로 미리
        // 오염 여부를 확인해서, 문제가 있으면 기본 이미지로 대체함.
        artCtx.getImageData(0, 0, 1, 1);
        artTex.needsUpdate = true;
      } catch (e) {
        drawFrameArtDefault(artCtx, FRAME_TEX_W, FRAME_TEX_H);
        artTex.needsUpdate = true;
      }
    };
    img.onerror = () => { drawFrameArtDefault(artCtx, FRAME_TEX_W, FRAME_TEX_H); artTex.needsUpdate = true; };
    img.src = url;
  };

  return group;
}
