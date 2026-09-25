import { LEFT_WALL_X } from '../roomDimensions.js';
import { aoBlob } from '../aoBlob.js';
import { drawCover, drawTitleCard, paintRecordImage } from '../coverImage.js';
import { canvasToTexture } from '../canvasTexture.js';

// 애니 기록을 나타내는 가구: 왼쪽 벽에 붙인 나무 유리 진열장 — 뒷벽 책장과
// 같은 크기(CW × CH)·같은 나무색으로, 짜임새도 책장과 맞춤:
//   안:  세 칸에 나머지 애니가 작은 아크릴 스탠드로 칸당 PER_SHELF개씩 섬.
//   위:  진열장 천판 위에 책장 위 액자만 한 큰 스탠드 3개(대표작 — 가운데가
//        첫 번째). 대표작이 없는 자리엔 빈 아크릴판만 서 있음.
// 스탠드 = 기록의 사진이 투명 아크릴판에 인쇄된 모양(사진이 없으면 제목 카드).
//
// 다른 가구처럼 로컬 +z를 "정면"으로 짓고, 왼쪽 벽은 +x쪽으로 열려
// 있으므로 그룹 전체를 90도 돌려 정면이 방 안쪽(+x)을 보게 함.

export const CASE_W = 5.6; // bookshelf.js의 BOOKSHELF_W와 맞춤
const CW = CASE_W, CH = 2.5, CD = 0.5;
const SHELF_YS = [0.1, 0.9, 1.7]; // 아래칸/가운데칸/윗칸 바닥 높이
const PER_SHELF = 12;
export const SMALL_STAND_SLOTS = PER_SHELF * SHELF_YS.length;
const DOORS = 4; // 앞 유리문 칸 수(문틀 세로선 DOORS-1개)

const BIG = { w: 0.8, h: 1.02, texW: 208, texH: 266 }; // frame.js의 액자(0.85×1.05)와 비슷한 크기
const SMALL = { w: 0.34, h: 0.46, texW: 112, texH: 152 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeStand(size, acrylicMat) {
  const canvas = document.createElement('canvas');
  canvas.width = size.texW; canvas.height = size.texH;
  const ctx = canvas.getContext('2d');
  const tex = canvasToTexture(canvas);
  const inset = size.texW * 0.06, radius = size.texW * 0.08;

  const group = new THREE.Group();
  // 인쇄면은 조명 영향을 덜 받게 Basic으로 — 진열장 안이 그늘져도 진열
  // 조명을 받은 것처럼 또렷하게 보이게 함. 바깥 투명 부분은 alphaTest로
  // 잘라서 정렬 문제 없는 불투명 패스로 그림.
  const print = new THREE.Mesh(
    new THREE.PlaneGeometry(size.w, size.h),
    new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })
  );
  print.position.y = size.h / 2 + 0.03;
  group.add(print);

  const board = new THREE.Mesh(new THREE.BoxGeometry(size.w + 0.02, size.h + 0.02, 0.012), acrylicMat);
  board.position.set(0, print.position.y, -0.008);
  group.add(board);
  const base = new THREE.Mesh(new THREE.BoxGeometry(size.w * 0.7, 0.025, size.w * 0.35), acrylicMat);
  base.position.y = 0.0125;
  group.add(base);

  // 빈 자리(대표작 없음) — 인쇄 없이 점선 테두리만 있는 빈 아크릴판.
  function paintEmpty() {
    ctx.clearRect(0, 0, size.texW, size.texH);
    ctx.save();
    ctx.strokeStyle = 'rgba(251,248,242,0.85)';
    ctx.lineWidth = Math.max(2, size.texW * 0.015);
    ctx.setLineDash([size.texW * 0.05, size.texW * 0.04]);
    roundRect(ctx, inset, inset, size.texW - inset * 2, size.texH - inset * 2, radius);
    ctx.stroke();
    ctx.restore();
    tex.needsUpdate = true;
  }

  function paint(record) {
    if (!record) { paintEmpty(); return; }
    const clipAndDraw = (draw) => {
      ctx.clearRect(0, 0, size.texW, size.texH);
      ctx.save();
      roundRect(ctx, 0, 0, size.texW, size.texH, radius);
      ctx.fillStyle = '#fbf8f2';
      ctx.fill();
      roundRect(ctx, inset, inset, size.texW - inset * 2, size.texH - inset * 2, radius * 0.6);
      ctx.clip();
      draw(inset, inset, size.texW - inset * 2, size.texH - inset * 2);
      ctx.restore();
    };
    paintRecordImage(ctx, record, {
      drawImage: (img) => clipAndDraw((x, y, w, h) => drawCover(ctx, img, x, y, w, h)),
      drawFallback: () => clipAndDraw((x, y, w, h) => drawTitleCard(ctx, x, y, w, h, record.title, 'rgba(217,122,160,0.9)')),
      onDone: () => { tex.needsUpdate = true; },
    });
  }
  return { group, paint };
}

