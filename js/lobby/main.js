// 로비 페이지(index.html)의 시작점.
//   1. WebGL을 쓸 수 있는 브라우저인지 확인 (아니면 텍스트 링크로 대체)
//   2. scene.js로 3D 방을 만들고, controls.js로 인터랙션을 연결
//   3. 매 프레임 화면을 그리는 루프를 돌림
//   4. 카드의 "입장하기"를 누르면 실제로 다른 페이지로 이동시킴
import { buildScene } from './scene.js';
import { createRoomInteraction } from './controls.js';
import { getMyRoom, roomLink } from '../shared/room.js';
import { API_BASE } from '../shared/config.js';

const PAGES = { sketchbook: 'sketchbook.html', library: 'library.html', music: 'library.html?cat=music' };
const ROOM_INFO = {
  sketchbook: { title: '스케치북', body: '번호 매긴 페이지를 넘기며 자유롭게 그리는 캔버스 방이에요.' },
  library: { title: '기록 보관소', body: '읽고 본 책·애니·영화를 기록하는 방이에요.' },
  music: { title: '턴테이블', body: '모아둔 노래를 들어보는 공간이에요.' },
};

// 내 방 코드 표시 + 남의 방 코드로 바로 방문하기. 3D든 폴백 링크 화면이든
// 둘 다에 있는 .room-info 자리를 똑같이 채움(둘 중 하나만 실제로 보임).
getMyRoom().then((mine) => {
  document.querySelectorAll('.room-info').forEach((el) => {
    el.innerHTML = `
      <span class="room-tag">내 방 코드 <b>${mine.code}</b></span>
      <button class="room-copy" type="button">복사</button>
      <form class="room-visit">
        <input type="text" maxlength="6" placeholder="방 코드로 방문" aria-label="방 코드">
        <button type="submit">방문</button>
      </form>
    `;
    el.querySelector('.room-copy').addEventListener('click', () => {
      (navigator.clipboard ? navigator.clipboard.writeText(mine.code) : Promise.reject())
        .catch(() => {});
    });
    el.querySelector('.room-visit').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = el.querySelector('.room-visit input').value.trim().toUpperCase();
      if (code) window.location.href = roomLink('sketchbook.html', code, mine.code);
    });
  });
});

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

// three.js(전역 THREE)가 로드되지 않았거나 이 브라우저가 WebGL을 못
// 그리면, 3D는 아예 시도하지 않고 index.html에 미리 넣어둔 "그냥 링크"
// 화면으로 대신함 (css의 .no-3d 규칙이 이 전환을 처리함).
if (typeof THREE === 'undefined' || !webglAvailable()) {
  document.body.classList.add('no-3d');
} else {
  try {
    boot();
  } catch (e) {
    document.body.classList.add('no-3d');
    console.error('lobby init failed', e);
  }
}

function boot() {
  const canvasEl = document.getElementById('canvas3d');
  const stage = document.getElementById('stage');
  const ui = document.getElementById('ui');
  const loading = document.getElementById('loading');

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

  const { scene, interactiveGroups, updateMotes, updateTurntable, setSketchbookPreview, setFeaturedSong, setFeaturedWork } = buildScene();

  // 이젤 보드에 실제 내 방 1페이지 그림을 채워넣음. 실시간 동기화는
  // 필요 없어서(로비에서 그리는 기능도 없음) 로드 시 한 번만 조회.
  getMyRoom()
    .then((mine) => fetch(`${API_BASE}/api/rooms/${mine.code}/pages/1`))
    .then((res) => (res.ok ? res.json() : null))
    .then((page) => { if (page) setSketchbookPreview(page.strokes || []); })
    .catch(() => {}); // 실패해도 이젤은 그냥 빈 종이로 남아있을 뿐, 로비 자체는 멀쩡히 작동함

  // 턴테이블에 대표곡(가장 최근에 추가한 음악 기록)을 채워넣음 —
  // 목록은 이미 최신순 정렬이라 첫 번째 항목이 곧 최신곡.
  getMyRoom()
    .then((mine) => fetch(`${API_BASE}/api/rooms/${mine.code}/records?cat=music`))
    .then((res) => (res.ok ? res.json() : []))
    .then((records) => { if (records && records.length) setFeaturedSong(records[0]); })
    .catch(() => {}); // 실패해도 턴테이블은 기본 상태로 남을 뿐, 로비 자체는 멀쩡히 작동함

  // 벽 액자에 이달의 작품을 채워넣음 — library.html에서 별표(⭐)로
  // 직접 지정한 기록이 있으면 그걸 쓰고, 아직 아무것도 지정 안 했으면
  // 책/애니/영화 중 가장 최근 기록으로 대신함(목록이 이미 최신순
  // 정렬이라 그중 첫 항목).
  getMyRoom()
    .then((mine) => fetch(`${API_BASE}/api/rooms/${mine.code}/records`))
    .then((res) => (res.ok ? res.json() : []))
    .then((records) => {
      const list = records || [];
      const work = list.find((r) => r.featured) || list.find((r) => r.cat !== 'music');
      if (work) setFeaturedWork(work);
    })
    .catch(() => {}); // 실패해도 액자는 기본 상태로 남을 뿐, 로비 자체는 멀쩡히 작동함

  // 카드에서 "입장하기"를 누르면 실제로 페이지를 옮기는 함수. 화면을
  // 살짝 어둡게 페이드아웃한 뒤 이동시켜서, 뚝 끊기지 않고 자연스럽게
  // 다음 페이지로 넘어가는 느낌을 줌.
  function goToRoom(room) {
    stage.style.transition = 'opacity .35s ease';
    ui.style.transition = 'opacity .35s ease';
    stage.style.opacity = '0';
    ui.style.opacity = '0';
    setTimeout(() => { window.location.href = PAGES[room]; }, 320);
  }

  const interaction = createRoomInteraction({
    canvas: canvasEl,
    camera,
    interactiveGroups,
    roomInfo: ROOM_INFO,
    onConfirm: goToRoom,
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
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
  requestAnimationFrame(() => loading.classList.add('hide'));
}
