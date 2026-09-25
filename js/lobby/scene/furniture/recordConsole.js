import { drawDefaultAlbumArt } from '../../../shared/album.js';
import { aoBlob } from '../aoBlob.js';
import { canvasToTexture } from '../canvasTexture.js';
import { drawCover, paintRecordImage } from '../coverImage.js';
import { buildTurntable, DECK_W } from './turntable.js';

// 음악 기록을 나타내는 가구: 다리 달린 미드센추리 레코드 콘솔(LP 보관함) —
//   - 위: 턴테이블(turntable.js)과, 그 옆 작은 받침에 세운 "지금 재생 중"
//         앨범 재킷(LP 가진 사람들이 흔히 하는 진열).
//   - 왼쪽 칸: LP가 세로로 빽빽이 꽂혀 옆면(책등처럼)이 보임.
//   - 오른쪽 칸: LP 두 장이 앞을 보고 서 있어 표지가 보임.
// 칸 안쪽 높이는 LP 슬리브(SLEEVE)가 딱 들어가는 크기. 클릭하면 음악으로
// 감. 자리는 roomLayout.js가 잡음.

const LEG = 0.22, BODY_H = 0.78, W = 1.7, D = 0.72, T = 0.04;
const TOP_Y = LEG + BODY_H; // 콘솔 윗면 높이
const SLEEVE = 0.62;
const COMP_W = (W - T * 3) / 2; // 칸 하나의 안쪽 폭
const SPINE_T = 0.016;
const SPINE_SLOTS = Math.floor((COMP_W - 0.04) / (SPINE_T + 0.003));
const TEX = 192;
const SPINE_COLORS = [0x1d1a18, 0x33456b, 0x9c3f34, 0x2f4a45, 0xc79a4b, 0x5a3d24, 0xe6dccb, 0x6b3b5a];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 앨범 이미지가 없는 곡: 기본 앨범 아트 위에 제목을 얹음.
function drawAlbumFallback(ctx, w, h, title) {
  drawDefaultAlbumArt(ctx, w, h);
  ctx.fillStyle = 'rgba(243,236,224,0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.floor(w * 0.1)}px Manrope, 'Apple SD Gothic Neo', sans-serif`;
  ctx.fillText(title.length > 12 ? title.slice(0, 11) + '…' : title, w / 2, h * 0.16, w * 0.86);
}

// 표지가 보이게 세운 LP 슬리브 한 장 — 앞면에 앨범 표지, 나머지 면은 종이 색.
// 원점은 아래 가운데(기울일 때 아래 모서리가 축).
function makeCoverSleeve(paperMat) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX; canvas.height = TEX;
  const ctx = canvas.getContext('2d');
  const tex = canvasToTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(SLEEVE, SLEEVE, 0.012),
    [paperMat, paperMat, paperMat, paperMat, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), paperMat]
  );
  mesh.position.y = SLEEVE / 2;
  mesh.castShadow = true;
  const holder = new THREE.Group();
  holder.add(mesh);
  holder.visible = false;
  function paint(record) {
    paintRecordImage(ctx, record, {
      drawImage: (img) => { ctx.clearRect(0, 0, TEX, TEX); drawCover(ctx, img, 0, 0, TEX, TEX); },
      drawFallback: () => drawAlbumFallback(ctx, TEX, TEX, record.title || ''),
      onDone: () => { tex.needsUpdate = true; },
    });
  }
  return { holder, paint };
}

