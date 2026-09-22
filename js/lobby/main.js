// 로비 페이지(index.html)의 시작점.
//   1. WebGL을 쓸 수 있는 브라우저인지 확인 (아니면 텍스트 링크로 대체)
//   2. scene.js로 3D 방을 만들고, controls.js로 인터랙션을 연결
//   3. 매 프레임 화면을 그리는 루프를 돌림
//   4. 카드의 "입장하기"를 누르면 실제로 다른 페이지로 이동시킴
import { buildScene, THEMES, DEFAULT_THEME } from './scene.js';
import { createRoomInteraction } from './controls.js';
import { getMyRoom, getViewingRoomCode, forgetMyRoom } from '../shared/room.js';
import { API_BASE } from '../shared/config.js';
import { initGoogleAuth } from '../shared/googleAuth.js';
import { copyToClipboard } from '../shared/dom.js';
import { watchForSlowWake, WAKE_MESSAGE } from '../shared/wake.js';

const PAGES = { sketchbook: 'sketchbook', library: 'library', music: 'library?cat=music' };
const ROOM_INFO = {
  sketchbook: { title: '스케치북', body: '자유롭게 그리는 캔버스 방이에요.' },
  library: { title: '기록 보관소', body: '읽고 본 책·애니·영화를 기록하는 방이에요.' },
  music: { title: '턴테이블', body: '모아둔 노래를 들어보는 공간이에요.' },
};

// 지금 화면에 띄울 방: 주소에 ?room=코드가 있으면 그 방(남의 방 — 이 경우
// 로비의 모든 게 읽기 전용), 없으면 내 방. 이 파일의 모든 조회와 이동이
// 이 값을 기준으로 함.
const roomContext = getMyRoom().then((mine) => {
  const viewingCode = getViewingRoomCode(mine.code);
  return { mine, viewingCode, readOnly: viewingCode !== mine.code };
});

// sketchbook.html/library.html로 넘어갈 때, 남의 방을 보던 중이면 ?room=을
// 이어 붙여서 거기서도 그 방을 읽기 전용으로 보게 함. page에 이미
// 쿼리(예: library.html?cat=music)가 있을 수 있어서 ?와 &를 구분함.
function pageUrl(page, { mine, viewingCode }) {
  if (viewingCode === mine.code) return page;
  return page + (page.includes('?') ? '&' : '?') + 'room=' + encodeURIComponent(viewingCode);
}

// 지금 보는 방의 API 주소. 코드는 주소창(?room=)에서 온 값이라 아무 문자열일
// 수 있어서, 경로에 그대로 끼우면 `/`나 `?` 때문에 엉뚱한 경로를 조회하게 될
// 수 있음 — 인코딩해서 항상 "방 하나"를 가리키게 함.
function roomApi({ viewingCode }) {
  return `${API_BASE}/api/rooms/${encodeURIComponent(viewingCode)}`;
}

// 지금 보는 방의 정보(테마, 이름). 헤더(이름/테마 스위처)와 씬 생성이 둘 다
// 필요로 해서 요청을 한 번만 보냄. 코드가 서버에 없으면(404) { missing:
// true, own } — own은 그게 남의 방이 아니라 "내 방"인 경우를 구분함(로컬/
// 운영 서버를 오가며 테스트했거나 방이 실제로 사라진 경우 등).
const roomInfo = roomContext.then((ctx) =>
  fetch(roomApi(ctx)).then((res) => {
    if (res.status === 404) return { missing: true, own: !ctx.readOnly };
    return res.ok ? res.json() : null;
  })
);

// 로비 자체로 가는 주소 — "방 코드로 방문" 폼과 "내 방으로"가 씀.
function lobbyUrl(code, myCode) {
  return code === myCode ? './' : './?room=' + encodeURIComponent(code);
}

// 방 코드 표시 + 다른 방 방문 폼(+ 남의 방을 보는 중이면 "내 방으로"). 3D든
// 폴백 링크 화면이든 둘 다에 있는 .room-info 자리를 똑같이 채움(둘 중
// 하나만 실제로 보임).
roomContext.then((ctx) => {
  const { mine, viewingCode, readOnly } = ctx;

  document.querySelectorAll('.room-info').forEach((el) => {
    const visitForm = `
      <form class="room-visit">
        <input type="text" maxlength="6" placeholder="방 코드로 방문" aria-label="방 코드">
        <button type="submit">방문</button>
      </form>
    `;
    if (readOnly) {
      el.innerHTML = `
        <span class="room-tag readonly">방 <b class="viewing-code"></b> 보는 중 · 읽기 전용</span>
        <a class="room-home" href="${lobbyUrl(mine.code, mine.code)}">내 방으로</a>
      ` + visitForm;
      // 주소창의 ?room= 값이라 아무 문자열이나 들어올 수 있음 — innerHTML에
      // 직접 끼우지 않고 textContent로 넣어서 HTML 주입을 막음.
      el.querySelector('.viewing-code').textContent = viewingCode;
    } else {
      el.innerHTML = `
        <span class="room-tag">내 방 코드 <b>${mine.code}</b></span>
        <button class="room-copy" type="button">복사</button>
      ` + visitForm;
      el.querySelector('.room-copy').addEventListener('click', () => {
        copyToClipboard(mine.code).catch(() => {});
      });
    }
    el.querySelector('.room-visit').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = el.querySelector('.room-visit input').value.trim().toUpperCase();
      if (code) window.location.href = lobbyUrl(code, mine.code);
    });
  });

  if (readOnly) {
    // 폴백 링크 화면의 정적 링크들도 이 방을 이어서 보게 함. 테마 변경과
    // 구글 계정 연결은 내 방을 바꾸는 일이라 남의 방에선 아예 안 그림.
    document.querySelectorAll('#fallbackLinks a').forEach((a) => {
      a.href = pageUrl(a.getAttribute('href'), ctx);
    });
  } else {
    // 3D 로비든 폴백 링크 화면이든 상관없이 "구글 계정으로 방 복구/연결"
    // 자리를 둠 — 이미 연동된 계정이 있으면 버튼 대신 그 이메일을 보여주고,
    // GOOGLE_CLIENT_ID가 안 채워져 있으면 initGoogleAuth이 그냥 아무것도 안 그림.
    const unlinkEl = document.getElementById('googleUnlink');
    document.querySelectorAll('.google-btn').forEach((el) => initGoogleAuth(el, mine, unlinkEl));
  }

  // 방 이름(누구 방인지)과 테마 스위처는 방 정보를 받아와야 그릴 수 있음.
  // 조회가 실패해도 이름 없음 + 기본 테마로 그대로 그림.
  roomInfo
    .then((info) => (info && !info.missing ? info : null), () => null)
    .then((info) => {
      renderRoomName(ctx, info && info.name);
      // 3D 로비에만 있는 테마 스위처(폴백 링크 화면엔 #themePicker 자체가 없음).
      // 남의 방의 테마는 바꿀 수 없으니 내 방일 때만 그림.
      const picker = document.getElementById('themePicker');
      if (picker && !readOnly) renderThemePicker(picker, mine, (info && info.theme) || DEFAULT_THEME);
    });
});

