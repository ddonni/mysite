// 로비의 "생김새"만 담당하는 모듈: 방 껍데기(scene/roomShell.js)와 각
// 가구(scene/furniture/*.js)를 하나씩 지어서 THREE.Scene 하나로
// 조립함. 여긴 사용자 입력(드래그, 클릭)을 전혀 다루지 않음 — 그건
// controls.js의 역할. 이 파일은 "3D 공간에 뭘 놓을지"를 결정하고,
// controls.js/main.js가 필요로 하는 것들(장면 자체, 클릭 가능한
// 가구 그룹들, 카메라 프리셋, 매 프레임 움직이는 함수들)을 돌려주는 조립
// 지점 역할만 함 — 가구 하나하나의 생김새는 각자의 모듈에, 어느 벽/자리에
// 둘지는 scene/roomLayout.js에 있음.
//
// 방은 둥근(다각형) 방: 벽 세 면에 왼쪽부터 애니 → 책 → 영화 가구가 하나씩
// (벽 가구마다 위에 인생작 3개와 벽 글씨), 가운데 러그 위에 캔버스 이젤,
// 오른쪽 앞에 음악 코너(턴테이블을 얹은 LP 보관함).
// (예전 네모난 방은 git 브랜치 rect-room에 있음.)
//
// THREE는 index.html에서 <script>로 먼저 불러온 전역 변수라서 따로
// import할 필요 없음 (UMD 빌드라 window.THREE에 붙어 있음).

import { buildRoomShell } from './scene/roomShell.js';
import { arrangeRoom } from './scene/roomLayout.js';
import { addLighting } from './scene/lighting.js';
import { buildDustMotes } from './scene/dustMotes.js';
import { buildWallLabel } from './scene/wallLabel.js';
import { FEATURED_GAP, WALL_LABEL_Y } from './scene/roomDimensions.js';
import { buildEasel } from './scene/furniture/easel.js';
import { buildBookshelf } from './scene/furniture/bookshelf.js';
import { buildFrame } from './scene/furniture/frame.js';
import { buildRecordConsole } from './scene/furniture/recordConsole.js';
import { buildPosterWall } from './scene/furniture/posterWall.js';
import { buildDisplayCase } from './scene/furniture/displayCase.js';
import { buildFloorLamp } from './scene/furniture/lamps.js';
import { buildBall } from './scene/furniture/ball.js';
import { buildTeddyBear } from './scene/furniture/teddyBear.js';

// 방 테마 프리셋 — 바닥/벽/러그/배경 색만 바꿔서 분위기를 갈아끼움. 가구
// 자체의 나무색이나 각 가구(캔버스/책/애니/영화/음악)의 포인트 조명 색은
// 테마와 무관하게 항상 같게 둬서, 테마가 바뀌어도 "이게 무슨 기록인지"는
// 헷갈리지 않게 함. 배경은 가운데(glow)에서 가장자리(void)로 어두워지는
// 그라데이션 — 방이 새까만 허공에 떠 있는 느낌을 덜어줌.
export const THEMES = {
  wood: { void: 0x120f0c, glow: 0x3a2d22, wall: 0xcdbfa4, floorA: 0x2a2016, floorB: 0x251c13, rug: 0x5a2e22 },
  night: { void: 0x0a0e16, glow: 0x1f2a3d, wall: 0x3a4759, floorA: 0x161b23, floorB: 0x11151b, rug: 0x2c3a5c },
  pastel: { void: 0x241d1a, glow: 0x5a463d, wall: 0xf1d9ce, floorA: 0x8a695c, floorB: 0x7b5b4f, rug: 0xd98f88 },
};

// 화면 전체에 깔리는 배경 그라데이션(scene.background 텍스처는 화면에 딱
// 맞게 늘어나서 그려짐) — 방이 놓이는 화면 가운데 약간 아래가 가장 밝음.
function backgroundTexture(palette) {
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 290, 20, 256, 290, 400);
  g.addColorStop(0, hex(palette.glow));
  g.addColorStop(1, hex(palette.void));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export const DEFAULT_THEME = 'wood';

// 벽 위 글씨 — 색은 lobby.css의 --gold/--crimson/--rose 계열을 밝은 벽
// 위에서도 또렷하게 읽히도록 한 톤 진하게.
// 글씨를 눌러도 그 가구로 카메라가 감(userData.room).
function wallLabel(text, color, room) {
  const label = buildWallLabel(text, color, room);
  label.position.set(0, WALL_LABEL_Y, 0.08);
  return label;
}


