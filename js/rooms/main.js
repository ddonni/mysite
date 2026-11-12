// "방 둘러보기" 페이지(rooms.html)의 시작점 — 방 주인이 공개로 켠 방들을
// 카드로 보여주고, 누르면 그 방(첫 화면)에 읽기 전용으로 놀러 감. 목록은 서버
// GET /api/rooms가 정함(공개 + 기록 있는 방, 최근 활동순).
// 위쪽엔 내 방의 공개 스위치도 둬서 여기서 바로 켜고 끌 수 있게 함.
import { API_BASE, DEVELOPER_ROOM_CODE } from '../shared/config.js';
import { initRoomNav } from '../shared/roomNav.js';
import { roomLink } from '../shared/room.js';
import { escapeHtml } from '../shared/dom.js';
import { renderVisibilityToggle } from '../shared/visibilityToggle.js';
import { watchForSlow, SLOW_MESSAGE } from '../shared/slow.js';

const CATS = [
  { key: 'book', label: '책' },
  { key: 'anime', label: '애니' },
  { key: 'movie', label: '영화·시리즈' },
  { key: 'music', label: '음악' },
];
// 카드 위 띠 색 — 그 방 테마의 벽/러그 색(예전 3D 방의 테마 색. 3D 방은 없어졌지만 방마다
// 테마 값이 서버에 남아 있어서 목록 카드의 색으로만 씀).
const THEME_COLORS = {
  wood: ['#cdbfa4', '#5a2e22'],
  night: ['#3a4759', '#2c3a5c'],
  pastel: ['#f1d9ce', '#d98f88'],
};

const listEl = document.getElementById('roomList');
const metaEl = document.getElementById('roomsMeta');

function fetchPublicRooms() {
  return fetch(`${API_BASE}/api/rooms`).then((res) => {
    if (!res.ok) throw new Error('rooms_failed');
    return res.json();
  });
}

function roomCard(room, mine) {
  const a = document.createElement('a');
  a.className = 'room-card';
  a.href = roomLink('./', room.code, mine.code);
  const [wall, rug] = THEME_COLORS[room.theme] || THEME_COLORS.wood;
  a.style.setProperty('--wall', wall);
  a.style.setProperty('--rug', rug);
  const isMine = room.code === mine.code;
  const isDev = !!DEVELOPER_ROOM_CODE && room.code === DEVELOPER_ROOM_CODE.toUpperCase();
  const tag = isMine ? '<span class="room-badge mine">내 기록</span>'
    : isDev ? '<span class="room-badge dev">개발자의 기록</span>' : '';
  const counts = CATS.filter((c) => room.counts[c.key])
    .map((c) => `<span class="room-count" data-cat="${c.key}"><i class="dot"></i>${c.label} ${room.counts[c.key]}</span>`)
    .join('');
  a.innerHTML = `
    <span class="room-band" aria-hidden="true"></span>
    <span class="room-body">
      <span class="room-head">
        <span class="room-name">${room.name ? escapeHtml(room.name) : '이름 없는 기록'}</span>
        ${tag}
      </span>
      <span class="room-code">${escapeHtml(room.code)}</span>
      <span class="room-counts">${counts}</span>
      <span class="room-go">${isMine ? '내 기록으로 →' : '구경하기 →'}</span>
    </span>
  `;
  return a;
}

function render(rooms, mine) {
  metaEl.textContent = rooms.length ? `공개된 기록 ${rooms.length}개` : '아직 공개된 기록이 없어요';
  listEl.innerHTML = '';
  if (!rooms.length) {
    listEl.innerHTML = '<div class="empty">아직 공개된 기록이 없어요. 내 기록을 공개해서 첫 번째가 되어 보세요.</div>';
    return;
  }
  rooms.forEach((r) => listEl.appendChild(roomCard(r, mine)));
}

initRoomNav({ navEl: document.querySelector('.site-nav'), currentPage: 'rooms' }).then(({ mine }) => {
  const stopWatch = watchForSlow(() => { metaEl.textContent = SLOW_MESSAGE; });
  const load = () => fetchPublicRooms()
    .then((rooms) => render(rooms, mine))
    .catch(() => {
      metaEl.textContent = '';
      listEl.innerHTML = '<div class="empty">기록 목록을 불러오지 못했어요. 새로고침해 보세요.</div>';
    });
  load().finally(stopWatch);

  // 내 방 공개 스위치 — 바꾸면 목록도 다시 불러와서 내 방이 뜨고/빠지는 걸 바로 보여줌.
  fetch(`${API_BASE}/api/rooms/${mine.code}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((info) => {
      if (!info) return;
      const box = document.getElementById('myVisibility');
      box.hidden = false;
      renderVisibilityToggle(document.getElementById('visibilityBox'), mine, info.is_public, { onChange: load });
    })
    .catch(() => {});
});
