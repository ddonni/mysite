// 3D 방 = 기억 보관소(lobby.html)의 시작점. 2026-11-18 사용자 요청으로 둥근 방(가구)을 통째로 바꿈 —
// 영화 속 기억 보관소처럼 끝없는 서가에 기록이 하나씩 꽂힘(책은 책, 영화·애니는 포스터, 음악은 앨범 —
// archive/covers.js. 같은 날 구슬 → 책·포스터로 바꿈).
//   - 진열 = 카테고리 구분 없이 기록한 날짜 순(archive/layout.js).
//   - 지도처럼 둘러보기(archive/controls.js — 기본은 위에서 내려다보기), 기록을 누르면 눈앞으로 날아와
//     크게(archive/heldCover.js) + 옆에 그 기록(패널).
//   - 입구 옆 이젤 → 캔버스(캔버스는 3D 방에서만 들어감).
//   - 가운데는 늘 내 서가, 바깥엔 공개된 다른 방들의 이웃 서가(archive/neighbors.js) — 남의 보관소 화면은 없음.
//     lobby?room=코드로 오면 그 이웃 서가를 맨 앞에 두고 비춤.
// 옛 둥근 방(가구)은 git 브랜치 3d-room에 있음.
//
// 머리말·서랍(roomChrome.js), "지금 보는 방"(roomContext.js), 처음 온 사람 안내(helpDialog.js·onboarding.js)는
// 각자 모듈 — 이 파일은 순서대로 연결만 함.
import { buildArchiveScene } from './archive/scene.js';
import { SHELF } from './archive/layout.js';
import { createOrbitControls } from './archive/controls.js';
import { createHeldCover } from './archive/heldCover.js';
import { roomContext, roomInfo, roomRecords, roomApi, pageUrl, publicRooms } from './roomContext.js';
import { initRoomChrome } from './roomChrome.js';
import { webglAvailable } from './webgl.js';
import { initHelpDialog } from './helpDialog.js';
import { initEmptyRoom } from './onboarding.js';
import { forgetMyRoom } from '../shared/room.js';
import { initRoomNav } from '../shared/roomNav.js';
import { watchForSlow, SLOW_MESSAGE } from '../shared/slow.js';
import { getPlayer } from '../shared/youtube.js';
import { catLabel, featureLabel, progressLabel } from '../library/list/itemFormat.js';

const help = initHelpDialog();
// 아이폰은 touch-action만으로는 두 손가락 페이지 확대를 다 못 막아서 확대 제스처 이벤트도 막음
// (보관소의 두 손가락 걷기는 pointer 이벤트로 받음).
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
});

initEmptyRoom();
initRoomNav({ navEl: document.querySelector('.site-nav'), currentPage: 'lobby' }).catch(() => {});
roomContext.then(initRoomChrome);

if (typeof THREE === 'undefined' || !webglAvailable()) {
  document.body.classList.add('no-3d');
  help.showIfFirstVisit();
} else {
  boot().catch((e) => {
    const msg = document.getElementById('fallbackMessage');
    if (msg) msg.textContent = '지금 서버에 연결할 수 없어요. 아래 링크로 바로 이동해 주세요.';
    document.body.classList.add('no-3d');
    console.error('archive init failed', e);
  });
}

// 방 정보·기록을 받은 뒤에야 서가 길이(기록 수)를 정할 수 있어서 다 기다림. 방이 없으면(404) 안내.
function boot() {
  const loadingEl = document.getElementById('loading');
  const stopWatch = watchForSlow(() => { loadingEl.textContent = SLOW_MESSAGE; });
  return Promise.all([roomContext, roomInfo, roomRecords, publicRooms])
    .then(([ctx, info, records, rooms]) => {
      if (info && info.missing) { // 가운데는 늘 내 방이라 "내 방이 없어진" 경우뿐
        alert('내 방을 찾지 못했어요. 새 방을 하나 만들게요.');
        forgetMyRoom();
        window.location.reload();
        return;
      }
      if (!Array.isArray(records)) throw new Error('records unavailable');
      start(ctx, records, rooms);
    })
    .finally(stopWatch);
}