// 헤더 제목을 방 이름으로 바꿔서 "누구 방인지" 보여줌(이름이 없으면 그냥 "로비").
// 내 방이면 제목을 클릭했을 때만 이름을 짓고 고치는 입력칸이 열리고(평소엔
// 숨김), 남의 방이면 읽기 전용이라 이름만 보임.
function renderRoomName(ctx, name) {
  const h1 = document.querySelector('#header h1');
  const showName = (n) => {
    if (h1) h1.textContent = n || '로비';
    document.title = n ? `${n} · 로비` : '로비';
  };
  showName(name);

  const box = document.getElementById('roomName');
  if (!box || ctx.readOnly) return;
  box.innerHTML = `
    <form class="room-name-form" hidden>
      <input type="text" maxlength="20" placeholder="방 이름 (최대 20자)" aria-label="방 이름">
      <button type="submit">저장</button>
    </form>
  `;
  const form = box.querySelector('.room-name-form');
  const input = form.querySelector('input');
  const btn = form.querySelector('button');
  input.value = name || '';

  const openForm = () => { form.hidden = false; input.focus(); input.select(); };
  const closeForm = () => { form.hidden = true; };
  if (h1) {
    // 제목 자체가 버튼 역할: 클릭(또는 Enter/Space)하면 입력칸이 열리고 닫힘.
    h1.classList.add('editable');
    h1.tabIndex = 0;
    h1.setAttribute('role', 'button');
    h1.title = '클릭해서 방 이름 바꾸기';
    const toggle = () => (form.hidden ? openForm() : closeForm());
    h1.addEventListener('click', toggle);
    h1.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeForm(); });

  const flash = (label) => {
    btn.textContent = label;
    setTimeout(() => { btn.textContent = '저장'; }, 1200);
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    btn.disabled = true;
    fetch(`${roomApi(ctx)}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Room-Token': ctx.mine.token },
      body: JSON.stringify({ name: input.value.trim() }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((saved) => { showName(saved.name); input.value = saved.name || ''; closeForm(); })
      .catch(() => flash('실패'))
      .finally(() => { btn.disabled = false; });
  });
}

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
          alert('내 방을 이 서버에서 찾을 수 없어요. 새 방을 만들게요.');
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

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

  const { scene, interactiveGroups, updateMotes, updateTurntable, updateBall, kickBall, setSketchbookPreview, setFeaturedSong, setFeaturedWorks, setLibraryBooks } = buildScene(theme);

  // 이젤 보드에 지금 보는 방의 1페이지 그림을 채워넣음. 실시간 동기화는
  // 필요 없어서(로비에서 그리는 기능도 없음) 로드 시 한 번만 조회. 읽기는
  // 방 코드만 있으면 되니 남의 방이어도 그대로 동작함.
  fetch(`${roomApi(ctx)}/pages/1`)
    .then((res) => (res.ok ? res.json() : null))
    .then((page) => { if (page) setSketchbookPreview(page.strokes || []); })
    .catch(() => {}); // 실패해도 이젤은 그냥 빈 종이로 남아있을 뿐, 로비 자체는 멀쩡히 작동함

  // 턴테이블에 대표곡(가장 최근에 추가한 음악 기록)을 채워넣음 —
  // 목록은 이미 최신순 정렬이라 첫 번째 항목이 곧 최신곡.
  fetch(`${roomApi(ctx)}/records?cat=music`)
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
  fetch(`${roomApi(ctx)}/records`)
    .then((res) => (res.ok ? res.json() : []))
    .then((records) => {
      const list = records || [];
      const works = list.filter((r) => r.cat !== 'music');
      // list.find를 음악 포함 전체에서 찾으면(list) 음악 기록이 featured로
      // 지정된 경우(백엔드는 카테고리를 안 가림 — library/list.js UI에서만
      // 막아둠) 액자에 노래가 걸려버리고, 그럼 mid가 works의 원소가 아니게
      // 돼서 바로 아래 rest 필터링도 아무것도 못 거름 — works에서만 찾음.
      const mid = works.find((r) => r.featured) || works[0];
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
