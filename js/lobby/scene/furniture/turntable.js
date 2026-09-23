import { drawDefaultAlbumArt } from '../../../shared/album.js';
import { aoBlob } from '../aoBlob.js';
import { twoLineLabelSprite } from '../labelSprite.js';

const PLATTER_TEX_SIZE = 256;

// 판(platter) 텍스처에 기본 앨범 이미지를 원형으로 잘라 그려넣음 — 실제
// 곡의 앨범 이미지가 없거나 아직 안 왔을 때 쓰는 상태.
function drawPlatterDefault(ctx) {
  ctx.clearRect(0, 0, PLATTER_TEX_SIZE, PLATTER_TEX_SIZE);
  ctx.save();
  ctx.beginPath();
  ctx.arc(PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  drawDefaultAlbumArt(ctx, PLATTER_TEX_SIZE, PLATTER_TEX_SIZE);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
}

// 음악 방을 나타내는 가구: 사이드 테이블 위의 턴테이블(계속 도는 LP +
// 톤암) + 대표곡 제목/가수 이름표. LP 위에 실제 앨범 이미지를 원형으로
// 감싸서 보여줌 — 없으면 기본 이미지로.
export function buildTurntable() {
  const group = new THREE.Group();
  group.userData.room = 'music';

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.75 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.7), woodMat);
  table.position.set(0, 0.275, 0);
  table.castShadow = true; table.receiveShadow = true;
  group.add(table);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 32), bodyMat);
  body.position.set(0, 0.585, 0);
  body.castShadow = true;
  group.add(body);

  const platterCanvas = document.createElement('canvas');
  platterCanvas.width = PLATTER_TEX_SIZE; platterCanvas.height = PLATTER_TEX_SIZE;
  const platterCtx = platterCanvas.getContext('2d');
  drawPlatterDefault(platterCtx);
  const platterTex = new THREE.CanvasTexture(platterCanvas);
  platterTex.needsUpdate = true;
  const platter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.015, 48),
    new THREE.MeshStandardMaterial({ map: platterTex, roughness: 0.5 })
  );
  platter.position.set(0, 0.625, 0);
  platter.castShadow = true;
  group.add(platter);

  // 톤암: 뒤쪽 모서리에 얹혀서 판 가장자리 쪽으로만 살짝 걸침 — 중앙
  // 이미지는 안 가림.
  const armMat = new THREE.MeshStandardMaterial({ color: 0x9c9086, roughness: 0.4, metalness: 0.3 });
  const armPivot = new THREE.Group();
  armPivot.position.set(0.34, 0.63, -0.28);
  armPivot.rotation.y = 0.5;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), armMat);
  arm.position.set(-0.19, 0, 0);
  arm.rotation.z = Math.PI / 2;
  armPivot.add(arm);
  const armHead = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.03), armMat);
  armHead.position.set(-0.38, 0, 0);
  armPivot.add(armHead);
  group.add(armPivot);

  group.add(aoBlob(0.85));
  let label = null; // 곡이 있을 때만 제목/가수를 띄움 — 곡이 없으면 아무 글자도 없음

  // 뒷벽을 꽉 채운 책장 앞으로 살짝 나와 서 있는 자리 — 책장이 뒷벽에
  // 바짝 붙어 있어서(z ≈ -3.06), 턴테이블은 그 앞으로 충분히 빼둬야
  // 책장을 가리지 않고 독립된 가구로 보임.
  group.position.set(-0.9, 0, -1.6);
  group.rotation.y = 0.2;

  // main.js가 라이브러리의 최근 음악 기록을 받아온 뒤 이걸 호출해서
  // LP와 이름표를 실제 곡 정보로 채워넣음. song이 없으면(음악 기록이
  // 하나도 없으면) 이름표 없이 기본 LP 그대로 둠.
  group.userData.setFeaturedSong = (song) => {
    if (label) { group.remove(label); label = null; }
    if (song) {
      label = twoLineLabelSprite(`🎵 ${song.title}`, song.creator || '아티스트 미상');
      label.position.set(0, 1.55, 0);
      group.add(label);
    }

    const url = song && song.photo_url;
    if (!url) {
      drawPlatterDefault(platterCtx);
      platterTex.needsUpdate = true;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        platterCtx.clearRect(0, 0, PLATTER_TEX_SIZE, PLATTER_TEX_SIZE);
        platterCtx.save();
        platterCtx.beginPath();
        platterCtx.arc(PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, PLATTER_TEX_SIZE / 2, 0, Math.PI * 2);
        platterCtx.clip();
        platterCtx.drawImage(img, 0, 0, PLATTER_TEX_SIZE, PLATTER_TEX_SIZE);
        platterCtx.restore();
        // S3 버킷에 CORS 설정이 없는 이미지면 캔버스가 "오염"돼서 이
        // 텍스처를 GPU에 올리는 순간 에러가 남 — getImageData로 미리
        // 오염 여부를 확인해서, 문제가 있으면 기본 이미지로 대체함.
        platterCtx.getImageData(0, 0, 1, 1);
        platterTex.needsUpdate = true;
      } catch (e) {
        drawPlatterDefault(platterCtx);
        platterTex.needsUpdate = true;
      }
    };
    img.onerror = () => { drawPlatterDefault(platterCtx); platterTex.needsUpdate = true; };
    img.src = url;
  };

  // 매 프레임 LP를 천천히 돌림.
  group.userData.spin = (dt) => { platter.rotation.y += dt * 0.6; };

  return group;
}
