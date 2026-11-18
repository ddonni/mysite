// "지금 로비에 어떤 방을 띄워야 하는가"를 한 번만 계산해서, 그걸
// 기준으로 페이지/방 API 주소를 만드는 헬퍼들. main.js의 여러 곳
// (헤더 UI, 3D 씬 데이터 로드, 페이지 이동)이 전부 이 하나의 ctx를
// 공유해서 써야 서로 다른 방을 가리키는 일이 없음.
import { getMyRoom } from '../shared/room.js';
import { API_BASE } from '../shared/config.js';

// 기억 보관소는 **늘 내 방이 가운데**(2026-11-18 사용자 결정 — 바깥 이웃 서가에 다른 방들이 같이 나와서 "남의
// 보관소"라는 개념을 없앰). 주소의 ?room=코드는 "그 이웃 서가를 맨 앞에 놓고 비춰 달라"는 뜻(focusCode)으로만
// 쓰고, 주소에서는 바로 지움 — 위 메뉴(roomNav)·서랍이 남의 방을 보는 중으로 착각하지 않게.
const params = new URLSearchParams(location.search);
const urlRoom = (params.get('room') || '').trim().toUpperCase() || null;
if (params.has('room')) {
  params.delete('room');
  const q = params.toString();
  history.replaceState(history.state, '', location.pathname + (q ? `?${q}` : '') + location.hash);
}

export const roomContext = getMyRoom().then((mine) => ({
  mine,
  viewingCode: mine.code,
  readOnly: false,
  focusCode: urlRoom && urlRoom !== mine.code ? urlRoom : null,
}));

// 지금 보는 방의 API 주소. 코드는 주소창(?room=)에서 온 값이라 아무 문자열일
// 수 있어서, 경로에 그대로 끼우면 `/`나 `?` 때문에 엉뚱한 경로를 조회하게 될
// 수 있음 — 인코딩해서 항상 "방 하나"를 가리키게 함.
export function roomApi({ viewingCode }) {
  return `${API_BASE}/api/rooms/${encodeURIComponent(viewingCode)}`;
}

// 지금 보는 방의 정보(테마, 이름). 헤더(이름/테마 스위처)와 씬 생성이 둘 다
// 필요로 해서 요청을 한 번만 보냄. 코드가 서버에 없으면(404) { missing:
// true, own } — own은 그게 남의 방이 아니라 "내 방"인 경우를 구분함(로컬/
// 운영 서버를 오가며 테스트했거나 방이 실제로 사라진 경우 등).
export const roomInfo = roomContext.then((ctx) =>
  fetch(roomApi(ctx)).then((res) => {
    if (res.status === 404) return { missing: true, own: !ctx.readOnly };
    return res.ok ? res.json() : null;
  })
);

// 지금 보는 방의 기록 전체(최신순). 3D 가구 채우기(loadRoomIntoScene.js)와 처음 온
// 사람 안내(onboarding.js — 빈 방인지, 어느 카테고리가 비었는지)가 같이 써서 한 번만
// 받음. 실패하면 null — 쓰는 쪽은 "모름"으로 보고 안내를 안 띄움.
export const roomRecords = roomContext.then((ctx) =>
  fetch(`${roomApi(ctx)}/records`).then((res) => (res.ok ? res.json() : null), () => null)
);

// 남의 방을 구경하는 사람의 "내 방"이 아직 비어 있는지(기록 0개). 비었으면 "나도 내 방
// 만들기", 아니면 "내 방으로 돌아가기"로 안내함(roomChrome.js의 머리말 버튼). 위 roomRecords는 "지금 보는 방"의 기록이라 따로 한 번 더 받음 — 내 방을 보는
// 중엔 요청하지 않음. 내 방을 보는 중이거나 조회에 실패하면 null(모름).
export const myRoomEmpty = roomContext.then((ctx) => {
  if (!ctx.readOnly) return null;
  return fetch(`${API_BASE}/api/rooms/${encodeURIComponent(ctx.mine.code)}/records`)
    .then((res) => (res.ok ? res.json() : null), () => null)
    .then((records) => (Array.isArray(records) ? records.length === 0 : null));
});

// 이웃 서가에 놓을 공개 방들(GET /api/rooms — 최근 활동순, 방마다 인생작 최대 12개). 실패하면 빈 목록.
// ?room=으로 가리킨 방이 목록에 없으면(비공개거나 인생작이 없음) 그 방 기록에서 인생작(없으면 최근 것) 12개로
// 하나 만들어 맨 앞에 붙임 — 받은 링크는 공개 여부와 상관없이 늘 그 사람 서가가 보이게.
export const publicRooms = roomContext.then(async (ctx) => {
  const list = await fetch(`${API_BASE}/api/rooms`).then((res) => (res.ok ? res.json() : []), () => []);
  const rooms = Array.isArray(list) ? list : [];
  const code = ctx.focusCode;
  if (!code || rooms.some((r) => r.code === code && r.featured && r.featured.length)) return rooms;
  const base = `${API_BASE}/api/rooms/${encodeURIComponent(code)}`;
  const [info, records] = await Promise.all([
    fetch(base).then((res) => (res.ok ? res.json() : null), () => null),
    fetch(`${base}/records`).then((res) => (res.ok ? res.json() : null), () => null),
  ]);
  if (!info || !Array.isArray(records) || !records.length) return rooms;
  const featured = records.filter((r) => r.featured);
  const works = (featured.length ? featured : records).slice(0, 12)
    .map(({ id, cat, title, photo_url }) => ({ id, cat, title, photo_url }));
  return [{ code, name: info.name, avatar_url: info.avatar_url, featured: works }, ...rooms.filter((r) => r.code !== code)];
});

// 이웃 방 기록 전체(표지를 눌러 감상·별점을 보여 줄 때) — 방마다 한 번만 받음.
const neighborRecordCache = new Map();
export function neighborRecords(code) {
  if (!neighborRecordCache.has(code)) {
    neighborRecordCache.set(code, fetch(`${API_BASE}/api/rooms/${encodeURIComponent(code)}/records`)
      .then((res) => (res.ok ? res.json() : []), () => []));
  }
  return neighborRecordCache.get(code);
}

// 위 값에 맞는 버튼 문구. 모를 땐(null) "돌아가기" — 방은 이미 이 브라우저에 있음.
export const MY_ROOM_EMPTY_LABEL = '나도 내 방 만들기';
export const MY_ROOM_BACK_LABEL = '내 방으로 돌아가기';
export function myRoomLabel(empty) {
  return empty === true ? MY_ROOM_EMPTY_LABEL : MY_ROOM_BACK_LABEL;
}

// sketchbook.html/library.html로 넘어갈 때, 남의 방을 보던 중이면 ?room=을
// 이어 붙여서 거기서도 그 방을 읽기 전용으로 보게 함. page에 이미
// 쿼리(예: library.html?cat=music)가 있을 수 있어서 ?와 &를 구분함.
export function pageUrl(page, { mine, viewingCode }) {
  if (viewingCode === mine.code) return page;
  return page + (page.includes('?') ? '&' : '?') + 'room=' + encodeURIComponent(viewingCode);
}

// 3D 방 자체로 가는 주소 — "방 코드로 방문" 폼과 "내 방으로"가 씀. 3D 방은 2026-11-18부터 첫 화면(카드)이
// 아니라 lobby.html이라 './'가 아니라 'lobby'.
export function lobbyUrl(code, myCode) {
  return code === myCode ? 'lobby' : 'lobby?room=' + encodeURIComponent(code);
}
