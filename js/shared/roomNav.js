// 네 페이지(로비/캔버스/기록 보관소/둘러보기)가 같이 쓰는 상단 메뉴(.site-nav)와 왼쪽 서랍.
// 위 줄엔 어디서든 바로 가는 곳만 둠(홈 · 캔버스 · 책 · 애니 · 영화 · 음악 — html에 그대로
// 적혀 있음). 예전엔 방 코드·방문 폼·의견 보내기까지 한 줄에 있어서, 폰에선 줄이 옆으로
// 밀리며 "내 방으로" 같은 게 화면 밖에 숨었음 — 그런 나머지는 메뉴 버튼(☰)을 누르면 나오는
// 서랍으로 옮김: "지금 어느 방을 보고 있는가"(코드·링크 복사, 남의 방이면 내 방으로
// 돌아가기), 기록 보관소 전체, 방 둘러보기, 의견 보내기, 방 코드로 방문.
import { getMyRoom, getViewingRoomCode, roomLink, roomShareUrl, roomTitle } from './room.js';
import { copyToClipboard } from './dom.js';
import { API_BASE, DEVELOPER_ROOM_CODE } from './config.js';
import { openFeedback } from './feedback.js';

// 메뉴 높이를 CSS 변수 --nav-h로 알려줘서, 각 페이지가 그 아래로 본문/헤더를 내릴 수 있게 함.
function trackNavHeight(navEl) {
  const set = () => document.documentElement.style.setProperty('--nav-h', navEl.offsetHeight + 'px');
  set();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(set).observe(navEl);
  else window.addEventListener('resize', set);
}

