import { drawDefaultAlbumArt } from '../../../shared/album.js';
import { canvasToTexture } from '../canvasTexture.js';
import { drawCover, paintRecordImage } from '../coverImage.js';
import { twoLineLabelSprite } from '../labelSprite.js';
import { stick } from '../stick.js';

// 턴테이블 본체(데크) — 레코드 콘솔(recordConsole.js) 위에 올라감. 원점은
// 데크 바닥(다리 밑면). 실제 턴테이블처럼:
//   - 나무 받침(플린스) + 짙은 윗판 + 작은 다리 넷
//   - 은색 금속 플래터 위에 홈이 파인 까만 LP, 가운데 라벨에 앨범 이미지
//     (없으면 기본 앨범 그림) + 가운데 축 — LP는 매 프레임 천천히 돎
//   - 톤암: 회전 받침, 뒤쪽 무게추, 판 위에 내려앉은 헤드셸, 암 받침대
//   - 시작/정지·33/45 버튼, 피치 슬라이더, 빨간 전원 불빛
//   - 뒤로 열어둔 투명 먼지 덮개
// 위에는 지금 걸린 곡의 제목/가수 이름표가 뜸. 크기는 옆에 놓이는 LP
// 슬리브(0.62)보다 판이 살짝 작게 — 실제 LP(31cm)와 플래터(30cm) 비율.

export const DECK_W = 0.9, DECK_D = 0.72;
const FEET = 0.03, PH = 0.1;
export const DECK_TOP = FEET + PH; // 플린스 윗면 높이
const RECORD_R = 0.3;
const PLATTER_C = new THREE.Vector3(-0.08, 0, 0.02); // 플래터 중심(윗면 기준 x/z)
const TEX = 512;

// 앨범 이미지가 없을 때 라벨에 쓸 기본 앨범 그림 — 한 번만 따로 그려둠.
let defaultLabel = null;
function defaultLabelImage() {
  if (!defaultLabel) {
    defaultLabel = document.createElement('canvas');
    defaultLabel.width = 256; defaultLabel.height = 256;
    drawDefaultAlbumArt(defaultLabel.getContext('2d'), 256, 256);
  }
  return defaultLabel;
}

// LP 윗면 텍스처: 까만 판에 촘촘한 홈(동심원), 곡 사이 빈 트랙, 가운데
// 라벨(앨범 이미지를 원형으로 — 없으면 기본 앨범 그림) + 축 구멍.
function drawRecord(ctx, img) {
  const c = TEX / 2;
  ctx.clearRect(0, 0, TEX, TEX);
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  for (let r = c * 0.36; r < c * 0.97; r += 2.2) {
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + ((r * 7) % 5) * 0.008})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
  }
  // 곡 사이 빈 트랙(조금 더 매끈해 보이는 띠) 두 줄.
  [0.55, 0.75].forEach((f) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c, c, c * f, 0, Math.PI * 2); ctx.stroke();
  });
  // 가운데 라벨.
  const lr = c * 0.33;
  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, lr, 0, Math.PI * 2); ctx.clip();
  drawCover(ctx, img || defaultLabelImage(), c - lr, c - lr, lr * 2, lr * 2);
  ctx.restore();
  ctx.fillStyle = '#d8d2c8';
  ctx.beginPath(); ctx.arc(c, c, c * 0.025, 0, Math.PI * 2); ctx.fill();
}

