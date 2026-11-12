// 처음 온 사람 환영 카드("처음 들어온 사람에게 뭘 해야 할지 모르겠다"는 피드백에서 나옴 — 예전엔
// 3D 방 위에 떴고, 첫 화면이 카드 화면이 되면서 여기로 옮김). 위 줄의 "?" 도움말은 사용자 결정으로
// 없앰(2026-11-12) — 빈 화면 가운데의 "+ 기록" 버튼(list.js)이 할 일을 대신 알려줌.
// 환영 카드는 처음 한 번 자동으로 뜨고, 설명을 늘어놓지 않고 할 일 하나만:
//       · 내 방이 비어 있으면 "첫 기록 남기기" — 카테고리를 누르면 새 기록 창이 바로 열림.
//         예시 방(개발자의 방) 구경도.
//       · 남의 방이면 "○○에 놀러 왔어요".
//       · 기록이 이미 있는 내 방(구글로 되찾은 새 브라우저 등)이면 안 띄움.
import { DEVELOPER_ROOM_CODE, API_BASE } from '../shared/config.js';
import { escapeHtml } from '../shared/dom.js';
import { roomLink, roomTitle } from '../shared/room.js';

// 주인·방문자 환영은 따로 기억함 — 내 방 환영을 봤어도 친구 방에 처음 가면 그쪽 환영은 뜸.
// (3D 방 시절과 같은 키 — 이미 본 사람에게 다시 띄우지 않게.)
const SEEN_OWNER = 'untitled-canvas.lobby-welcome-owner';
const SEEN_VISITOR = 'untitled-canvas.lobby-welcome-visitor';

function seen(key) {
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
}
function markSeen(key) {
  try { localStorage.setItem(key, '1'); } catch (e) {}
}

const START_CATS = [
  { key: 'book', label: '책' },
  { key: 'movie', label: '영화·시리즈' },
  { key: 'anime', label: '애니' },
  { key: 'music', label: '음악' },
];

// 내 방이 비어 있을 때의 환영 — 할 일은 "첫 기록 남기기" 하나.
function ownerWelcome(ctx) {
  const dev = DEVELOPER_ROOM_CODE && DEVELOPER_ROOM_CODE.toUpperCase();
  const example = dev && dev !== ctx.mine.code
    ? `<a class="help-secondary" href="${roomLink('./', dev, ctx.mine.code)}" data-welcome-example>예시 기록 먼저 구경하기</a>`
    : '';
  const cats = START_CATS.map((c) => `<button type="button" class="help-cat" data-cat="${c.key}">${c.label}</button>`).join('');
  return `
    <h2 id="helpTitle">나만의 기록장이 생겼어요</h2>
    <p class="help-lead">읽고, 보고, 들은 걸 모아두는 곳이에요. 기록을 남기면 한 장씩 쌓여요.</p>
    <p class="help-step">첫 기록 남기기</p>
    <div class="help-cats">${cats}</div>
    ${example}`;
}

function visitorWelcome(info) {
  return `
    <h2 id="helpTitle">${escapeHtml(roomTitle(info && info.name))}에 놀러 왔어요</h2>
    <p class="help-lead">친구가 읽고, 보고, 들은 것들이에요. 기록을 누르면 친구의 감상을 볼 수 있어요.</p>`;
}

// ctx: { mine, viewingCode, readOnly } (initRoomNav 결과).
// onStart(cat): 환영 카드에서 카테고리를 골랐을 때 — 그 카테고리로 새 기록 창을 엶.
// 돌려주는 showIfFirstVisit(records)는 기록을 받아 온 뒤 부름(기록을 못 받았으면 안 부름).
export function initWelcome(ctx, { onStart }) {
  const dialog = document.getElementById('helpDialog');
  const body = document.getElementById('helpBody');
  const closeBtn = document.getElementById('helpClose');
  if (!dialog || !body || !closeBtn) return { showIfFirstVisit() {} };

  let returnFocus = null;
  let seenKey = null; // 환영 카드로 열었을 때 닫으면 "봤음"으로 적을 키

  function open(mode, html, key) {
    returnFocus = document.activeElement;
    dialog.dataset.mode = mode;
    body.innerHTML = html;
    seenKey = key || null;
    closeBtn.textContent = mode === 'owner' ? '그냥 둘러볼게요' : '구경하기';
    dialog.hidden = false;
    const first = body.querySelector('.help-cat');
    (first || closeBtn).focus();
  }
  function close({ restoreFocus = true } = {}) {
    if (dialog.hidden) return;
    dialog.hidden = true;
    if (seenKey) markSeen(seenKey);
    seenKey = null;
    if (restoreFocus && returnFocus && returnFocus.focus) returnFocus.focus();
  }

  closeBtn.addEventListener('click', () => close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  body.addEventListener('click', (e) => {
    const cat = e.target.closest('.help-cat');
    if (cat) { close({ restoreFocus: false }); onStart(cat.dataset.cat); return; }
    const link = e.target.closest('a');
    if (!link) return;
    // 예시 방으로 떠날 때도 "봤음" — 돌아왔을 때 또 뜨지 않게. 거기서 방문자 환영도 안 띄움
    // (내 방이 있다는 건 이미 앎).
    if (seenKey) markSeen(seenKey);
    if (link.hasAttribute('data-welcome-example')) markSeen(SEEN_VISITOR);
  });

  return {
    showIfFirstVisit(records) {
      if (!dialog.hidden || !Array.isArray(records)) return;
      if (ctx.readOnly) {
        if (seen(SEEN_VISITOR)) return;
        fetch(`${API_BASE}/api/rooms/${encodeURIComponent(ctx.viewingCode)}`)
          .then((res) => (res.ok ? res.json() : null), () => null)
          .then((info) => { if (dialog.hidden) open('visitor', visitorWelcome(info), SEEN_VISITOR); });
        return;
      }
      if (!seen(SEEN_OWNER) && records.length === 0) open('owner', ownerWelcome(ctx), SEEN_OWNER);
    },
  };
}