const fmtDate = (d) => (d ? d.replace(/-/g, '.') : '');
const starsText = (r) => (r ? `★ ${r.toFixed(1)}` : '');

function start(ctx, records, neighborRooms) {
  const canvasEl = document.getElementById('canvas3d');
  const stage = document.getElementById('stage');
  const ui = document.getElementById('ui');
  const loading = document.getElementById('loading');

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 140);

  const archive = buildArchiveScene(records, neighborRooms);
  const { covers, neighbors } = archive;
  const nCovers = neighbors.covers;
  // 이젤에 이 방 캔버스 1페이지 그림(실패해도 빈 종이로 둠).
  fetch(`${roomApi(ctx)}/pages/1`)
    .then((res) => (res.ok ? res.json() : null))
    .then((page) => { if (page) archive.easel.userData.setPreview(page.strokes || []); })
    .catch(() => {});
  const held = createHeldCover(archive.scene, camera);

  const count = document.getElementById('orbCount');
  if (count && records.length) {
    count.textContent = `기록 ${records.length}개`;
    count.hidden = false;
  }

  // 서가의 한 칸 = { set: 표지 묶음(내 것 covers / 이웃 것 nCovers), k: 그 안 번호, room: 이웃이면 그 방 }.
  function itemOf(hit) {
    let k = covers.indexOfHit(hit);
    if (k != null) return { kind: 'item', item: { set: covers, k, room: null } };
    k = nCovers.indexOfHit(hit);
    if (k != null) return { kind: 'item', item: { set: nCovers, k, room: neighbors.ownerOf(k) } };
    const room = neighbors.plateRoom(hit);
    return room ? { kind: 'plate', room } : null;
  }
  const ownerName = (room) => room.name || '친구';

  // ---- 마우스를 올린 기록의 제목 ----
  const tip = document.getElementById('orbTip');
  function hover(item, x, y) {
    const rec = item ? item.set.recordAt(item.k) : null;
    const show = rec && item.set.isShown(item.k) && !held.isOpen();
    covers.setHover(show && item.set === covers ? item.k : null);
    nCovers.setHover(show && item.set === nCovers ? item.k : null);
    if (!show) { tip.hidden = true; return; }
    tip.textContent = item.room ? `${rec.title} · ${ownerName(item.room)}` : rec.title + (rec.creator ? ` — ${rec.creator}` : '');
    tip.style.left = `${x + 14}px`;
    tip.style.top = `${y + 12}px`;
    tip.hidden = false;
  }

  // ---- 기록 꺼내 보기(내 것도 이웃 것도 같은 방식) ----
  const panel = document.getElementById('memory');
  const el = (id) => document.getElementById(id);
  const listenBtn = el('memListen');
  let current = null;
  let openedAt = 0;
  let player = null;
  let listenRec = null;
  const paintListen = () => { if (listenRec) listenBtn.textContent = player.current() === listenRec ? '■ 끄기' : '▶ 듣기'; };
  listenBtn.addEventListener('click', () => {
    if (!listenRec) return;
    if (player.current() === listenRec) player.close(); else player.play(listenRec);
  });
  function fillPanel(rec, room) {
    const tag = room
      ? [catLabel(rec.cat), `${ownerName(room)}의 ${featureLabel(rec.cat)}`]
      : [catLabel(rec.cat), rec.featured ? featureLabel(rec.cat) : ''];
    if (rec.in_progress && rec.cat !== 'music') tag.push(progressLabel(rec.cat));
    el('memTag').textContent = tag.filter(Boolean).join(' · ');
    el('memTitle').textContent = rec.title;
    el('memSub').textContent = rec.creator || '';
    el('memMeta').textContent = [starsText(rec.rating), fmtDate(rec.date)].filter(Boolean).join('   ');
    el('memMemo').textContent = rec.memo || '';
    el('memMemo').hidden = !rec.memo;
    el('memOpen').href = room ? `./?room=${encodeURIComponent(room.code)}&cat=${rec.cat}` : pageUrl(`./?cat=${rec.cat}`, ctx);
    el('memOpen').textContent = room ? `${ownerName(room)}의 카드 보기` : '카드로 보기';
    listenBtn.hidden = !(rec.cat === 'music' && rec.listen_url);
    listenRec = listenBtn.hidden ? null : rec;
    if (listenRec) {
      if (!player) { player = getPlayer({ where: 'top' }); player.onChange(paintListen); }
      paintListen();
    }
    panel.dataset.cat = rec.cat;
    panel.classList.toggle('featured', !room && !!rec.featured);
  }
  function openMemory(item) {
    const rec = item.set.recordAt(item.k);
    if (!rec || !item.set.isShown(item.k)) return;
    if (current) { closeMemory(() => openMemory(item)); return; }
    current = item;
    openedAt = performance.now();
    hover(null);
    controls.setEnabled(false);
    const wide = innerWidth > innerHeight && innerWidth >= 700;
    held.open(rec, item.set.positionOf(item.k), item.set.angleOf(item.k), item.set.colorOf(item.k), wide);
    item.set.hide(item.k);
    fillPanel(rec, item.room);
    panel.hidden = false;
    document.body.classList.add('memory-open');
    requestAnimationFrame(() => panel.classList.add('show'));
    el('memClose').focus({ preventScroll: true });
  }
  function closeMemory(then) {
    if (!current) { if (then) then(); return; }
    const item = current;
    current = null;
    panel.classList.remove('show');
    document.body.classList.remove('memory-open');
    setTimeout(() => { if (!current) panel.hidden = true; }, 250);
    held.close(() => {
      item.set.show(item.k);
      controls.setEnabled(true);
      if (then) then();
    });
  }
  el('memClose').addEventListener('click', () => closeMemory());
  // 꺼내 보는 동안 화면(3D) 아무 데나 누르면 다시 꽂음.
  // (기록을 연 바로 그 클릭은 빼고)
  canvasEl.addEventListener('click', () => {
    if (current && held.isOpen() && performance.now() - openedAt > 350) closeMemory();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (current) closeMemory();
    else hideEaselCard();
  });

  // ---- 이젤(캔버스) ----
  const card = document.getElementById('card');
  const canvasBtn = document.querySelector('#cta .canvas-go');
  function showEaselCard() {
    card.classList.add('show');
    canvasBtn.setAttribute('aria-pressed', 'true');
  }
  function hideEaselCard() {
    card.classList.remove('show');
    canvasBtn.setAttribute('aria-pressed', 'false');
  }
  document.getElementById('cardBack').addEventListener('click', hideEaselCard);
  document.getElementById('cardEnter').addEventListener('click', () => {
    stage.style.transition = ui.style.transition = 'opacity .35s ease';
    stage.style.opacity = ui.style.opacity = '0';
    setTimeout(() => { window.location.href = pageUrl('sketchbook', ctx); }, 320);
  });
  canvasBtn.addEventListener('click', () => {
    if (card.classList.contains('show')) { hideEaselCard(); return; }
    closeMemory();
    controls.focus(archive.easel.position, { r: 4.2, phi: 1.12, theta: archive.easel.rotation.y });
    showEaselCard();
  });


  // ---- 카테고리만 밝히기 ----
  const filterBtns = [...document.querySelectorAll('#cta [data-filter]')];
  filterBtns.forEach((b) => b.addEventListener('click', () => {
    closeMemory();
    const cat = b.dataset.filter || null;
    covers.setFilter(cat);
    nCovers.setFilter(cat);
    archive.refreshTowerGlow();
    filterBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (count) {
      const n = cat ? records.filter((r) => r.cat === cat).length : records.length;
      count.textContent = cat ? `${catLabel(cat)} ${n}개` : `기록 ${records.length}개`;
    }
  }));

  // ---- 시점 두 가지 ----
  //  - 가까이(처음 화면): 가장 최근 기록이 꽂힌 탑을 비스듬히 위에서 — 첫 화면에서 표지가 바로 보이게(2026-11-18 평가:
  //    전체를 내려다보면 표지가 점처럼 작아서 내 기록이라는 게 안 와닿았음).
  //  - 전체: 기록이 꽂힌 탑들을 위에서 내려다봄(사용자 결정 "기본은 위에서" — 버튼으로).
  const portrait = innerWidth < innerHeight;
  const perTower = archive.slots.length / archive.towers.length;
  const litTowers = Math.max(1, Math.ceil(records.length / perTower));
  const focusZ = archive.towers.slice(0, Math.min(archive.towers.length, litTowers + 1))
    .reduce((sum, t, _, arr) => sum + t.z / arr.length, 0);
  const overview = { target: new THREE.Vector3(0, 1.2, focusZ + 1), r: portrait ? 19 : 14, theta: 0, phi: 0.92 };
  const latest = archive.towers[covers.count ? covers.towerOf(covers.count - 1) : 0];
  const faceOut = 1.6; // 탑 가운데에서 앞면 바깥쪽으로 조금 — 서가 면을 바라봄
  // 그 탑에서 차 있는 줄들의 가운데 높이(아랫줄부터 차니까 덜 찬 탑이면 낮게 봄).
  const inLatest = covers.count ? covers.count - covers.towerOf(covers.count - 1) * perTower : 0;
  const rowsUsed = Math.max(1, Math.ceil(inLatest / SHELF.perRow));
  const lookY = Math.min(1.8, SHELF.baseY + (rowsUsed * SHELF.rowGap) / 2 + 0.15);
  const closeMine = {
    target: new THREE.Vector3(latest.x + Math.sin(latest.facing) * faceOut, lookY, latest.z + Math.cos(latest.facing) * faceOut),
    r: portrait ? 7.5 : 5.6,
    // 정면에서 통로 입구 쪽으로 50°쯤 돌아선 자리 — 정면이면 카메라가 맞은편 탑 안에 들어가 버렸음.
    theta: latest.facing + (latest.side < 0 ? -0.9 : 0.9),
    phi: 1.02,
  };
  // 기록이 하나도 없으면 가까이 볼 게 없어서(빈 선반만 까맣게 보였음) 전체 보기로 시작하고, "가까이 보기"는 가장
  // 가까운 이웃 서가로.
  const startOverview = covers.count === 0;
  const close = !startOverview ? closeMine : (neighbors.count && neighbors.viewOf(neighborRooms[0])) || overview;
  // lobby?room=코드로 왔으면(받은 링크·개발자의 방) 그 이웃 서가부터 비춤.
  const focusRoom = ctx.focusCode && neighborRooms.find((x) => x.code === ctx.focusCode);
  const home = (focusRoom && neighbors.viewOf(focusRoom)) || (startOverview ? overview : close);

  const controls = createOrbitControls({
    canvas: canvasEl,
    camera,
    pickables: archive.pickables,
    itemOf,
    easel: archive.easel,
    endZ: archive.worldEndZ,
    onPick: (item) => { hideEaselCard(); openMemory(item); },
    onPlate: (room) => {
      closeMemory();
      hideEaselCard();
      const v = neighbors.viewOf(room);
      if (v) controls.goView(v);
      atOverview = false;
      paintViewBtn();
    },
    onEasel: () => { closeMemory(); showEaselCard(); },
    onHover: hover,
    home,
  });
  // 아래 버튼: 지금 가까이면 "전체 보기", 전체면 "가까이 보기"(최근 기록 탑). 직접 움직여도 버튼은 다음에 갈 곳을 말함.
  const viewBtn = document.getElementById('viewHome');
  let atOverview = startOverview && !focusRoom;
  const paintViewBtn = () => { viewBtn.querySelector('span').textContent = atOverview ? '가까이 보기' : '전체 보기'; };
  paintViewBtn();
  viewBtn.addEventListener('click', () => {
    closeMemory();
    hideEaselCard();
    atOverview = !atOverview;
    controls.goView(atOverview ? overview : close);
    paintViewBtn();
  });

  function resize() {
    const w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // 세로 화면은 가로로 보이는 폭이 좁아서 시야를 넓힘.
    camera.fov = w < h ? 68 : 55;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    requestAnimationFrame(tick);
    controls.update(dt);
    archive.setViewDistance(controls.distance());
    archive.update(dt);
    held.update(dt);
    renderer.render(archive.scene, camera);
  }
  renderer.compile(archive.scene, camera);
  requestAnimationFrame(tick);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    loading.classList.add('hide');
    setTimeout(() => help.showIfFirstVisit(), 700);
  }));
}
