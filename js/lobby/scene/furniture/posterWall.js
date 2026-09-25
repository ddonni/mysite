import { FEATURED_Y, FEATURED_GAP } from '../roomDimensions.js';
import { drawCover, drawTitleCard, paintRecordImage } from '../coverImage.js';
import { canvasToTexture } from '../canvasTexture.js';

// 영화 기록을 나타내는 가구: 영화 벽면의 포스터들(벽 기준 좌표로 지음 —
// roomLayout.js가 벽에 담). 옆 벽의 책장과 같은 짜임새로 —
//   아래: 책장과 같은 크기(GRID_W × GRID_H) 영역을 보이지 않는 칸으로 나눠,
//         칸마다 나머지 영화가 작은 포스터로 한 장씩 가지런히 붙음(칸을
//         그린 선은 없음 — 시선을 뺏어서 뺐음).
//   위:   책장 위 액자와 같은 크기·높이의 대표작 포스터 3장(가운데가 첫 번째).
// 사진이 없는 영화는 제목 카드로 붙음.

export const GRID_W = 5.6, GRID_H = 2.4; // bookshelf.js의 BOOKSHELF_W/높이와 맞춤
const COLS = 7, ROWS = 3;
export const SMALL_POSTER_SLOTS = COLS * ROWS;
const GRID_BOTTOM = 0.2;
const CELL_W = GRID_W / COLS, CELL_H = GRID_H / ROWS;

const BIG = { w: 0.85, h: 1.18, texW: 220, texH: 306 }; // frame.js의 액자(0.85×1.05)와 비슷한 크기
const SMALL = { w: 0.54, h: 0.7, texW: 128, texH: 166 };

// 아직 붙일 영화가 없는 대표작 자리 — 비어 있는 게 아니라 "여기 포스터
// 붙을 자리"로 읽히게, 필름 구멍 무늬만 있는 흐린 빈 포스터를 둠.
function drawEmptyPoster(ctx, w, h) {
  ctx.fillStyle = '#2a2320';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(243,236,224,0.12)';
  const hole = w * 0.06;
  for (let y = hole; y < h - hole; y += hole * 2) {
    ctx.fillRect(hole * 0.6, y, hole, hole * 0.9);
    ctx.fillRect(w - hole * 1.6, y, hole, hole * 0.9);
  }
  ctx.strokeStyle = 'rgba(243,236,224,0.22)';
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.strokeRect(w * 0.3, h * 0.38, w * 0.4, h * 0.24);
}

// 포스터 윗모서리 두 곳에 붙이는 반투명 마스킹 테이프 조각.
function addTape(poster, w, h, tapeMat) {
  [-1, 1].forEach((side) => {
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.28, w * 0.09), tapeMat);
    tape.position.set(side * (w / 2 - w * 0.06), h / 2 - w * 0.02, 0.003);
    tape.rotation.z = side * -0.55;
    poster.add(tape);
  });
}

function makePoster(size, seed, tapeMat, tilt) {
  const canvas = document.createElement('canvas');
  canvas.width = size.texW; canvas.height = size.texH;
  const ctx = canvas.getContext('2d');
  const tex = canvasToTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size.w, size.h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
  );
  mesh.receiveShadow = true;
  // 자로 잰 듯 반듯하면 인쇄물 벽지처럼 보여서, 자리마다 항상 같은
  // 만큼(seed 기반 — 새로고침해도 안 바뀜) 살짝 삐뚤게 붙임.
  mesh.rotation.z = Math.sin(seed * 12.9898) * tilt;
  addTape(mesh, size.w, size.h, tapeMat);

  function paint(record) {
    if (!record) {
      drawEmptyPoster(ctx, size.texW, size.texH);
      tex.needsUpdate = true;
      return;
    }
    paintRecordImage(ctx, record, {
      drawImage: (img) => {
        ctx.clearRect(0, 0, size.texW, size.texH);
        drawCover(ctx, img, 0, 0, size.texW, size.texH);
      },
      drawFallback: () => drawTitleCard(ctx, 0, 0, size.texW, size.texH, record.title, 'rgba(201,86,74,0.9)'),
      onDone: () => { tex.needsUpdate = true; },
    });
  }
  return { mesh, paint };
}

export function buildPosterWall() {
  const group = new THREE.Group();
  group.userData.room = 'movie';
  // 재질은 모듈 최상단이 아니라 여기서 만듦 — THREE가 없는 브라우저에서도
  // 이 모듈을 import하는 것만으로는 깨지지 않아야 main.js의 no-3d 폴백이 뜸.
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.9, transparent: true, opacity: 0.85 });

  // 대표작 포스터 — 책장 위 액자(frame.js)와 같은 x 간격·높이.
  const bigs = [-1, 0, 1].map((i, k) => {
    const p = makePoster(BIG, k + 1, tapeMat, 0.03);
    p.mesh.position.set(i * FEATURED_GAP, FEATURED_Y, 0.012);
    group.add(p.mesh);
    p.paint(null);
    return p;
  });

  // 칸마다 작은 포스터 — 위 줄 왼쪽부터 채움.
  const smalls = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      const p = makePoster(SMALL, smalls.length + 7, tapeMat, 0.04);
      p.mesh.position.set(-GRID_W / 2 + (c + 0.5) * CELL_W, GRID_BOTTOM + (r + 0.5) * CELL_H, 0.012);
      p.mesh.visible = false; // 채울 영화가 있을 때만 보임
      group.add(p.mesh);
      smalls.push(p);
    }
  }

  group.position.set(0, 0, 0.07); // 벽에 바짝 붙임

  // loadRoomIntoScene.js가 영화 기록을 골라서 넘겨줌: top은 대표작 최대 3개
  // (첫 번째가 가운데), rest는 나머지(최신순) — 칸 수만큼만 붙음.
  group.userData.setMovies = ({ top, rest }) => {
    [top[1], top[0], top[2]].forEach((rec, i) => bigs[i].paint(rec || null));
    smalls.forEach((p, i) => {
      const rec = rest[i];
      p.mesh.visible = !!rec;
      if (rec) p.paint(rec);
    });
  };

  return group;
}
