// 로비의 "생김새"만 담당하는 모듈: 방 껍데기(scene/roomShell.js)와 각
// 가구(scene/furniture/*.js)를 하나씩 지어서 THREE.Scene 하나로
// 조립함. 여긴 사용자 입력(드래그, 클릭)을 전혀 다루지 않음 — 그건
// controls.js의 역할. 이 파일은 "3D 공간에 뭘 놓을지"를 결정하고,
// controls.js/main.js가 필요로 하는 것들(장면 자체, 클릭 가능한
// 가구 그룹들, 먼지를 매 프레임 움직이는 함수)을 돌려주는 조립 지점
// 역할만 함 — 가구 하나하나의 생김새/재질/텍스처는 각자의 모듈에 있음.
//
// THREE는 index.html에서 <script>로 먼저 불러온 전역 변수라서 따로
// import할 필요 없음 (UMD 빌드라 window.THREE에 붙어 있음).

import { buildRoomShell } from './scene/roomShell.js';
import { addLighting } from './scene/lighting.js';
import { buildDustMotes } from './scene/dustMotes.js';
import { buildEasel } from './scene/furniture/easel.js';
import { buildBookshelf } from './scene/furniture/bookshelf.js';
import { buildFrame } from './scene/furniture/frame.js';
import { buildTurntable } from './scene/furniture/turntable.js';
import { buildBall } from './scene/furniture/ball.js';
import { buildTeddyBear } from './scene/furniture/teddyBear.js';

// 방 테마 프리셋 — 바닥/벽/러그/배경(안개) 색만 바꿔서 분위기를
// 갈아끼움. 가구 자체의 나무색이나 각 방(스케치북/기록보관소/음악)의
// 포인트 조명 색은 테마와 무관하게 항상 같게 둬서, 테마가 바뀌어도
// "이게 무슨 방인지"는 헷갈리지 않게 함.
export const THEMES = {
  wood: { void: 0x120f0c, wall: 0xcdbfa4, floorA: 0x2a2016, floorB: 0x251c13, rug: 0x5a2e22 },
  night: { void: 0x0a0e16, wall: 0x3a4759, floorA: 0x161b23, floorB: 0x11151b, rug: 0x2c3a5c },
  pastel: { void: 0x241d1a, wall: 0xf1d9ce, floorA: 0x8a695c, floorB: 0x7b5b4f, rug: 0xd98f88 },
};
export const DEFAULT_THEME = 'wood';

// 이 모듈에서 밖으로 내놓는 단 하나의 함수. 로비 장면 전체를 한 번에
// 만들어서, main.js/controls.js가 필요로 하는 것들을 돌려줌. theme은
// THEMES의 키 중 하나(모르는 값이면 기본 테마로 대체).
export function buildScene(theme) {
  const palette = THEMES[theme] || THEMES[DEFAULT_THEME];

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.void);
  // 멀어질수록 안개에 잠기게 해서, 방의 경계가 딱딱 잘려 보이는 대신
  // 어둠 속으로 자연스럽게 사라지는 느낌을 줌.
  scene.fog = new THREE.Fog(palette.void, 7, 17);

  const room = buildRoomShell(palette);
  const easel = buildEasel();
  const shelf = buildBookshelf();
  const turntable = buildTurntable();
  // 벽에 왼쪽/가운데/오른쪽으로 하나씩 — 가운데가 제일 눈에 띄는
  // 자리라 "인생작품"(별표 지정 우선)을 걸고, 양옆엔 그다음으로
  // 최근인 작품 두 개를 걺(main.js가 setFeaturedWorks로 셋을 채움).
  const frameLeft = buildFrame(-2.7);
  const frameMid = buildFrame(0);
  const frameRight = buildFrame(2.7);
  const ball = buildBall();
  const teddyBear = buildTeddyBear();
  room.add(easel, shelf, turntable, frameLeft, frameMid, frameRight, ball, teddyBear);
  scene.add(room);

  addLighting(scene);

  const motes = buildDustMotes();
  scene.add(motes);
  const moteCount = motes.geometry.attributes.position.count;

  return {
    scene,
    // 클릭/호버 대상이 되는 가구 그룹들 — controls.js가 레이캐스팅할 때 씀.
    // ball도 여기 포함시켜서 클릭/호버 판정을 받지만, userData.room이
    // 없어서 방 이동으로는 안 이어지고 controls.js가 따로 kickBall로 연결함.
    interactiveGroups: [easel, shelf, turntable, frameLeft, frameMid, frameRight, ball],
    // main.js가 내 방의 1페이지 스트로크를 받아오면 이걸 호출해서
    // 이젤 보드에 실제 그림을 채워넣음.
    setSketchbookPreview: easel.userData.setPreview,
    // main.js가 라이브러리의 최근 음악 기록을 받아오면 이걸 호출해서
    // 턴테이블에 실제 대표곡을 채워넣음.
    setFeaturedSong: turntable.userData.setFeaturedSong,
    // main.js가 골라준 최대 3개의 책/애니/영화 기록을 [왼쪽, 가운데,
    // 오른쪽] 순서로 각 액자에 채워넣을 때 씀 — 셋보다 적으면 남는
    // 자리는 기본 아이콘 그대로.
    setFeaturedWorks: [frameLeft.userData.setFeaturedWork, frameMid.userData.setFeaturedWork, frameRight.userData.setFeaturedWork],
    // main.js가 라이브러리 전체 기록(책/애니/영화)의 제목 목록을
    // 받아오면 이걸 호출해서 책장에 그 개수만큼 책을 꽂아넣음.
    setLibraryBooks: shelf.userData.setBooks,
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
    updateTurntable: turntable.userData.spin,
    // 공을 클릭했을 때 무작위 방향으로 튕겨내는 함수.
    kickBall: ball.userData.kick,
    // 매 프레임 공의 물리(중력/바닥·벽 반사/구르는 회전)를 갱신함.
    updateBall: ball.userData.update,
  };
}
