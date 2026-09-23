import { FLOOR_D } from '../roomDimensions.js';
import { makeCanvasTexture } from '../canvasTexture.js';
import { aoBlob } from '../aoBlob.js';

const BOOK_COLORS = [0x8a3a2e, 0xc79a4b, 0x2f4a45, 0x5a3d24, 0x9c5b3c, 0x38343a, 0xb0673f];

// 문자열마다 항상 같은 값이 나오는 간단한 해시 — 책 제목을 색으로
// 바꿀 때 씀. 매번 랜덤이면 새로고침할 때마다 같은 책이 다른 색으로
// 보여서 "진짜 내 목록"이라는 느낌이 안 남 — 제목이 같으면 색도 항상
// 같아야 함.
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 책등(스파인) 텍스처 — 실제 제목을 담아서 색 상자만 쭉 늘어선
// 심심한 모습을 깨줌. 책등은 세로로 긴 모양이라, 실제 책처럼 아래에서
// 위로 읽히도록 글자를 90도 돌려서 씀.
function drawBookSpine(ctx, w, h, colorHex, title) {
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(243,236,224,0.16)';
  ctx.fillRect(0, h * 0.07, w, h * 0.05);
  ctx.fillRect(0, h * 0.88, w, h * 0.05);

  const label = title.length > 16 ? title.slice(0, 15) + '…' : title;
  ctx.fillStyle = 'rgba(243,236,224,0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.floor(w * 0.6)}px Manrope, sans-serif`;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(label, 0, 0, h * 0.82);
  ctx.restore();
}

// 기록 보관소 방을 나타내는 가구: 뒷벽을 꽉 채우는 책장. 칸에 꽂히는
// 책은 shelf.userData.setBooks(titles)로 실제 기록 제목 목록을 받아
// 그 개수만큼만 꽂아 넣음 — 기록이 늘어나면 책장도 자연스럽게 채워짐.
// 기록이 0개면 빈 책장 그대로이고, 아직 못 받아왔을 때(로드 전/실패)도
// 빈 채로 시작함 — 예전엔 무작위 책으로 채워뒀다가 기록이 없는 방도 꽉 차
// 보이는 문제가 있었음.
export function buildBookshelf() {
  const shelf = new THREE.Group();
  shelf.userData.room = 'library';
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.75 });
  const SW = 8.2, SH = 2.5, SD = 0.36; // SW: 뒷벽(FLOOR_W=9) 양쪽에 0.4씩만 남기고 꽉 채움

  const back = new THREE.Mesh(new THREE.BoxGeometry(SW, SH, 0.04), caseMat);
  back.position.set(0, SH / 2, -SD / 2);
  shelf.add(back);
  [-SW / 2, SW / 2].forEach((x) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, SH, SD), caseMat);
    side.position.set(x, SH / 2, 0);
    side.castShadow = true;
    shelf.add(side);
  });
  [0, SH * 0.34, SH * 0.67, SH].forEach((y) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(SW, 0.05, SD), caseMat);
    board.position.set(0, y, 0);
    board.castShadow = true; board.receiveShadow = true;
    shelf.add(board);
  });

  // 뒷벽 폭 전체에 걸쳐 세워둔 칸막이 — 아무것도 안 채워진 넓은 벽처럼
  // 보이지 않게, 시각적으로 여러 개의 작은 책장이 이어붙은 느낌을 줌.
  const BAY_W = 2.1;
  const bayCount = Math.round(SW / BAY_W);
  for (let i = 1; i < bayCount; i++) {
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.04, SH, SD), caseMat);
    divider.position.set(-SW / 2 + i * (SW / bayCount), SH / 2, 0);
    divider.castShadow = true;
    shelf.add(divider);
  }

  const shelfYs = [0.09, SH * 0.34 + 0.09, SH * 0.67 + 0.09];
  let bookMeshes = [];

  function clearBooks() {
    bookMeshes.forEach((m) => shelf.remove(m));
    bookMeshes = [];
  }

  // 한 칸(level)의 [xStart, xEnd] 구간 안에, titles 순서대로 책을 채워 넣음
  // (색·책등 글자를 제목에서 뽑음). 칸이 차면 거기서 멈추고 꽂은 수를 돌려줌.
  function fillLevel(y, xStart, xEnd, titles) {
    let x = xStart;
    let guard = 0;
    let i = 0;
    while (x < xEnd - 0.02 && guard < 200 && i < titles.length) {
      guard++;
      const bw = 0.07 + Math.random() * 0.05;
      if (x + bw > xEnd) break;
      const bh = 0.32 + Math.random() * 0.16;
      const bd = SD - 0.1;
      const title = titles[i];
      const col = BOOK_COLORS[hashString(title) % BOOK_COLORS.length];
      const colorHex = '#' + col.toString(16).padStart(6, '0');
      const sideMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 });
      // 책등(카메라를 향하는 +z 면)에만 제목 텍스처를 입히고, 나머지
      // 5면은 그냥 색만 — BoxGeometry 재질 배열 순서는 [+x,-x,+y,-y,+z,-z].
      const spineTex = makeCanvasTexture((ctx, w, h) => drawBookSpine(ctx, w, h, colorHex, title), 64, 256);
      const spineMat = new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.85 });
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, bd),
        [sideMat, sideMat, sideMat, sideMat, spineMat, sideMat]
      );
      book.position.set(x + bw / 2, y + bh / 2, 0);
      book.rotation.y = (Math.random() - 0.5) * 0.05; // 살짝 삐뚤빼뚤하게 꽂힌 느낌
      book.castShadow = true; book.receiveShadow = true;
      shelf.add(book);
      bookMeshes.push(book);
      x += bw + 0.012;
      i++;
    }
    return i; // 이 칸에 실제로 꽂은 책 수 — 다음 칸에 넘길 titles 인덱스 계산용
  }

  // 칸막이로 나뉜 b번째(왼쪽부터 0,1,2...) 책장 구획의 [xStart, xEnd].
  function bayRange(b) {
    const bayW = SW / bayCount;
    return [-SW / 2 + b * bayW + 0.12, -SW / 2 + (b + 1) * bayW - 0.12];
  }

  // 위 칸부터 아래 칸 순서(shelfYs는 아래→위라 뒤집어서 씀).
  const levelsTopFirst = [...shelfYs].reverse();

  // 맨 왼쪽 책장의 맨 위 칸부터 채우고, 그 칸이 다 차면 같은 책장의
  // 다음 칸(위→아래)으로, 그 책장이 다 차면 오른쪽 책장으로 넘어감 —
  // "책장 하나를 위에서부터 채우고 다음 책장으로" 순서.
  function fillAll(titles) {
    clearBooks();
    let offset = 0;
    for (let b = 0; b < bayCount && offset < titles.length; b++) {
      const [xStart, xEnd] = bayRange(b);
      for (const y of levelsTopFirst) {
        if (offset >= titles.length) break;
        offset += fillLevel(y, xStart, xEnd, titles.slice(offset));
      }
    }
  }

  shelf.add(aoBlob(4.0));

  shelf.position.set(0, 0, -FLOOR_D / 2 + SD / 2 + 0.06);

  // main.js가 라이브러리 전체 기록(책/애니/영화)의 제목 목록을 받아온
  // 뒤 이걸 호출해서, 그 개수만큼만 책을 다시 꽂아 넣음.
  shelf.userData.setBooks = (titles) => {
    if (!titles) return; // 못 받아왔으면 빈 책장 그대로
    fillAll(titles); // 빈 배열이면 책 없이 비움 — 기록이 0개인 걸 그대로 보여줌
  };

  return shelf;
}
