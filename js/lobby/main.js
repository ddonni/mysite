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
import { initHelpDialog } from './helpDialog.js';
import { forgetMyRoom } from '../shared/room.js';
import { initRoomNav } from '../shared/roomNav.js';
import { watchForSlowWake, WAKE_MESSAGE } from '../shared/wake.js';

const PAGES = {
  sketchbook: 'sketchbook',
  book: 'library?cat=book',
  anime: 'library?cat=anime',
  movie: 'library?cat=movie',
  music: 'library?cat=music',
};
// tag: 카드 맨 위 작은 영문 라벨(가구 위 벽 글씨와 같은 말).
const ROOM_INFO = {
  sketchbook: { tag: 'Canvas', title: '캔버스', body: '마음 가는 대로 그려보세요. 이젤에는 첫 장이 걸려 있어요.' },
  book: { tag: 'Book', title: '책', body: '읽은 책이 한 권씩 꽂혀요.' },
  anime: { tag: 'Animation', title: '애니', body: '본 애니가 아크릴 스탠드로 진열돼요.' },
  movie: { tag: 'Movie', title: '영화', body: '본 영화가 포스터로 한 장씩 붙어요.' },
  music: { tag: 'Music', title: '음악', body: '들은 노래가 LP로 꽂혀요.' },
};

// 도움말은 서버 응답을 기다리지 않고 제일 먼저 — 처음 온 사람은 로딩 중에도 읽을 수 있게.
initHelpDialog();
// 왼쪽 위 상단 메뉴(캔버스/기록 보관소와 같은 것) — 방 코드·방문 폼도 여기에 붙음.
initRoomNav({ navEl: document.querySelector('.site-nav'), currentPage: './' }).catch(() => {});
roomContext.then(initRoomChrome);

// three.js(전역 THREE)가 로드되지 않았거나 이 브라우저가 WebGL을 못
// 그리면, 3D는 아예 시도하지 않고 index.html에 미리 넣어둔 "그냥 링크"
// 화면으로 대신함 (css의 .no-3d 규칙이 이 전환을 처리함).
if (typeof THREE === 'undefined' || !webglAvailable()) {
  document.body.classList.add('no-3d');
} else {
  boot().catch((e) => {
    // 이 경로로 오는 건 브라우저가 3D를 못 그려서가 아니라(그건 위
    // 분기에서 이미 걸러짐) 방 정보를 못 받아오는 등 다른 이유로 로비
    // 짓기 자체가 실패한 것 — index.html의 기본 문구("이 브라우저에서는
    // 3D를 표시할 수 없어요")를 그대로 두면 원인을 완전히 잘못 짚게 되니
    // 여기서 고쳐씀.
    const msg = document.getElementById('fallbackMessage');
    if (msg) msg.textContent = '지금 서버에 연결할 수 없어요. 아래 링크로 바로 이동해 주세요.';
    document.body.classList.add('no-3d');
    console.error('lobby init failed', e);
  });
}

// 방의 테마(색 팔레트)를 서버에서 받아온 뒤에야 씬을 만들 수 있어서,
// 이 함수 전체가 그 조회를 기다리는 프로미스임 — 실패하면 위 .catch가
// no-3d 폴백으로 넘김. 방 코드가 서버에 없으면(404) 씬을 짓지 않고
// 알려줌 — 남의 방이면 내 로비로 돌려보내고, 내 방이면(로컬/운영 서버를
// 오가며 테스트했거나 방이 실제로 사라진 경우) 낡은 방 정보를 지우고
// 새로고침해서 새 방을 만들게 함.
function boot() {
  // 서버가 잠들어 있으면 이 대기가 길어질 수 있음 — 3초가 지나도 안
  // 끝나면 "그냥 느린 게 아니라 서버가 깨는 중"이라고 로딩 문구를 바꿔줌.
  const loadingEl = document.getElementById('loading');
  const stopWatch = watchForSlowWake(() => { loadingEl.textContent = WAKE_MESSAGE; });
  return Promise.all([roomContext, roomInfo])
    .then(([ctx, info]) => {
      if (info && info.missing) {
        if (info.own) {
          alert('내 방을 찾지 못했어요. 새 방을 하나 만들게요.');
          forgetMyRoom();
          window.location.reload();
          return;
        }
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
  // 영화 같은 색 보정 — 밝은 곳(램프 주변)이 하얗게 날아가지 않고 부드럽게
  // 눌리고, 방 전체가 한 가지 색으로 쏠리지 않음. scene/lighting.js의
  // 조명 세기는 이 톤매핑/노출값에 맞춰 잡은 것.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

  const { scene, interactiveGroups, cameraPresets, updateMotes, updateTurntable, updateBall, kickBall, ...sceneSetters } = buildScene(theme);
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
    cameraPresets,
    kickBall,
    dom: {
      card: document.getElementById('card'),
      cardTag: document.getElementById('cardTag'),
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
