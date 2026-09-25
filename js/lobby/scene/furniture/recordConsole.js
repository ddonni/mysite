import { drawDefaultAlbumArt } from '../../../shared/album.js';
import { aoBlob } from '../aoBlob.js';
import { canvasToTexture } from '../canvasTexture.js';
import { drawCover, paintRecordImage } from '../coverImage.js';
import { buildTurntable, DECK_W } from './turntable.js';

// 음악 기록을 나타내는 가구: 다리 달린 미드센추리 레코드 콘솔(LP 보관함) —
//   - 위(최애음악 자리): 턴테이블(turntable.js)에서 첫 번째 최애음악이 돌고,
//         그 옆 황동 받침 둘에 나머지 최애음악 재킷이 세워짐(LP 가진
//         사람들이 흔히 하는 진열).
//   - 칸 안(왼쪽 → 오른쪽): 그 밖의 곡이 LP처럼 세로로 빽빽이 꽂혀 옆면만
//         보임 — 표지·제목 없이 곡이 쌓이는 것만 보여줌.
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
  const compX0 = [-W / 2 + T, T / 2]; // 왼쪽/오른쪽 칸 안쪽 왼쪽 끝

  // 칸 안 — 곡마다 LP 한 장이 세로로 꽂혀 옆면만 보임(표지·제목 없이 "쌓이는"
  // 것만). 왼쪽 칸부터 채우고, 차면 오른쪽 칸으로. 전부 반듯하게 섬.
  let spines = [];
  function fillSpines(records) {
    spines.forEach((m) => group.remove(m));
    spines = [];
    records.slice(0, SPINE_SLOTS * compX0.length).forEach((rec, i) => {
      const comp = Math.floor(i / SPINE_SLOTS), k = i % SPINE_SLOTS;
      const col = SPINE_COLORS[hash(rec.title || String(i)) % SPINE_COLORS.length];
      const lp = new THREE.Mesh(new THREE.BoxGeometry(SPINE_T, SLEEVE, SLEEVE), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
      lp.position.set(compX0[comp] + 0.02 + k * (SPINE_T + 0.003) + SPINE_T / 2, floorY + SLEEVE / 2, 0.02);
      lp.castShadow = true;
      group.add(lp);
      spines.push(lp);
    });
  }

  // 위 — 턴테이블(왼쪽) + 나머지 최애음악 재킷 2장을 세운 황동 받침(오른쪽).
  // 받침 둘은 앞뒤로 엇갈려 서서, 앞 재킷 뒤로 뒤 재킷이 반쯤 보임. 최애음악이
  // 모자라면 재킷 없이 빈 받침만 남음("여기 더 올릴 수 있다"는 표시).
  const deck = buildTurntable();
  deck.position.set(-W / 2 + DECK_W / 2 + 0.12, TOP_Y, 0.0);
  group.add(deck);
  const JACKET = 0.7; // 받침 위 재킷 크기(칸 속 슬리브 대비)
  const picks = [[W / 2 - 0.23, -0.14, -0.18], [W / 2 - 0.43, 0.13, -0.26]].map(([x, z, lean]) => {
    const stand = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.12), brass);
    base.position.y = 0.01;
    stand.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.02), brass);
    back.position.set(0, 0.12, -0.05);
    back.rotation.x = lean;
    stand.add(back);
    const s = makeCoverSleeve(paper);
    s.holder.position.set(0, 0.02, 0.02);
    s.holder.rotation.x = lean;
    s.holder.scale.setScalar(JACKET);
    stand.add(s.holder);
    stand.position.set(x, TOP_Y, z);
    group.add(stand);
    return s;
  }).reverse(); // 채울 땐 앞 받침부터

  const blob = aoBlob(W / 2 + 0.1);
  blob.scale.y = 0.45;
  group.add(blob);

  group.userData.turntable = deck;
  group.userData.spin = deck.userData.spin;
  // 턴테이블에서 돌 곡: LP 라벨(앨범 이미지) + 위에 뜨는 제목/가수 이름표.
  group.userData.setNowPlaying = (song) => {
    deck.userData.setFeaturedSong(song || null);
  };
  // 턴테이블 옆 받침에 세울 나머지 최애음악(최대 2장).
  group.userData.setPicks = (songs) => {
    picks.forEach((s, i) => {
      const song = (songs || [])[i];
      s.holder.visible = !!song;
      if (song) s.paint(song);
    });
  };
  // 콘솔 칸 안에 넣을 그 밖의 곡(최신순) — 두 칸이 차면 거기까지.
  group.userData.setAlbums = (records) => fillSpines(records || []);

  return group;
}
