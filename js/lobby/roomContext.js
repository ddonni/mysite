// "지금 로비에 어떤 방을 띄워야 하는가"를 한 번만 계산해서, 그걸
// 기준으로 페이지/방 API 주소를 만드는 헬퍼들. main.js의 여러 곳
// (헤더 UI, 3D 씬 데이터 로드, 페이지 이동)이 전부 이 하나의 ctx를
// 공유해서 써야 서로 다른 방을 가리키는 일이 없음.
import { getMyRoom, getViewingRoomCode } from '../shared/room.js';
import { API_BASE } from '../shared/config.js';

// 지금 화면에 띄울 방: 주소에 ?room=코드가 있으면 그 방(남의 방 — 이 경우
// 로비의 모든 게 읽기 전용), 없으면 내 방. 모듈을 불러오는 시점에 한 번만
// 계산해서, main.js의 여러 곳이 이 같은 프로미스를 공유해 씀.
export const roomContext = getMyRoom().then((mine) => {
  const viewingCode = getViewingRoomCode(mine.code);
  return { mine, viewingCode, readOnly: viewingCode !== mine.code };
});

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

// 로비 자체로 가는 주소 — "방 코드로 방문" 폼과 "내 방으로"가 씀.
export function lobbyUrl(code, myCode) {
  return code === myCode ? './' : './?room=' + encodeURIComponent(code);
}
