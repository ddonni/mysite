// 로비 페이지(index.html)의 시작점.
//   1. WebGL을 쓸 수 있는 브라우저인지 확인 (아니면 텍스트 링크로 대체)
//   2. scene.js로 3D 방을 만들고, controls.js로 인터랙션을 연결
//   3. 매 프레임 화면을 그리는 루프를 돌림
//   4. 카드의 "입장하기"를 누르면 실제로 다른 페이지로 이동시킴
import { buildScene, THEMES, DEFAULT_THEME } from './scene.js';
import { createRoomInteraction } from './controls.js';
import { getMyRoom, roomLink } from '../shared/room.js';
import { API_BASE } from '../shared/config.js';
import { renderGoogleButton } from '../shared/googleAuth.js';

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

  // 3D 로비든 폴백 링크 화면이든 상관없이 "구글 계정으로 방 복구/연결"
  // 버튼을 둠 — GOOGLE_CLIENT_ID가 안 채워져 있으면 renderGoogleButton이
  // 그냥 아무것도 안 그림.
  document.querySelectorAll('.google-btn').forEach((el) => renderGoogleButton(el));

  // 3D 로비에만 있는 테마 스위처(폴백 링크 화면엔 씬이 없어서 #themePicker
  // 자체가 없음). 지금 테마를 알아야 어느 스와치를 눌린 상태로 보여줄지
  // 정할 수 있어서, 방 정보를 한 번 더 조회함.
  const picker = document.getElementById('themePicker');
  if (picker) {
    fetch(`${API_BASE}/api/rooms/${mine.code}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => renderThemePicker(picker, mine, (info && info.theme) || DEFAULT_THEME))
      .catch(() => renderThemePicker(picker, mine, DEFAULT_THEME));
  }
});

const THEME_LABELS = { wood: '우드', night: '나이트', pastel: '파스텔' };

function renderThemePicker(picker, mine, current) {
  picker.innerHTML = '';
  Object.keys(THEMES).forEach((key) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-swatch';
    btn.style.background = '#' + THEMES[key].wall.toString(16).padStart(6, '0');
    btn.title = THEME_LABELS[key] || key;
    btn.setAttribute('aria-pressed', String(key === current));
    btn.addEventListener('click', () => {
      if (key === current || btn.disabled) return;
      btn.disabled = true;
      fetch(`${API_BASE}/api/rooms/${mine.code}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Room-Token': mine.token },
        body: JSON.stringify({ theme: key }),
      })
        // 씬 색상을 그때그때 다시 칠하는 대신, 저장 후 새로고침해서
        // buildScene이 처음부터 새 팔레트로 다시 짓게 함 — 훨씬 간단하고
        // 로비는 어차피 자주 여는 화면이 아니라 새로고침 비용이 적음.
        .then((res) => { if (res.ok) window.location.reload(); else btn.disabled = false; })
        .catch(() => { btn.disabled = false; });
    });
    picker.appendChild(btn);
  });
}

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
  boot().catch((e) => {
    document.body.classList.add('no-3d');
    console.error('lobby init failed', e);
  });
}

// 방의 테마(색 팔레트)를 서버에서 받아온 뒤에야 씬을 만들 수 있어서,
// 이 함수 전체가 그 조회를 기다리는 프로미스임 — 실패하면 위 .catch가
// no-3d 폴백으로 넘김.
function boot() {
  return getMyRoom()
    .then((mine) => fetch(`${API_BASE}/api/rooms/${mine.code}`))
    .then((res) => (res.ok ? res.json() : null))
    .then((info) => bootWithTheme((info && info.theme) || DEFAULT_THEME));
}

function bootWithTheme(theme) {
  const canvasEl = document.getElementById('canvas3d');
  const stage = document.getElementById('stage');
  const ui = document.getElementById('ui');
  const loading = document.getElementById('loading');

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

  const { scene, interactiveGroups, updateMotes, updateTurntable, updateBall, kickBall, setSketchbookPreview, setFeaturedSong, setFeaturedWorks, setLibraryBooks } = buildScene(theme);

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

  // 벽 액자 3개(왼쪽/가운데/오른쪽) + 책장을 실제 기록으로 채워넣음.
  // 같은 목록을 두 군데에 다 쓰므로 요청은 한 번만 함:
  //  - 가운데 액자: library.html에서 별표(⭐)로 직접 지정한 기록이
  //    있으면 그걸 쓰고, 없으면 책/애니/영화 중 가장 최근 기록으로
  //    대신함(목록이 이미 최신순 정렬이라 그중 첫 항목) — 가장 눈에
  //    띄는 자리라 "대표작"을 걺.
  //  - 왼쪽/오른쪽 액자: 가운데를 뺀 나머지 중 최신 두 개.
  //  - 책장: 음악을 뺀 나머지 기록 전부의 제목으로 그 개수만큼만 채움.
  getMyRoom()
    .then((mine) => fetch(`${API_BASE}/api/rooms/${mine.code}/records`))
    .then((res) => (res.ok ? res.json() : []))
    .then((records) => {
      const list = records || [];
      const works = list.filter((r) => r.cat !== 'music');
      const mid = list.find((r) => r.featured) || works[0];
      const rest = works.filter((r) => r !== mid);
      [rest[0], mid, rest[1]].forEach((work, i) => { if (work) setFeaturedWorks[i](work); });
      setLibraryBooks(works.map((r) => r.title));
    })
    .catch(() => {}); // 실패해도 액자/책장은 기본 상태로 남을 뿐, 로비 자체는 멀쩡히 작동함

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