// z: 진열장 가운데가 왼쪽 벽 위 어디에 올지(scene.js가 정함).
export function buildDisplayCase(z) {
  const cabinet = new THREE.Group();
  cabinet.userData.room = 'anime';

  // 책장(bookshelf.js)과 같은 나무색으로 맞춰서, 방 안의 수납 가구가 한
  // 세트처럼 보이게 함. 뒤판은 그보다 한 톤 어둡게 해서 스탠드가 도드라짐.
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.75 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x221a13, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xdfeef5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false,
  });
  // 재질은 모듈 최상단이 아니라 여기서 만듦 — THREE가 없는 브라우저에서도
  // 이 모듈을 import하는 것만으로는 깨지지 않아야 main.js의 no-3d 폴백이 뜸.
  const acrylicMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false,
  });

  const back = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, 0.03), backMat);
  back.position.set(0, CH / 2, -CD / 2 + 0.015);
  cabinet.add(back);

  // 나무 프레임: 양옆 기둥 + 바닥판/천판 + 앞쪽 문틀(문 사이 세로선).
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, CH, CD), frameMat);
    post.position.set(side * (CW / 2 - 0.025), CH / 2, 0);
    post.castShadow = true;
    cabinet.add(post);
  });
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(CW, 0.1, CD), frameMat);
  bottom.position.set(0, 0.05, 0);
  bottom.receiveShadow = true;
  cabinet.add(bottom);
  const top = new THREE.Mesh(new THREE.BoxGeometry(CW, 0.06, CD), frameMat);
  top.position.set(0, CH - 0.03, 0);
  top.castShadow = true; top.receiveShadow = true;
  cabinet.add(top);
  for (let d = 1; d < DOORS; d++) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.03, CH, 0.03), frameMat);
    mullion.position.set(-CW / 2 + (d * CW) / DOORS, CH / 2, CD / 2 - 0.015);
    cabinet.add(mullion);
  }

  // 유리 선반(가운데칸/윗칸 바닥) — 가장자리만 살짝 보이는 얇은 유리.
  SHELF_YS.slice(1).forEach((y) => {
    const glassShelf = new THREE.Mesh(new THREE.BoxGeometry(CW - 0.1, 0.015, CD - 0.06), glassMat);
    glassShelf.position.set(0, y, 0);
    cabinet.add(glassShelf);
  });

  // 천판 밑의 LED 바 — 진열장 안쪽이 불 켜진 쇼케이스처럼 보이게 하는 장식.
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(CW - 0.12, 0.012, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xfff3e2 })
  );
  led.position.set(0, CH - 0.07, CD / 2 - 0.06);
  cabinet.add(led);

  // 앞 유리문 — 클릭 판정도 이 유리가 받아서, 진열장 어디를 눌러도 애니 방으로 감.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.1, CH - 0.12), glassMat);
  glass.position.set(0, CH / 2, CD / 2 - 0.005);
  cabinet.add(glass);

  // 천판 위 대표작 스탠드 — 책장 위 액자(scene.js의 frame 간격 1.8)와 같은 간격.
  const bigs = [-1, 0, 1].map((i) => {
    const s = makeStand(BIG, acrylicMat);
    s.group.position.set(i * 1.8, CH, 0);
    s.paint(null);
    cabinet.add(s.group);
    return s;
  });

  // 안쪽 스탠드 — 윗칸 왼쪽부터 채움.
  const smalls = [];
  const pitch = (CW - 0.3) / PER_SHELF;
  [...SHELF_YS].reverse().forEach((y) => {
    for (let k = 0; k < PER_SHELF; k++) {
      const s = makeStand(SMALL, acrylicMat);
      s.group.position.set(-CW / 2 + 0.15 + (k + 0.5) * pitch, y + 0.02, -0.02);
      s.group.visible = false;
      cabinet.add(s.group);
      smalls.push(s);
    }
  });

  // 그림자 원을 앞뒤로 눌러서, 길쭉한 진열장 앞 바닥에만 얇게 깔리게 함
  // (aoBlob은 -90° 눕혀져 있어 로컬 y가 앞뒤 방향).
  const blob = aoBlob(CW / 2);
  blob.scale.y = 0.25;
  cabinet.add(blob);

  cabinet.position.set(LEFT_WALL_X + CD / 2 + 0.08, 0, z);
  cabinet.rotation.y = Math.PI / 2;

  // loadRoomIntoScene.js가 애니 기록을 골라서 넘겨줌: top은 대표작 최대
  // 3개(첫 번째가 가운데), rest는 나머지(최신순) — 안쪽 칸 수만큼만 섬.
  cabinet.userData.setAnime = ({ top, rest }) => {
    [top[1], top[0], top[2]].forEach((rec, i) => bigs[i].paint(rec || null));
    smalls.forEach((s, i) => {
      const rec = rest[i];
      s.group.visible = !!rec;
      if (rec) s.paint(rec);
    });
  };

  return cabinet;
}
