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
