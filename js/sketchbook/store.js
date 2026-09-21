// "그림을 어디에 저장하는가" 만 담당하는 모듈.
//
// 두 가지 저장소 구현체가 있고, 나머지 코드(canvas.js, pager.js …)는
// 어느 쪽을 쓰는지 전혀 신경 쓰지 않음 — 왜냐하면 둘 다 아래와 똑같은
// "인터페이스"(메서드 이름과 반환값 모양)를 맞춰뒀기 때문:
//
//   getPage(n)            -> Promise<그 페이지의 획(stroke) 배열>
//   setPage(n, strokes)   -> 그 페이지를 통째로 덮어써서 저장
//   subscribePage(n, cb)  -> 실시간으로 바뀌면 cb(strokes) 호출, 반환값은 "구독 끊기" 함수
//   shared                -> true면 "여러 기기가 공유하는 저장소"(=서버), false면 "이 기기만의 저장소"
//
// 이렇게 인터페이스를 맞춰두면 서버가 꺼져 있을 때 local 저장소로
// 자연스럽게 "폴백"할 수 있음 — 호출하는 쪽 코드는 바꿀 필요가 없음.

import { API_BASE } from '../shared/config.js';

const WS_BASE = API_BASE.replace(/^http/, 'ws');

// localStorage 키에 페이지 번호를 6자리로 맞춰 넣기 위한 헬퍼.
// (예: 1 -> "000001") 문자열로 정렬했을 때도 순서가 안 꼬이게 하기 위함.
function pad(n) {
  return String(n).padStart(6, '0');
}

// 서버에 fetch를 날리고, 실패하면 서버가 보낸 에러 메시지(detail)를
// err.code에 담아 던져주는 작은 헬퍼. 이렇게 해두면 위쪽 코드에서
// `err.code === 'last_page'` 같은 식으로 "어떤 에러인지" 구분할 수 있음.
// ownerToken이 있으면 쓰기 요청임을 증명하는 X-Room-Token 헤더로 실어보냄
// — 남의 방을 읽기 전용으로 볼 때는 이 값이 없어서 서버가 403으로 막음.
function apiFetch(path, opts, ownerToken) {
  opts = opts || {};
  if (ownerToken) {
    opts.headers = Object.assign({}, opts.headers, { 'X-Room-Token': ownerToken });
  }
  return fetch(API_BASE + path, opts).then((res) => {
    if (res.ok) return res.json().catch(() => ({}));
    return res.json().catch(() => ({})).then((body) => {
      const err = new Error('api_error');
      err.code = (body && body.detail) || ('http_' + res.status);
      throw err;
    });
  });
}

// 그 방 코드가 실제로 존재하는 방인지, 서버가 짧게(ms 밀리초 안에)
// 응답하는지를 확인만 해보는 함수. 응답이 오든, 타임아웃이 나든,
// 네트워크 에러가 나든 — 어쨌든 true/false로 딱 떨어지는 답을 주기
// 때문에 호출하는 쪽에서 다루기 쉬움.
export function checkApi(roomCode, ms) {
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl && setTimeout(() => ctrl.abort(), ms);
  return fetch(API_BASE + '/api/rooms/' + roomCode, ctrl ? { signal: ctrl.signal } : {})
    .then((res) => { clearTimeout(timer); return res.ok; })
    .catch(() => { clearTimeout(timer); return false; });
}

// 진짜 백엔드(FastAPI + PostgreSQL)에 그림을 저장하는 저장소, 특정 방
// 하나에 스코핑됨. ownerToken이 없으면(남의 방을 구경할 때) 쓰기
// 메서드들은 서버가 403으로 거부함 — 화면 쪽(dock/pager)에서도 애초에
// 그 버튼들을 안 보여주지만, 최종 방어선은 항상 서버 쪽에 있음.
// 실시간 동기화는 WebSocket으로: 다른 탭/다른 기기가 같은 (방, 페이지)를
// 보고 있으면 서로 그림이 실시간으로 반영됨.
export function makeApiStore(roomCode, ownerToken) {
  const base = '/api/rooms/' + roomCode;
  return {
    shared: true,
    getPage: (n) => apiFetch(base + '/pages/' + n)
      .then((d) => d.strokes || [])
      .catch((err) => { if (err.code === 'page not found') return []; throw err; }),
    setPage: (n, strokes) => apiFetch(base + '/pages/' + n, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strokes }),
    }, ownerToken),
    subscribePage: (n, cb) => {
      let ws = null;
      try {
        ws = new WebSocket(WS_BASE + '/ws/rooms/' + roomCode + '/pages/' + n);
        ws.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'strokes') cb(msg.strokes);
          } catch (e) { /* 형식이 이상한 메시지는 그냥 무시 */ }
        });
      } catch (e) { ws = null; }
      return () => { if (ws) { try { ws.close(); } catch (e) {} } };
    },
  };
}

// 서버에 연결할 수 없을 때 쓰는 폴백: 이 브라우저(이 기기)의
// localStorage에만 저장함. 다른 기기와는 동기화되지 않고
// (subscribePage가 아무것도 안 하는 이유), 캐시를 지우면 그림도 같이
// 사라짐 — 그래서 "일단 이 기기에서만 저장돼요" 라고 토스트로 알려줌.
export function makeLocalStore() {
  const pageKey = (n) => 'untitled-canvas.local.page.' + pad(n);

  return {
    shared: false,
    getPage: (n) => {
      let v = [];
      try { v = JSON.parse(localStorage.getItem(pageKey(n)) || '[]'); } catch (e) {}
      return Promise.resolve(v);
    },
    subscribePage: () => () => {},
    setPage: (n, strokes) => {
      try { localStorage.setItem(pageKey(n), JSON.stringify(strokes)); } catch (e) {}
      return Promise.resolve();
    },
  };
}