// 아주 좁은 폰에선 위 줄도 옆으로 밀릴 수 있음(nav.css) — 가려진 쪽 끝을 흐리게 해서
// 더 있다는 걸 알림(can-left/can-right 클래스 → CSS 마스크).
function trackNavScroll(navEl) {
  const update = () => {
    const max = navEl.scrollWidth - navEl.clientWidth;
    navEl.classList.toggle('can-left', navEl.scrollLeft > 2);
    navEl.classList.toggle('can-right', max > 2 && navEl.scrollLeft < max - 2);
  };
  update();
  navEl.addEventListener('scroll', update, { passive: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(update).observe(navEl);
  else window.addEventListener('resize', update);
}

const MENU_ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
// 글자 화살표(‹) 대신 — 로비 머리말의 "내 방으로 돌아가기"(roomChrome.js)와 같은 꺾쇠.
const CHEVRON_LEFT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>';

// 서랍 뼈대 — 방 정보 자리(.drawer-room)는 내 방을 알아낸 뒤(getMyRoom) 채움. 링크는 서버를
// 기다리지 않고 바로 쓸 수 있게 먼저 그림.
function buildDrawer() {
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'navDrawer';
  drawer.innerHTML = `
    <div class="nav-drawer-panel" role="dialog" aria-modal="true" aria-label="메뉴">
      <div class="drawer-head">
        <span class="drawer-title">메뉴</span>
        <button type="button" class="drawer-close" aria-label="메뉴 닫기">${MENU_ICON_CLOSE}</button>
      </div>
      <div class="drawer-room"></div>
      <div class="drawer-links">
        <a data-page="./" href="./">홈</a>
        <a data-page="rooms" href="rooms">방 둘러보기</a>
        <button type="button" class="drawer-feedback">의견 보내기</button>
      </div>
      <form class="room-visit">
        <input type="text" maxlength="6" placeholder="방 코드로 방문" aria-label="방 코드">
        <button type="submit">이동</button>
      </form>
    </div>`;
  document.body.appendChild(drawer);
  return drawer;
}

function wireDrawer(drawer, menuBtn) {
  const panel = drawer.querySelector('.nav-drawer-panel');
  let returnFocus = null;
  const isOpen = () => drawer.classList.contains('open');
  function open() {
    returnFocus = document.activeElement;
    drawer.classList.add('open');
    document.body.classList.add('drawer-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    const first = panel.querySelector('.drawer-room a, .drawer-room button, .drawer-links a');
    (first || panel.querySelector('.drawer-close')).focus();
  }
  function close() {
    if (!isOpen()) return;
    drawer.classList.remove('open');
    document.body.classList.remove('drawer-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }
  if (menuBtn) menuBtn.addEventListener('click', () => (isOpen() ? close() : open()));
  drawer.querySelector('.drawer-close').addEventListener('click', close);
  // 어두운 바깥을 눌러도 닫힘.
  drawer.addEventListener('click', (e) => { if (e.target === drawer) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // 서랍 안의 링크·"의견 보내기"를 누르면 서랍은 닫고 그 일을 함.
  drawer.querySelector('.drawer-links').addEventListener('click', (e) => {
    if (e.target.closest('a, button')) close();
  });
  drawer.querySelector('.drawer-feedback').addEventListener('click', openFeedback);
  return { open, close };
}

// "지금 어느 방을 보고 있는가" — 서랍 맨 위. 내 방이면 코드 + 링크 복사, 남의 방이면
// 무슨 방인지 + 내 방으로 돌아가기.
function renderRoomBox(el, { mine, viewingCode, readOnly, currentPage }) {
  // 보고 있는 방이 "개발자의 방"(config.js — 로비 왼쪽 아래 링크로 들어옴)이면 코드 대신 그렇게 표시함.
  const viewingDev = !!DEVELOPER_ROOM_CODE && viewingCode === DEVELOPER_ROOM_CODE.toUpperCase();
  if (readOnly) {
    el.innerHTML = `
      <span class="room-tag readonly"><span class="viewing-label"></span> 보는 중 · 읽기 전용</span>
      <a class="room-home" href="${roomLink(currentPage, mine.code, mine.code)}">${CHEVRON_LEFT}내 방으로 돌아가기</a>`;
    // 주소창의 ?room= 값이라 아무 문자열이나 들어올 수 있음 — innerHTML에 직접 끼우지 않고
    // textContent로 넣어서 HTML 주입을 막음.
    const label = el.querySelector('.viewing-label');
    if (viewingDev) {
      label.textContent = '개발자의 방';
    } else {
      label.append('방 ');
      const b = document.createElement('b');
      b.textContent = viewingCode;
      label.append(b);
    }
    return;
  }
  el.innerHTML = `
    <span class="room-tag mine">내 방 코드 <b>${mine.code}</b></span>
    <button class="room-copy" type="button">링크 복사</button>`;
  const copyBtn = el.querySelector('.room-copy');
  copyBtn.addEventListener('click', () => {
    copyToClipboard(roomShareUrl(mine.code))
      .then(() => { copyBtn.textContent = '복사됨'; setTimeout(() => { copyBtn.textContent = '링크 복사'; }, 1500); })
      .catch(() => {});
  });
}

// 지금 보는 방이 누구 방인지 한 줄로 — 페이지의 [data-room-label] 자리(기록 보관소 제목 위,
// 캔버스 왼쪽 아래)에 채움. 위 줄 메뉴엔 방 표시가 없어서, 남의 방을 보다 내 방으로 넘어가도
// 몰라서 "기록이 다 사라졌다"고 느꼈음(사용자 피드백) — 어느 페이지에서든 늘 보이게 함.
function fillRoomLabels({ viewingCode, readOnly, viewingDev }) {
  const els = document.querySelectorAll('[data-room-label]');
  if (!els.length) return;
  const set = (text) => els.forEach((el) => {
    el.textContent = text;
    el.classList.toggle('visiting', readOnly);
  });
  if (!readOnly) { set('내 방'); return; }
  if (viewingDev) { set('개발자의 방'); return; }
  set(roomTitle(null)); // 이름을 받아 오기 전·못 받으면 "친구의 방"
  fetch(`${API_BASE}/api/rooms/${encodeURIComponent(viewingCode)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((info) => { if (info) set(roomTitle(info.name)); })
    .catch(() => {});
}

// 위 줄의 카테고리(책 · 애니 · 영화 · 음악) 중 지금 보는 것을 표시 — 기록 보관소에서만.
// 기록 보관소 안에서 탭을 바꾸면 library/main.js가 다시 불러서 맞춤.
export function setActiveCat(navEl, cat) {
  navEl.querySelectorAll('a[data-cat]').forEach((a) => a.classList.toggle('active', a.dataset.cat === cat));
}

// currentPage: 지금 페이지 자신의 주소(예: 'sketchbook') — "방 코드로 방문"이나 "내 방으로"를
// 누르면 같은 페이지를 그 방으로 다시 여는 데 씀.
export function initRoomNav({ navEl, currentPage }) {
  const drawer = buildDrawer();
  wireDrawer(drawer, navEl.querySelector('.nav-menu'));
  trackNavHeight(navEl);
  trackNavScroll(navEl);
  if (currentPage === 'library') setActiveCat(navEl, new URLSearchParams(location.search).get('cat'));

  return getMyRoom().then((mine) => {
    const viewingCode = getViewingRoomCode(mine.code);
    const readOnly = viewingCode !== mine.code;

    // 페이지 사이를 오갈 때도 지금 보고 있는 방을 유지 — 위 줄·서랍뿐 아니라 페이지 안의
    // data-page 링크(로비의 3D 대신 뜨는 링크 화면 등)까지. 둘러보기(rooms)도 보던 방을 들고
    // 다님: 예전엔 둘러보기를 거치면 ?room=이 빠져서, 거기서 다른 메뉴를 누르면 말없이 내
    // 빈 방으로 넘어갔음.
    document.querySelectorAll('a[data-page]').forEach((a) => {
      a.href = roomLink(a.dataset.page, viewingCode, mine.code);
    });

    const viewingDev = !!DEVELOPER_ROOM_CODE && viewingCode === DEVELOPER_ROOM_CODE.toUpperCase();
    fillRoomLabels({ viewingCode, readOnly, viewingDev });
    renderRoomBox(drawer.querySelector('.drawer-room'), { mine, viewingCode, readOnly, currentPage });

    const visitForm = drawer.querySelector('.room-visit');
    visitForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = visitForm.querySelector('input').value.trim().toUpperCase();
      if (code) window.location.href = roomLink(currentPage, code, mine.code);
    });

    return { mine, viewingCode, readOnly };
  });
}
