// 처음 온 사람 안내 + 도움말 팝업. "처음 들어온 사람에게 설명이 부족하다 — 뭘 해야
// 할지 모르겠다"는 피드백에서 나옴. 한 대화창을 두 가지로 씀:
//   - 환영 카드(처음 한 번 자동으로): 설명을 늘어놓지 않고 할 일 하나만.
//       · 내 방이 비어 있으면 "첫 기록 남기기" — 카테고리를 누르면 기록 보관소에서
//         새 기록 창이 바로 열림(library?cat=…&new=1). 예시 방(개발자의 방) 구경도.
//       · 남의 방이면 "○○에 놀러 왔어요" + "나도 내 방 만들기".
//       · 기록이 이미 있는 내 방(구글로 되찾은 새 브라우저 등)이면 안 띄움.
//   - 도움말(오른쪽 위 "?" 버튼): 둘러보기·가구·인생작·친구 방·구글 연결 설명 전부.
//
// 처음 온 사람에게 자동으로 띄우는 건 방이 다 그려진 뒤(main.js가 showIfFirstVisit을
// 부름) — 로딩 화면 위에 먼저 뜨면 설명하는 방이 안 보여서 어색함.
import { roomContext, roomInfo, roomRecords, pageUrl, lobbyUrl } from './roomContext.js';
import { DEVELOPER_ROOM_CODE } from '../shared/config.js';
import { escapeHtml } from '../shared/dom.js';

// 주인·방문자 환영은 따로 기억함 — 내 방 환영을 봤어도 친구 방에 처음 가면 그쪽 환영은 뜸.
const SEEN_OWNER = 'untitled-canvas.lobby-welcome-owner';
const SEEN_VISITOR = 'untitled-canvas.lobby-welcome-visitor';

function seen(key) {
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
}
function markSeen(key) {
  try { localStorage.setItem(key, '1'); } catch (e) {}
}

// 폰·태블릿(손가락)인지 — 둘러보기 설명을 "드래그·휠" 대신 손가락 기준으로.
const touch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const START_CATS = [
  { key: 'book', label: '책' },
  { key: 'movie', label: '영화' },
  { key: 'anime', label: '애니' },
  { key: 'music', label: '음악' },
];

function lookAround() {
  return touch()
    ? '<li><b>손가락으로 밀어서 방을 둘러보세요.</b></li>'
    : '<li><b>드래그로 방을 둘러보세요.</b> 휠을 굴리면 커서가 있는 곳으로 가까이 다가가요.</li>';
}

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

function ownerHelp() {
  return `
    <h2 id="helpTitle">이렇게 써요</h2>
    <p class="help-lead">읽고, 보고, 들은 것들을 모아두는 나만의 방이에요. 로그인하지 않아도 이 브라우저에 방이 하나 생겼어요.</p>
    <ul>
      ${lookAround()}
      ${FURNITURE}
      <li><b>기록은 제목만 쳐도 돼요.</b> 새 기록 창에서 제목이나 작가·가수·감독을 쓰면 표지까지 찾아 줘요.</li>
      <li><b>아끼는 작품은 크게 걸어두세요.</b> 기록에서 "인생책으로", "인생영화로" 같은 버튼을 누르면 카테고리마다 3개까지 가구 위에 크게 올라가요. 최애음악은 레코드 콘솔 위에 올라가고, 그중 하나가 턴테이블에서 돌아가요.</li>
      <li><b>친구와 방을 주고받을 수 있어요.</b> 왼쪽 위 "링크 복사"로 보낸 링크를 누르면 친구가 바로 구경하러 오고, 친구 코드를 넣으면 그 방에 놀러 갈 수 있어요.</li>
      <li><b>구글 계정을 연결해두세요.</b> 브라우저 기록이 지워지거나 기기를 바꿔도 내 방을 되찾을 수 있어요.</li>
    </ul>`;
}

function visitorHelp() {
  return `
    <h2 id="helpTitle">친구의 방이에요</h2>
    <p class="help-lead">친구가 읽고, 보고, 들은 것들을 모아둔 방이에요. 마음껏 구경하세요. 그림과 기록은 방 주인만 바꿀 수 있어요.</p>
    <ul>
      ${lookAround()}
      ${FURNITURE}
      <li><b>가구 위에 크게 걸린 건 친구가 아끼는 작품이에요.</b></li>
      <li><b>내 방도 있어요.</b> 왼쪽 위 "내 방으로"를 누르면 이 브라우저의 내 방으로 가요.</li>
    </ul>`;
}

