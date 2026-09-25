import { canvasToTexture } from './canvasTexture.js';

// 가구 위 벽에 칠한 큰 글씨(BOOK / MOVIE / ANIMATION) — 처음 온 사람도
// 각 벽이 무슨 기록인지 한눈에 알 수 있게 함. 로비 헤더와 같은 Fraunces
// 세리프 대문자 + 아래에 가는 밑줄. 벽에 칠한 페인트처럼 보이도록
// 조명을 받는 MeshStandardMaterial로 그리고, 글자 바깥은 투명.
//
// 캔버스 글꼴은 웹폰트가 로드되기 전에 그리면 기본 글꼴로 나와버려서,
// 먼저 한 번 그려두고 Fraunces가 준비되면 다시 그림.

const TEX_W = 1024, TEX_H = 192;
const LABEL_H = 0.46; // 벽 위 글씨 높이(3D 단위) — 폭은 캔버스 비율대로

function draw(ctx, text, color) {
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "600 118px Fraunces, Georgia, serif";
  if ('letterSpacing' in ctx) ctx.letterSpacing = '14px';
  ctx.fillText(text, TEX_W / 2, TEX_H * 0.44);
  const w = Math.min(TEX_W * 0.9, ctx.measureText(text).width);
  ctx.fillRect((TEX_W - w * 0.35) / 2, TEX_H * 0.86, w * 0.35, 5);
}

// room: 클릭하면 그 가구로 카메라가 가도록 controls.js가 읽는 방 이름.
export function buildWallLabel(text, color, room) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W; canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');
  draw(ctx, text, color);
  const tex = canvasToTexture(canvas);
  tex.needsUpdate = true;

  if (document.fonts && document.fonts.load) {
    document.fonts.load("600 118px Fraunces").then(() => {
      draw(ctx, text, color);
      tex.needsUpdate = true;
    }).catch(() => {});
  }

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(LABEL_H * (TEX_W / TEX_H), LABEL_H),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, depthWrite: false })
  );
  mesh.userData.room = room;
  return mesh;
}
