// "그림을 어디에 저장하는가" 만 담당하는 모듈.
//
// 두 가지 저장소 구현체가 있고, 나머지 코드(canvas.js, pager.js …)는
// 어느 쪽을 쓰는지 전혀 신경 쓰지 않음 — 왜냐하면 둘 다 아래와 똑같은
// "인터페이스"(메서드 이름과 반환값 모양)를 맞춰뒀기 때문:
//
//   getMeta()            -> Promise<페이지 수>
//   subscribeMeta(cb)     -> 페이지 수가 바뀌면 cb(새 페이지 수) 호출 (구독 해제 함수는 없음, 지금은 API 쪽만 실제로 씀)
//   addPage()             -> Promise<새 페이지 수>  (맨 뒤에 빈 페이지 한 장 추가)
//   deletePage(n)         -> Promise<새 페이지 수>  (마지막 한 장 남았으면 {code:'last_page'}로 거부)
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
function apiFetch(path, opts) {
  return fetch(API_BASE + path, opts).then((res) => {
    if (res.ok) return res.json().catch(() => ({}));
    return res.json().catch(() => ({})).then((body) => {
      const err = new Error('api_error');
      err.code = (body && body.detail) || ('http_' + res.status);
      throw err;
    });
  });
}

// 서버가 살아있는지 짧게(ms 밀리초 안에) 확인만 해보는 함수.
// 응답이 오든, 타임아웃이 나든, 네트워크 에러가 나든 — 어쨌든
// true/false로 딱 떨어지는 답을 주기 때문에 호출하는 쪽에서 다루기 쉬움.
export function checkApi(ms) {
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl && setTimeout(() => ctrl.abort(), ms);
  return fetch(API_BASE + '/api/meta', ctrl ? { signal: ctrl.signal } : {})
    .then((res) => { clearTimeout(timer); return res.ok; })
    .catch(() => { clearTimeout(timer); return false; });
}

// 진짜 백엔드(FastAPI + PostgreSQL)에 그림을 저장하는 저장소.
// 실시간 동기화는 WebSocket으로: 다른 탭/다른 기기가 같은 페이지를 열고
// 있으면 서로 그림이 실시간으로 반영됨.
export function makeApiStore() {
  return {
    shared: true,
    getMeta: () => apiFetch('/api/meta').then((d) => d.count),
    subscribeMeta: () => () => {}, // 지금은 메타 정보 실시간 구독은 안 씀 (자리만 맞춰둠)
    addPage: () => apiFetch('/api/pages', { method: 'POST' }).then((d) => d.count),
    deletePage: (n) => apiFetch('/api/pages/' + n, { method: 'DELETE' }).then((d) => d.count),
    getPage: (n) => apiFetch('/api/pages/' + n)
      .then((d) => d.strokes || [])
      .catch((err) => { if (err.code === 'page not found') return []; throw err; }),
    setPage: (n, strokes) => apiFetch('/api/pages/' + n, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strokes }),
    }),
    subscribePage: (n, cb) => {
      let ws = null;
      try {
        ws = new WebSocket(WS_BASE + '/ws/pages/' + n);
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
  const META_KEY = 'untitled-canvas.local.meta';
  const pageKey = (n) => 'untitled-canvas.local.page.' + pad(n);

  // 현재 페이지 수를 로컬에서 추적하기 위한 값. addPage/deletePage가
  // 이 값을 기준으로 다음 값을 계산함 (서버 저장소와 달리 서버가
  // "정답"을 갖고 있지 않으니 여기서 직접 세야 함).
  let count = 1;
  try { count = JSON.parse(localStorage.getItem(META_KEY) || '{"count":1}').count || 1; } catch (e) {}

  return {
    shared: false,
    getMeta: () => Promise.resolve(count),
    subscribeMeta: () => () => {},
    addPage: () => {
      count += 1;
      try { localStorage.setItem(META_KEY, JSON.stringify({ count })); } catch (e) {}
      return Promise.resolve(count);
    },
    deletePage: (n) => {
      if (count <= 1) return Promise.reject({ code: 'last_page' });
      // n번 페이지를 지우는 건 = n+1번을 n번 자리로, n+2번을 n+1번 자리로
      // … 한 칸씩 앞으로 당기는 것과 같음 (종이를 한 장 뜯어내는 느낌).
      for (let i = n; i < count; i++) {
        let next = [];
        try { next = JSON.parse(localStorage.getItem(pageKey(i + 1)) || '[]'); } catch (e) {}
        try { localStorage.setItem(pageKey(i), JSON.stringify(next)); } catch (e) {}
      }
      try { localStorage.removeItem(pageKey(count)); } catch (e) {}
      count -= 1;
      try { localStorage.setItem(META_KEY, JSON.stringify({ count })); } catch (e) {}
      return Promise.resolve(count);
    },
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