export function buildTurntable() {
  const group = new THREE.Group();
  group.userData.room = 'music';

  const walnut = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.5 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xc9c6c0, roughness: 0.3, metalness: 0.7 });

  // 받침 + 윗판 + 다리.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(DECK_W, PH, DECK_D), walnut);
  plinth.position.y = FEET + PH / 2;
  plinth.castShadow = true; plinth.receiveShadow = true;
  group.add(plinth);
  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(DECK_W - 0.02, 0.006, DECK_D - 0.02), black);
  topPlate.position.y = DECK_TOP + 0.003;
  topPlate.receiveShadow = true;
  group.add(topPlate);
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, FEET, 12), black);
    foot.position.set(sx * (DECK_W / 2 - 0.07), FEET / 2, sz * (DECK_D / 2 - 0.07));
    group.add(foot);
  });

  const top = DECK_TOP + 0.006;

  // 플래터(은색 테두리) + 그 위 LP(돎) + 축.
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(RECORD_R + 0.005, RECORD_R + 0.005, 0.03, 64), silver);
  platter.position.set(PLATTER_C.x, top + 0.015, PLATTER_C.z);
  platter.castShadow = true;
  group.add(platter);

  const recCanvas = document.createElement('canvas');
  recCanvas.width = TEX; recCanvas.height = TEX;
  const recCtx = recCanvas.getContext('2d');
  drawRecord(recCtx, null);
  const recTex = canvasToTexture(recCanvas);
  recTex.needsUpdate = true;
  const vinylSide = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  const record = new THREE.Mesh(
    new THREE.CylinderGeometry(RECORD_R, RECORD_R, 0.005, 64),
    // CylinderGeometry 재질 순서: [옆면, 윗면, 아랫면]
    [vinylSide, new THREE.MeshStandardMaterial({ map: recTex, roughness: 0.28, metalness: 0.15 }), vinylSide]
  );
  record.position.set(PLATTER_C.x, top + 0.033, PLATTER_C.z);
  group.add(record);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 10), silver);
  spindle.position.set(PLATTER_C.x, top + 0.045, PLATTER_C.z);
  group.add(spindle);

  // 톤암 — 오른쪽 뒤 회전 받침에서 판 바깥쪽 홈으로 비스듬히 내려앉음.
  const pivot = new THREE.Vector3(0.33, top, -0.22);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 20), silver);
  base.position.set(pivot.x, top + 0.025, pivot.z);
  group.add(base);
  const armY = top + 0.075;
  const head = new THREE.Vector3(PLATTER_C.x + 0.17, top + 0.045, PLATTER_C.z + 0.19);
  const armStart = new THREE.Vector3(pivot.x, armY, pivot.z);
  group.add(stick(armStart, head, 0.008, silver));
  const dir = new THREE.Vector3().subVectors(head, armStart).setY(0).normalize();
  // 무게추 — 받침 뒤쪽, 팔 연장선 위.
  const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.07, 16), black);
  weight.position.set(pivot.x - dir.x * 0.1, armY, pivot.z - dir.z * 0.1);
  weight.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  group.add(weight);
  // 헤드셸 — 팔 끝의 납작한 판(바늘 달린 부분).
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.07), black);
  shell.position.copy(head).add(new THREE.Vector3(dir.x * 0.02, -0.004, dir.z * 0.02));
  shell.rotation.y = Math.atan2(dir.x, dir.z) + 0.35;
  group.add(shell);
  // 암 받침대(팔을 쉬게 걸어두는 작은 기둥).
  const rest = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8), silver);
  rest.position.set(pivot.x + 0.02, top + 0.035, pivot.z + 0.2);
  group.add(rest);

  // 앞쪽 조작부 — 시작/정지, 33/45 버튼, 빨간 전원 불빛, 오른쪽 피치 슬라이더.
  const btn = (w, x, z, mat) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.05), mat);
    b.position.set(x, top + 0.006, z);
    group.add(b);
  };
  btn(0.1, -0.33, 0.3, silver); // 시작/정지
  btn(0.045, -0.2, 0.3, silver); // 33
  btn(0.045, -0.14, 0.3, silver); // 45
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b2f }));
  led.position.set(-0.4, top + 0.008, 0.22);
  group.add(led);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.22), new THREE.MeshStandardMaterial({ color: 0x050505 }));
  slot.position.set(0.38, top + 0.002, 0.13);
  group.add(slot);
  const slider = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.03), silver);
  slider.position.set(0.38, top + 0.01, 0.15);
  group.add(slider);

  // 투명 먼지 덮개 — 뒤쪽 경첩을 축으로 위로 열어둠.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, top + 0.01, -DECK_D / 2);
  lidPivot.rotation.x = -1.25;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(DECK_W, 0.11, DECK_D),
    new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false })
  );
  lid.position.set(0, 0.055, DECK_D / 2);
  lidPivot.add(lid);
  group.add(lidPivot);

  let label = null; // 곡이 있을 때만 제목/가수를 띄움 — 곡이 없으면 아무 글자도 없음

  // 로비가 음악 기록(대표곡 첫 번째, 없으면 가장 최근 곡)을 받아온 뒤 이걸
  // 호출해서 LP 라벨과 이름표를 실제 곡 정보로 채워넣음. song이 없으면(음악
  // 기록이 하나도 없으면) 이름표 없이 기본 LP 그대로 둠.
  group.userData.setFeaturedSong = (song) => {
    if (label) { group.remove(label); label = null; }
    if (!song) {
      drawRecord(recCtx, null);
      recTex.needsUpdate = true;
      return;
    }
    label = twoLineLabelSprite(`🎵 ${song.title}`, song.creator || '아티스트 미상');
    label.position.set(0, top + 1.0, 0); // 뒤로 열린 먼지 덮개(높이 ~0.7)보다 위
    group.add(label);
    paintRecordImage(recCtx, song, {
      drawImage: (img) => drawRecord(recCtx, img),
      drawFallback: () => drawRecord(recCtx, null),
      onDone: () => { recTex.needsUpdate = true; },
    });
  };

  // 매 프레임 LP를 천천히 돌림(33⅓ rpm보다 훨씬 느리게 — 눈이 편하게).
  group.userData.spin = (dt) => { record.rotation.y -= dt * 0.8; };

  return group;
}
