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
import { buildRoundShell, arrangeRound } from './scene/roundLayout.js';
import { addLighting } from './scene/lighting.js';
import { buildDustMotes } from './scene/dustMotes.js';
import { buildWallLabel } from './scene/wallLabel.js';
import { BACK_WALL_Z, LEFT_WALL_X, WALL_LABEL_Y } from './scene/roomDimensions.js';
import { buildEasel } from './scene/furniture/easel.js';
import { buildBookshelf } from './scene/furniture/bookshelf.js';
import { buildFrame } from './scene/furniture/frame.js';
import { buildTurntable } from './scene/furniture/turntable.js';
import { buildPosterWall } from './scene/furniture/posterWall.js';
import { buildDisplayCase } from './scene/furniture/displayCase.js';
import { buildFloorLamp } from './scene/furniture/lamps.js';
import { buildBall } from './scene/furniture/ball.js';
import { buildTeddyBear } from './scene/furniture/teddyBear.js';

// 뒷벽을 반으로 나눠 왼쪽은 책장(책), 오른쪽은 포스터 벽(영화) — 두 구역의
// 가운데 x. 왼쪽 벽엔 책장만 한 애니 진열장이 서고(가운데 z), 이젤은 방
// 가운데 러그 위(easel.js). controls.js의 FOCUS 목표 지점도 이 값들과
// 맞춰둬야 함.
// 책장(뒷벽)과 진열장(왼쪽 벽)이 방 구석에서 맞붙지 않게, 책장은 오른쪽으로
// 진열장은 앞으로 빼서 구석에 1m 가까이 틈을 둠.
export const BOOK_X = -2.9;
export const MOVIE_X = 3.3;
export const ANIME_Z = -0.4;

// 방 테마 프리셋 — 바닥/벽/러그/배경(안개) 색만 바꿔서 분위기를
// 갈아끼움. 가구 자체의 나무색이나 각 방(스케치북/책/애니/영화/음악)의
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
// THEMES의 키 중 하나(모르는 값이면 기본 테마로 대체). layout은 [시안]
// 'round'면 둥근 방(scene/roundLayout.js), 그 외엔 기본 사각 방.
export function buildScene(theme, layout) {
  const palette = THEMES[theme] || THEMES[DEFAULT_THEME];
  const round = layout === 'round';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.void);
  // 멀어질수록 안개에 잠기게 해서, 방의 경계가 딱딱 잘려 보이는 대신
  // 어둠 속으로 자연스럽게 사라지는 느낌을 줌.
  scene.fog = new THREE.Fog(palette.void, 10, 25);

  const room = round ? buildRoundShell(palette) : buildRoomShell(palette);
  const easel = buildEasel();
  const shelf = buildBookshelf(BOOK_X);
  const turntable = buildTurntable();
  // 책장 위에 왼쪽/가운데/오른쪽으로 하나씩 — 책 대표작 3개를 걺(가운데가
  // 첫 번째 대표작, loadRoomIntoScene.js가 setBookFrames로 셋을 채움).
  const frameLeft = buildFrame(BOOK_X - 1.8);
  const frameMid = buildFrame(BOOK_X);
  const frameRight = buildFrame(BOOK_X + 1.8);
  const posterWall = buildPosterWall(MOVIE_X);
  const displayCase = buildDisplayCase(ANIME_Z);
  const ball = buildBall();
  const teddyBear = buildTeddyBear();
  // 빛의 출처가 보이는 플로어 스탠드 — 진열장 앞쪽 끝 구석(장식이라
  // interactiveGroups엔 안 넣음).
  const floorLamp = buildFloorLamp(-5.8, 3.3);
  // 각 가구 위 벽의 큰 글씨 — 색은 lobby.css의 --gold/--crimson/--rose와
  // 맞춤. 글씨를 눌러도 그 가구로 카메라가 감(userData.room).
  const bookLabel = buildWallLabel('BOOK', '#a8793a', 'book');
  bookLabel.position.set(BOOK_X, WALL_LABEL_Y, BACK_WALL_Z + 0.08);
  const movieLabel = buildWallLabel('MOVIE', '#b4473c', 'movie');
  movieLabel.position.set(MOVIE_X, WALL_LABEL_Y, BACK_WALL_Z + 0.08);
  const animeLabel = buildWallLabel('ANIMATION', '#c2618b', 'anime');
  animeLabel.position.set(LEFT_WALL_X + 0.08, WALL_LABEL_Y, ANIME_Z);
  animeLabel.rotation.y = Math.PI / 2;
  const labels = [bookLabel, movieLabel, animeLabel];

  // [시안] 둥근 방이면 같은 가구들을 그 배치로 옮겨 달고, 오른쪽 면엔 턴테이블
  // + MUSIC 글씨. 조명 위치·카메라 프리셋도 그 배치용을 받음.
  let accentLights, cameraPresets;
  if (round) {
    const musicLabel = buildWallLabel('MUSIC', '#3d86ad', 'music');
    labels.push(musicLabel);
    ({ accentLights, cameraPresets } = arrangeRound(
      { shelf, frames: [frameLeft, frameMid, frameRight], posterWall, displayCase, turntable, easel, teddyBear, floorLamp,
        bookLabel, movieLabel, animeLabel, musicLabel },
      { bookX: BOOK_X, movieX: MOVIE_X, animeZ: ANIME_Z }
    ));
  }

  room.add(easel, shelf, turntable, frameLeft, frameMid, frameRight, posterWall, displayCase, ball, teddyBear, floorLamp, ...labels);
  scene.add(room);

  addLighting(scene, accentLights);

  const motes = buildDustMotes();
  scene.add(motes);
  const moteCount = motes.geometry.attributes.position.count;

  return {
    scene,
    // 클릭/호버 대상이 되는 가구 그룹들 — controls.js가 레이캐스팅할 때 씀.
    // ball도 여기 포함시켜서 클릭/호버 판정을 받지만, userData.room이
    // 없어서 방 이동으로는 안 이어지고 controls.js가 따로 kickBall로 연결함.
    interactiveGroups: [easel, shelf, turntable, frameLeft, frameMid, frameRight, posterWall, displayCase, ball, ...labels],
    // 배치별 카메라 위치(첫 화면/가구 포커스) — 없으면 controls.js 기본값(사각 방).
    cameraPresets,
    // 아래 set* 함수들은 loadRoomIntoScene.js가 서버에서 받아온 데이터로
    // 각 가구를 채울 때 씀.
    // 이젤 보드에 1페이지 그림을 채워넣음.
    setSketchbookPreview: easel.userData.setPreview,
    // 턴테이블에 최신곡을 채워넣음.
    setFeaturedSong: turntable.userData.setFeaturedSong,
    // 책 대표작 최대 3개({ top })를 [왼쪽, 가운데, 오른쪽] 액자에 채움 —
    // 가운데가 첫 번째. 셋보다 적으면 남는 자리는 기본 아이콘 그대로.
    setBookFrames({ top }) {
      [top[1], top[0], top[2]].forEach((work, i) => [frameLeft, frameMid, frameRight][i].userData.setFeaturedWork(work || null));
    },
    // 책 기록 전체의 제목 목록으로 책장에 그 개수만큼 책을 꽂아넣음.
    setLibraryBooks: shelf.userData.setBooks,
    // 영화/애니 대표작(top)과 나머지(rest)를 포스터 벽/진열장에 채움.
    setMovies: posterWall.userData.setMovies,
    setAnime: displayCase.userData.setAnime,
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