// 이 모듈에서 밖으로 내놓는 단 하나의 함수. 로비 장면 전체를 한 번에
// 만들어서, main.js/controls.js가 필요로 하는 것들을 돌려줌. theme은
// THEMES의 키 중 하나(모르는 값이면 기본 테마로 대체).
export function buildScene(theme) {
  const palette = THEMES[theme] || THEMES[DEFAULT_THEME];

  const scene = new THREE.Scene();
  scene.background = backgroundTexture(palette);
  // 방 바깥 먼 곳만 어둠 속으로 사라지게 하는 안개 — 방 안(카메라에서 가장
  // 먼 뒷벽까지 ~22)은 거의 안 어두워지도록 시작 거리를 멀리 둠.
  scene.fog = new THREE.Fog(palette.void, 26, 48);

  const room = buildRoomShell(palette);

  // 벽 가구들 — 전부 "자기 벽 기준" 좌표로 지어지고 roomLayout.js가 벽에 담.
  const shelf = buildBookshelf();
  // 책장 위 벽에 나란히 거는 책 인생작 액자 3개 [왼쪽, 가운데, 오른쪽].
  const bookFrames = [-1, 0, 1].map((i) => buildFrame(i * FEATURED_GAP));
  const displayCase = buildDisplayCase();
  const posterWall = buildPosterWall();
  const labels = {
    book: wallLabel('BOOK', '#8a5d22', 'book'),
    anime: wallLabel('ANIMATION', '#a8466f', 'anime'),
    movie: wallLabel('MOVIE', '#9c342b', 'movie'),
  };

  // 가운데 소품들.
  const easel = buildEasel();
  const recordConsole = buildRecordConsole(); // 턴테이블을 얹은 LP 보관함
  const ball = buildBall();
  const teddyBear = buildTeddyBear();
  const floorLamp = buildFloorLamp(); // 빛의 출처가 보이는 장식(클릭 대상 아님)

  const { lights, cameraPresets } = arrangeRoom({
    walls: [
      { face: 'anime', items: [displayCase, labels.anime] },
      { face: 'book', items: [shelf, ...bookFrames, labels.book] },
      { face: 'movie', items: [posterWall, labels.movie] },
    ],
    easel, recordConsole, ball, teddyBear, floorLamp,
  });

  room.add(shelf, ...bookFrames, displayCase, posterWall, ...Object.values(labels),
    easel, recordConsole, ball, teddyBear, floorLamp);
  scene.add(room);

  addLighting(scene, lights);

  const motes = buildDustMotes();
  scene.add(motes);
  const moteCount = motes.geometry.attributes.position.count;

  return {
    scene,
    // 클릭/호버 대상이 되는 가구 그룹들 — controls.js가 레이캐스팅할 때 씀.
    // ball도 여기 포함시켜서 클릭/호버 판정을 받지만, userData.room이
    // 없어서 방 이동으로는 안 이어지고 controls.js가 따로 kickBall로 연결함.
    interactiveGroups: [easel, recordConsole, shelf, ...bookFrames, displayCase, posterWall, ...Object.values(labels), ball],
    // 이 배치의 카메라 위치(첫 화면/가구별 포커스) — controls.js가 씀.
    cameraPresets,
    // 아래 set* 함수들은 loadRoomIntoScene.js가 서버에서 받아온 데이터로
    // 각 가구를 채울 때 씀. 카테고리별 인자 { top, rest }는 showcase.js의
    // pickShowcase 결과(top = 인생작 최대 3개, rest = 나머지).
    // 이젤 캔버스에 1페이지 그림을 채워넣음.
    setSketchbookPreview: easel.userData.setPreview,
    // 책 인생작(top, 첫 번째가 가운데)을 [왼쪽, 가운데, 오른쪽] 액자에 채움 —
    // 셋보다 적으면 남는 자리는 기본 아이콘 그대로.
    setBookFrames: ({ top }) => {
      [top[1], top[0], top[2]].forEach((work, i) => bookFrames[i].userData.setFeaturedWork(work || null));
    },
    // 책 기록 전체의 제목 목록으로 책장에 그 개수만큼 책을 꽂아넣음.
    setLibraryBooks: shelf.userData.setBooks,
    setMovies: posterWall.userData.setMovies,
    setAnime: displayCase.userData.setAnime,
    // 음악: 첫 번째 최애음악(없으면 가장 최근 곡)이 턴테이블에서 돌아가고(옆
    // 받침에 그 앨범 재킷), 나머지 곡은 LP 보관함에(최애음악 먼저 — 앞 두 장은
    // 표지가 보이게).
    setMusic: ({ top, rest }) => {
      recordConsole.userData.setNowPlaying(top[0] || null);
      recordConsole.userData.setAlbums([...top.slice(1), ...rest]);
    },
    // 매 프레임 먼지를 살짝 위로 움직이고, 천장 높이를 넘으면 바닥으로
    // 되돌려서 계속 떠다니는 것처럼 보이게 함.
    updateMotes(dt) {
      const pos = motes.geometry.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        pos[i * 3 + 1] += dt * 0.05;
        if (pos[i * 3 + 1] > 3.8) pos[i * 3 + 1] = 0.3;
      }
      motes.geometry.attributes.position.needsUpdate = true;
    },
    // 매 프레임 LP를 계속 돌림.
    updateTurntable: recordConsole.userData.spin,
    // 공을 클릭했을 때 무작위 방향으로 튕겨내는 함수.
    kickBall: ball.userData.kick,
    // 매 프레임 공의 물리(중력/벽 반사/구르는 회전)를 갱신함.
    updateBall: ball.userData.update,
  };
}
