// "기록"(책/애니/영화) 데이터와 서버 통신을 담당하는 모듈. 이 파일은
// DOM을 전혀 건드리지 않음 — 화면에 어떻게 그릴지는 list.js/modal.js
// 몫이고, 여긴 순수하게 "서버에 뭘 물어보고 뭘 돌려받는지"만 다룸.
// 이렇게 나눠두면 나중에 화면 디자인이 바뀌어도 이 파일은 안 건드려도
// 되고, 반대로 API가 바뀌어도 화면 쪽 코드는 안 건드려도 됨.
import { API_BASE } from '../shared/config.js';

// 기록을 분류하는 세 카테고리. key는 서버로 보낼 때 쓰는 값, label은
// 화면에 보여줄 한글.
export const CATS = [
  { key: 'book', label: '책' },
  { key: 'anime', label: '애니' },
  { key: 'movie', label: '영화' },
  { key: 'music', label: '음악' },
];

// 제목 입력창에 뭘 타이핑하면 "혹시 이거 아니에요?" 하고 보여주는
// 추천 목록 (자주 나올 법한 제목들을 미리 적어둔 것 — 서버 데이터
// 아님, 그냥 편의 기능).
export const PRESETS = {
  book: ["데미안","어린 왕자","1984","노르웨이의 숲","채식주의자","아몬드","82년생 김지영","위대한 개츠비","백년의 고독","죽고 싶지만 떡볶이는 먹고 싶어"],
  anime: ["신세계에서","너의 이름은","하울의 움직이는 성","이웃집 토토로","목소리의 형태","카우보이 비밥","강철의 연금술사","원펀맨","바람이 분다","마녀 배달부 키키"],
  movie: ["기생충","라라랜드","인터스텔라","이터널 선샤인","그랜드 부다페스트 호텔","500일의 썸머","리틀 포레스트","어바웃 타임","헤어질 결심","파리, 텍사스"],
};

// 이 방 코드를 기준으로 요청 경로를 만들고, 쓰기 요청엔 소유자 토큰을
// 헤더로 실어 보내는 작은 헬퍼들. main.js가 모듈 로드 시점에 한 번
// setRoom()으로 방을 정해주면, 이 파일의 나머지 함수들은 그 방을 씀.
let roomCode = null;
let ownerToken = null;

export function setRoom(code, token) {
  roomCode = code;
  ownerToken = token;
}

function authHeaders() {
  return ownerToken ? { 'X-Room-Token': ownerToken } : {};
}

// 전체 기록 목록을 가져옴.
export function fetchRecords() {
  return fetch(API_BASE + '/api/rooms/' + roomCode + '/records').then((res) => {
    // res.ok를 안 보고 바로 res.json()을 하면, 방을 못 찾는 404 같은
    // 에러 응답의 바디({"detail":"room not found"})를 정상 목록인 척
    // 그대로 넘겨버림 — list.js가 그걸 배열로 착각하고 .length/.filter를
    // 부르다가 깨져서 화면에 "undefined"가 찍히는 식으로 터짐(reload()의
    // catch가 있어도, 여기서 미리 걸러주지 않으면 그 catch까지 못 옴).
    if (!res.ok) throw new Error('fetch records failed');
    return res.json();
  });
}

// 기록 하나를 삭제.
export function deleteRecord(id) {
  return fetch(API_BASE + '/api/rooms/' + roomCode + '/records/' + id, {
    method: 'DELETE',
    headers: authHeaders(),
  }).then((res) => {
    if (!res.ok) throw new Error('delete failed');
  });
}

// 사진 파일을 서버(S3)에 업로드하고, 나중에 쓸 수 있는 URL을 돌려받음.
// record 자체를 저장하는 것과는 별개의 요청 — 사진을 안 바꿨으면 이
// 함수는 아예 호출할 필요가 없음 (modal.js가 그 판단을 함).
export function uploadPhoto(file) {
  const form = new FormData();
  form.append('file', file);
  return fetch(API_BASE + '/api/rooms/' + roomCode + '/uploads', {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
    .then((res) => {
      if (!res.ok) throw new Error('photo upload failed');
      return res.json();
    })
    .then((data) => data.url);
}

// 이 기록을 "대표작"으로 켜거나 끔 — 카테고리마다 최대 3개까지(로비의
// 대표작 자리 수). 이미 3개인데 더 켜려고 하면 서버가 400
// "featured_limit"로 거절하고, 그 문자열을 err.code에 담아 던짐 —
// main.js가 일반 실패와 구분해서 안내함. rating/memo 등 다른 필드는 안
// 건드리는 별도 엔드포인트라서, saveRecord처럼 전체를 다시 보낼 필요가 없음.
export function setFeatured(id, featured) {
  return fetch(API_BASE + '/api/rooms/' + roomCode + '/records/' + id + '/feature', {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
    body: JSON.stringify({ featured }),
  }).then((res) => {
    if (res.ok) return;
    return res.json().catch(() => ({})).then((body) => {
      const err = new Error('feature toggle failed');
      err.code = body && body.detail;
      throw err;
    });
  });
}

// 새 기록을 만들거나(editingId가 없을 때), 기존 기록을 덮어씀
// (editingId가 있을 때). record는 { cat, title, creator, rating, memo,
// photo_url } 모양의 평범한 객체.
export function saveRecord(record, editingId) {
  const base = API_BASE + '/api/rooms/' + roomCode + '/records';
  const url = editingId ? `${base}/${editingId}` : base;
  return fetch(url, {
    method: editingId ? 'PUT' : 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
    body: JSON.stringify(record),
  }).then((res) => {
    if (!res.ok) throw new Error('save failed');
  });
}
