// 처음 온 사람을 위한 도움말 팝업. "처음 들어온 사람에게 설명이 부족하다"는
// 피드백에서 나옴 — 이 브라우저에서 로비를 처음 열 때 한 번 자동으로 띄우고,
// 이후엔 오른쪽 위 "?" 버튼으로 언제든 다시 열 수 있음.
//
// 서버 응답(roomContext)을 기다리지 않고 바로 띄움 — 서버가 잠들어 있으면
// 로딩이 1분 가까이 걸리는데, 그동안 로딩 화면 위에서 읽고 있으라는 뜻도 있음.
// 그래서 "남의 방인지"도 서버 없이 주소(?room=)와 이 브라우저에 저장된 내 방
// 코드만으로 판단함.
import { getStoredRoom } from '../shared/room.js';

const SEEN_KEY = 'untitled-canvas.lobby-help-seen';

function hasSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
}

function isVisitingSomeoneElse() {
  const code = new URLSearchParams(location.search).get('room');
  if (!code) return false;
  const mine = getStoredRoom();
  return !mine || mine.code !== code.toUpperCase();
}

const LOOK_AROUND = `
  <li><b>드래그로 방을 둘러보세요.</b> 휠을 굴리면 커서가 있는 곳으로 가까이 다가가요.</li>`;

const FURNITURE = `
  <li><b>가구를 누르면 그 기록으로 들어가요.</b>
    <span class="help-map">
      <span><i style="background:var(--ember)"></i>이젤 → 캔버스</span>
      <span><i style="background:var(--gold)"></i>책장 → 책</span>
      <span><i style="background:var(--rose)"></i>진열장 → 애니</span>
      <span><i style="background:var(--crimson)"></i>포스터 벽 → 영화</span>
      <span><i style="background:var(--teal)"></i>턴테이블 → 음악</span>
    </span>
    오른쪽 아래 버튼으로도 바로 갈 수 있어요.
  </li>`;

function ownerContent() {
  return `
    <h2 id="helpTitle">처음 오셨군요!</h2>
    <p class="help-lead">읽고, 보고, 들은 것들을 모아두는 나만의 방이에요. 로그인하지 않아도 이 브라우저에 방이 하나 생겼어요.</p>
    <ul>
      ${LOOK_AROUND}
      ${FURNITURE}
      <li><b>아끼는 작품은 크게 걸어두세요.</b> 기록에서 "대표작으로"를 누르면 카테고리마다 3개까지 가구 위에 크게 올라가요. 음악은 턴테이블에서 돌아가요.</li>
      <li><b>친구와 방을 주고받을 수 있어요.</b> 왼쪽 위 방 코드를 알려주면 친구가 구경하러 올 수 있고, 친구 코드를 넣으면 그 방에 놀러 갈 수 있어요.</li>
      <li><b>구글 계정을 연결해두세요.</b> 브라우저 기록이 지워지거나 기기를 바꿔도 내 방을 되찾을 수 있어요.</li>
    </ul>`;
}

function visitorContent() {
  return `
    <h2 id="helpTitle">친구의 방에 놀러 왔어요</h2>
    <p class="help-lead">친구가 읽고, 보고, 들은 것들을 모아둔 방이에요. 마음껏 구경하세요. 그림과 기록은 방 주인만 바꿀 수 있어요.</p>
    <ul>
      ${LOOK_AROUND}
      ${FURNITURE}
      <li><b>가구 위에 크게 걸린 건 친구가 아끼는 작품이에요.</b></li>
      <li><b>내 방도 있어요.</b> 왼쪽 위 "내 방으로"를 누르면 이 브라우저의 내 방으로 가요.</li>
    </ul>`;
}

export function initHelpDialog() {
  const dialog = document.getElementById('helpDialog');
  const body = document.getElementById('helpBody');
  const closeBtn = document.getElementById('helpClose');
  const openBtn = document.getElementById('helpBtn');
  if (!dialog || !body || !closeBtn) return;

  body.innerHTML = isVisitingSomeoneElse() ? visitorContent() : ownerContent();

  let returnFocus = null;
  function open() {
    returnFocus = document.activeElement;
    dialog.hidden = false;
    closeBtn.focus();
  }
  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    markSeen();
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }

  closeBtn.addEventListener('click', close);
  // 카드 바깥(어두운 배경)을 눌러도 닫힘.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  if (openBtn) openBtn.addEventListener('click', open);

  if (!hasSeen()) open();
}