export function buildRecordConsole() {
  const group = new THREE.Group();
  group.userData.room = 'music';
  const walnut = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.6 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x3e2a1b, roughness: 0.8 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.35, metalness: 0.6 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xe6dccb, roughness: 0.9 });

  // 몸통: 천판/바닥판/양옆/가운데 칸막이/뒤판(안쪽은 한 톤 어둡게).
  const box = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return m;
  };
  box(W + 0.04, T, D + 0.02, 0, TOP_Y - T / 2, 0, walnut); // 천판(살짝 튀어나옴)
  box(W, T, D, 0, LEG + T / 2, 0, walnut); // 바닥판
  [-1, 1].forEach((s) => box(T, BODY_H, D, s * (W / 2 - T / 2), LEG + BODY_H / 2, 0, walnut));
  box(T, BODY_H - T * 2, D - 0.02, 0, LEG + BODY_H / 2, 0, walnut); // 가운데 칸막이
  box(W - T * 2, BODY_H - T * 2, 0.02, 0, LEG + BODY_H / 2, -D / 2 + 0.01, inner); // 뒤판

  // 비스듬히 벌어진 가는 다리 넷 + 끝의 황동 캡.
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.018, LEG + 0.02, 10), walnut);
    leg.position.set(sx * (W / 2 - 0.12), LEG / 2, sz * (D / 2 - 0.1));
    leg.rotation.set(sz * 0.12, 0, -sx * 0.12);
    leg.castShadow = true;
    group.add(leg);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), brass);
    cap.position.set(leg.position.x + sx * 0.012, 0.015, leg.position.z + sz * 0.012);
    group.add(cap);
  });

  const floorY = LEG + T; // 칸 바닥 높이
  const leftX0 = -W / 2 + T; // 왼쪽 칸 안쪽 왼쪽 끝
  const rightCx = T / 2 + COMP_W / 2; // 오른쪽 칸 가운데

  // 왼쪽 칸 — 세로로 꽂힌 LP들(옆면이 앞을 봄). 맨 끝 장은 살짝 기대게.
  let spines = [];
  function fillSpines(records) {
    spines.forEach((m) => group.remove(m));
    spines = [];
    records.slice(0, SPINE_SLOTS).forEach((rec, i) => {
      const col = SPINE_COLORS[hash(rec.title || String(i)) % SPINE_COLORS.length];
      const lp = new THREE.Mesh(new THREE.BoxGeometry(SPINE_T, SLEEVE, SLEEVE), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
      lp.position.set(leftX0 + 0.02 + i * (SPINE_T + 0.003) + SPINE_T / 2, floorY + SLEEVE / 2, 0.02);
      lp.castShadow = true;
      group.add(lp);
      spines.push(lp);
    });
    const last = spines[spines.length - 1];
    if (last && spines.length < SPINE_SLOTS) {
      last.rotation.z = -0.12;
      last.position.x += 0.035;
      last.position.y -= 0.01;
    }
  }

  // 오른쪽 칸 — 표지가 보이게 앞을 보고 선 두 장(뒤 장은 왼쪽으로 비껴서
  // 앞 장 옆으로 표지 한쪽이 보이게).
  const faceOut = [[-0.07, -0.1, -0.12], [0.07, 0.12, 0.04]].map(([x, z, yaw]) => {
    const s = makeCoverSleeve(paper);
    s.holder.position.set(rightCx + x, floorY, z);
    s.holder.rotation.set(-0.06, yaw, 0, 'YXZ');
    group.add(s.holder);
    return s;
  }).reverse(); // 채울 땐 앞 장부터

  // 위 — 턴테이블(왼쪽) + 지금 재생 중인 앨범 재킷을 세운 받침(오른쪽).
  const deck = buildTurntable();
  deck.position.set(-W / 2 + DECK_W / 2 + 0.12, TOP_Y, 0.0);
  group.add(deck);
  const stand = new THREE.Group();
  const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.14), brass);
  standBase.position.y = 0.01;
  stand.add(standBase);
  const standBack = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.02), brass);
  standBack.position.set(0, 0.14, -0.06);
  standBack.rotation.x = -0.22;
  stand.add(standBack);
  const nowPlaying = makeCoverSleeve(paper);
  nowPlaying.holder.position.set(0, 0.02, 0.02);
  nowPlaying.holder.rotation.x = -0.22;
  nowPlaying.holder.scale.setScalar(0.82);
  stand.add(nowPlaying.holder);
  stand.position.set(W / 2 - 0.38, TOP_Y, 0.02);
  group.add(stand);

  const blob = aoBlob(W / 2 + 0.1);
  blob.scale.y = 0.45;
  group.add(blob);

  group.userData.turntable = deck;
  group.userData.spin = deck.userData.spin;
  // 지금 재생할 곡: 턴테이블의 LP 라벨/이름표 + 받침의 앨범 재킷.
  group.userData.setNowPlaying = (song) => {
    deck.userData.setFeaturedSong(song || null);
    nowPlaying.holder.visible = !!song;
    if (song) nowPlaying.paint(song);
  };
  // 나머지 곡(최애음악 먼저·최신순): 앞 두 장은 오른쪽 칸에 표지가 보이게,
  // 그다음부터 왼쪽 칸에 세로로 꽂힘(칸이 차면 거기까지).
  group.userData.setAlbums = (records) => {
    const list = records || [];
    faceOut.forEach((s, i) => {
      const rec = list[i];
      s.holder.visible = !!rec;
      if (rec) s.paint(rec);
    });
    fillSpines(list.slice(faceOut.length));
  };

  return group;
}
