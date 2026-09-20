// "이 브라우저(기기)가 자기 방으로 여기는 방"을 관리하는 모듈.
// 로그인이 없는 대신, 처음 방문하면 서버에 방을 하나 만들어서 그
// code(공개, URL에 씀)와 token(비밀, 쓰기 요청에만 씀)을 이 기기의
// localStorage에 저장해두고 계속 재사용함. 다른 기기로 옮기고 싶으면
// ?code=...&token=... 링크로 한 번 열면 됨(claimFromUrl).
import { API_BASE } from './config.js';

const KEY = 'untitled-canvas.my-room';

function readStored() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
}

function writeStored(room) {
  try { localStorage.setItem(KEY, JSON.stringify(room)); } catch (e) {}
}

// ?code=X&token=Y로 열리면 그 방을 "내 방"으로 저장하고 주소창에서
// 지움 — 다른 기기로 방을 옮기거나, 서버 마이그레이션으로 발급된
// 기존 데이터의 방을 처음 한 번 넘겨받을 때 쓰는 통로.
(function claimFromUrl() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const token = params.get('token');
  if (!code || !token) return;
  writeStored({ code: code.toUpperCase(), token });
  params.delete('code');
  params.delete('token');
  const rest = params.toString();
  history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
})();

let creating = null;

// 지금 이 브라우저가 갖고 있는 방을 읽기만 함(없으면 null) — getMyRoom과
// 달리 없다고 새로 만들지 않음. googleAuth.js가 "구글 계정으로 복구"
// 요청을 보낼 때 "지금 브라우저의 방"을 함께 실어 보내는 데 씀.
export function getStoredRoom() {
  return readStored();
}

// 구글 계정으로 되찾아온(또는 새로 연결한) {code, token}을 이 브라우저의
// "내 방"으로 덮어씀. googleAuth.js 전용 — 그 외엔 getMyRoom()이 이미
// 갖고 있는 방을 그대로 쓰면 되니 이 함수를 부를 일이 없음.
export function adoptRoom(room) {
  writeStored(room);
}

// 내 방의 {code, token}을 반환. 아직 없으면 서버에 새로 만듦. 여러
// 모듈이 동시에 불러도 방 생성 요청은 한 번만 나가도록 캐싱해둠.
export function getMyRoom() {
  const stored = readStored();
  if (stored && stored.code && stored.token) return Promise.resolve(stored);
  if (!creating) {
    creating = fetch(API_BASE + '/api/rooms', { method: 'POST' })
      .then((res) => res.json())
      .then((room) => { writeStored(room); return room; });
  }
  return creating;
}

// 지금 화면에 띄워야 할 방 코드: 주소의 ?room=이 있으면 그 방(남의
// 방일 수 있음, 읽기 전용), 없으면 내 방.
export function getViewingRoomCode(myCode) {
  const code = new URLSearchParams(location.search).get('room');
  return code ? code.toUpperCase() : myCode;
}

// sketchbook.html/library.html/index.html 사이를 오갈 때 지금 보고
// 있는 방을 이어서 넘겨주기 위한 링크 헬퍼. 내 방을 보고 있을 땐
// 굳이 ?room=을 안 붙임(URL이 더 짧고 깔끔함).
export function roomLink(page, viewingCode, myCode) {
  return viewingCode && viewingCode !== myCode ? `${page}?room=${viewingCode}` : page;
}
