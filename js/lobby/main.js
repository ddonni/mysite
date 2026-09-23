// 로비 페이지(index.html)의 시작점.
//   1. WebGL을 쓸 수 있는 브라우저인지 확인 (아니면 텍스트 링크로 대체)
//   2. scene.js로 3D 방을 만들고, controls.js로 인터랙션을 연결
//   3. 매 프레임 화면을 그리는 루프를 돌림
//   4. 카드의 "입장하기"를 누르면 실제로 다른 페이지로 이동시킴
//
// 헤더/카드 주변 UI(roomChrome.js), 씬에 실제 데이터를 채우는 일
// (loadRoomIntoScene.js), "지금 보는 방이 어디인지" 계산(roomContext.js)은
// 각자 모듈로 빠져 있음 — 이 파일은 그것들을 불러와 순서대로 연결하는
// "시작점" 역할만 함.
import { buildScene, DEFAULT_THEME } from './scene.js';
import { createRoomInteraction } from './controls.js';
import { roomContext, roomInfo, pageUrl, lobbyUrl } from './roomContext.js';
import { initRoomChrome } from './roomChrome.js';
import { loadRoomIntoScene } from './loadRoomIntoScene.js';
import { webglAvailable } from './webgl.js';
import { watchForSlowWake, WAKE_MESSAGE } from '../shared/wake.js';

const PAGES = { sketchbook: 'sketchbook', library: 'library', music: 'library?cat=music', food: 'library?cat=food' };
const ROOM_INFO = {
  sketchbook: { title: '스케치북', body: '번호 매긴 페이지를 넘기며 자유롭게 그리는 캔버스 방이에요.' },
  library: { title: '기록 보관소', body: '읽고 본 책·애니·영화를 기록하는 방이에요.' },
  music: { title: '턴테이블', body: '모아둔 노래를 들어보는 공간이에요.' },
  food: { title: '냉장고', body: '먹은 음식을 사진으로 남겨두는 냉장고예요.' },
};

roomContext.then(initRoomChrome);

// three.js(전역 THREE)가 로드되지 않았거나 이 브라우저가 WebGL을 못
// 그리면, 3D는 아예 시도하지 않고 index.html에 미리 넣어둔 "그냥 링크"
// 화면으로 대신함 (css의 .no-3d 규칙이 이 전환을 처리함).
if (typeof THREE === 'undefined' || !webglAvailable()) {
  document.body.classList.add('no-3d');
} else {
  boot().catch((e) => {
    document.body.classList.add('no-3d');
    console.error('lobby init failed', e);
  });
}

// 방의 테마(색 팔레트)를 서버에서 받아온 뒤에야 씬을 만들 수 있어서,
// 이 함수 전체가 그 조회를 기다리는 프로미스임 — 실패하면 위 .catch가
// no-3d 폴백으로 넘김. 남의 방 코드가 존재하지 않는 방이면(404) 씬을
// 짓지 않고 알려준 뒤 내 로비로 돌려보냄.
function boot() {
  // 서버가 잠들어 있으면 이 대기가 길어질 수 있음 — 3초가 지나도 안
  // 끝나면 "그냥 느린 게 아니라 서버가 깨는 중"이라고 로딩 문구를 바꿔줌.
  const loadingEl = document.getElementById('loading');
  const stopWatch = watchForSlowWake(() => { loadingEl.textContent = WAKE_MESSAGE; });
  return Promise.all([roomContext, roomInfo])
    .then(([ctx, info]) => {
      if (info && info.missing) {
        alert(`방 ${ctx.viewingCode}을(를) 찾을 수 없어요. 내 방으로 돌아갈게요.`);
        window.location.replace(lobbyUrl(ctx.mine.code, ctx.mine.code));
        return;
      }
      return bootWithTheme((info && info.theme) || DEFAULT_THEME, ctx);
    })
    .finally(stopWatch);
}

function bootWithTheme(theme, ctx) {
  const canvasEl = document.getElementById('canvas3d');
  const stage = document.getElementById('stage');
  const ui = document.getElementById('ui');
  const loading = document.getElementById('loading');

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

  const { scene, interactiveGroups, updateMotes, updateTurntable, updateBall, kickBall, ...sceneSetters } = buildScene(theme);
  loadRoomIntoScene(ctx, sceneSetters);

  // 카드에서 "입장하기"를 누르면 실제로 페이지를 옮기는 함수. 화면을
  // 살짝 어둡게 페이드아웃한 뒤 이동시켜서, 뚝 끊기지 않고 자연스럽게
  // 다음 페이지로 넘어가는 느낌을 줌.
  function goToRoom(room) {
    stage.style.transition = 'opacity .35s ease';
    ui.style.transition = 'opacity .35s ease';
    stage.style.opacity = '0';
    ui.style.opacity = '0';
    setTimeout(() => { window.location.href = pageUrl(PAGES[room], ctx); }, 320);
  }

  const interaction = createRoomInteraction({
    canvas: canvasEl,
    camera,
    interactiveGroups,
    roomInfo: ROOM_INFO,
    onConfirm: goToRoom,
    kickBall,
    dom: {
      hint: document.getElementById('hint'),
      card: document.getElementById('card'),
      cardTitle: document.getElementById('cardTitle'),
      cardBody: document.getElementById('cardBody'),
      cardBack: document.getElementById('cardBack'),
      cardEnter: document.getElementById('cardEnter'),
      ctaBtns: Array.prototype.slice.call(document.querySelectorAll('.room-btn')),
    },
  });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let lastFrame = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    requestAnimationFrame(tick);

    interaction.update(dt);
    updateMotes(dt);
    updateTurntable(dt);
    updateBall(dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
  requestAnimationFrame(() => loading.classList.add('hide'));
}