// 내 방이 비어 있을 때의 환영 — 할 일은 "첫 기록 남기기" 하나.
function ownerWelcome(ctx) {
  const dev = DEVELOPER_ROOM_CODE && DEVELOPER_ROOM_CODE.toUpperCase();
  const example = dev && dev !== ctx.mine.code
    ? `<a class="help-secondary" href="${lobbyUrl(dev, ctx.mine.code)}" data-welcome-example>예시 방 먼저 구경하기</a>`
    : '';
  const cats = START_CATS.map((c) => `<a class="help-cat" data-cat="${c.key}" href="${pageUrl(`library?cat=${c.key}&new=1`, ctx)}">${c.label}</a>`).join('');
  return `
    <h2 id="helpTitle">나만의 방이 생겼어요</h2>
    <p class="help-lead">읽고, 보고, 들은 걸 모아두는 방이에요. 기록을 남기면 방에 하나씩 걸려요.</p>
    <p class="help-step">첫 기록 남기기</p>
    <div class="help-cats">${cats}</div>
    ${example}`;
}

// 방 이름이 "도현의 방"처럼 이미 "방"으로 끝나면 그대로, 아니면 "…의 방".
function roomTitle(name) {
  if (!name) return '친구의 방';
  return /방$/.test(name) ? name : `${name}의 방`;
}

function visitorWelcome(ctx, info) {
  return `
    <h2 id="helpTitle">${escapeHtml(roomTitle(info && info.name))}에 놀러 왔어요</h2>
    <p class="help-lead">친구가 읽고, 보고, 들은 것들이에요. 가구를 누르면 기록을 볼 수 있어요.</p>
    <a class="help-primary" href="${lobbyUrl(ctx.mine.code, ctx.mine.code)}">나도 내 방 만들기</a>`;
}

// ? 버튼과 닫기를 연결하고, 처음 온 사람이면 환영 카드를 띄우는 함수를 돌려줌 —
// 언제 띄울지는 부르는 쪽(main.js)이 정함.
export function initHelpDialog() {
  const dialog = document.getElementById('helpDialog');
  const body = document.getElementById('helpBody');
  const closeBtn = document.getElementById('helpClose');
  const foot = document.getElementById('helpFoot');
  const openBtn = document.getElementById('helpBtn');
  if (!dialog || !body || !closeBtn) return { showIfFirstVisit() {} };

  let returnFocus = null;
  let seenKey = null; // 환영 카드로 열었을 때 닫으면 "봤음"으로 적을 키

  function open(mode, html, key) {
    returnFocus = document.activeElement;
    dialog.dataset.mode = mode;
    body.innerHTML = html;
    seenKey = key || null;
    closeBtn.textContent = mode === 'help' ? '닫기' : mode === 'owner' ? '그냥 둘러볼게요' : '구경하기';
    if (foot) foot.hidden = mode === 'help';
    dialog.hidden = false;
    // 창이 떠 있는 동안 빈 방 말풍선(onboarding.js)처럼 창 밖에서 눈길을 끄는 건 숨김(CSS).
    document.body.classList.add('help-open');
    const first = body.querySelector('.help-cat, .help-primary');
    (first || closeBtn).focus();
  }
  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    document.body.classList.remove('help-open');
    if (seenKey) markSeen(seenKey);
    seenKey = null;
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }

  closeBtn.addEventListener('click', close);
  // 카드 바깥(어두운 배경)을 눌러도 닫힘.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // 환영 카드의 링크(카테고리·예시 방·내 방 만들기)로 떠날 때도 "봤음"으로 적음 —
  // 돌아왔을 때 또 뜨지 않게. 예시 방으로 가면 거기서 방문자 환영도 안 띄움(내 방이
  // 있다는 건 이미 앎).
  body.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    if (seenKey) markSeen(seenKey);
    if (link.hasAttribute('data-welcome-example')) markSeen(SEEN_VISITOR);
  });
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      roomContext.then((ctx) => open('help', ctx.readOnly ? visitorHelp() : ownerHelp()));
    });
  }

  return {
    // 환영 카드가 필요하면 띄움. 기록을 못 불러왔으면(null) 빈 방인지 모르니 안 띄움.
    showIfFirstVisit() {
      Promise.all([roomContext, roomInfo, roomRecords]).then(([ctx, info, records]) => {
        if (!dialog.hidden) return;
        if (ctx.readOnly) {
          if (!seen(SEEN_VISITOR)) open('visitor', visitorWelcome(ctx, info), SEEN_VISITOR);
          return;
        }
        if (!seen(SEEN_OWNER) && Array.isArray(records) && records.length === 0) {
          open('owner', ownerWelcome(ctx), SEEN_OWNER);
        }
      }).catch(() => {});
    },
  };
}
