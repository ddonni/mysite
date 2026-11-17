// 첫 화면 오른쪽 아래 떠 있는 두 버튼 — 좋아요(♥)와 방명록(말풍선). 2026-11-17 사용자 요청.
//   - 좋아요: 한 번 누르면 좋아요, 다시 누르면 취소. 누르면 "○○의 기록에 좋아요를 눌렀어요"가 잠깐 뜸.
//     내 기록에선 받은 개수만 보여 줌(자기 기록엔 못 누름 — 서버도 400 "own_room").
//   - 방명록: 누르면 페이지를 옮기지 않고 채팅방처럼 오른쪽 아래에 창이 뜸. 창은 반투명이라 뒤의
//     카드가 비쳐 보이고, 화면 전체를 어둡게 덮지 않음. 맨 아래 칸에서 바로 글을 남김(익명 선택 가능).
// 글쓰기·좋아요는 구글 계정을 연동한 사람만(서버 app/social_routes.py) — 안 했으면 로그인 안내 창.
// "누가"는 이 브라우저의 내 방(mine)으로 정함: X-Actor-Code / X-Actor-Token 헤더.
import { API_BASE } from '../shared/config.js';
import { escapeHtml } from '../shared/dom.js';
import { avatarInner } from '../shared/avatar.js';
import { roomLink, roomTitle } from '../shared/room.js';
import { initGoogleAuth } from '../shared/googleAuth.js';

export const MESSAGE_MAX = 300; // 백엔드 schemas.GuestbookIn

// "방금" · "5분 전" · "3시간 전" · "2일 전" · 그보다 오래되면 날짜.
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  // 서버(SQLite·Postgres)가 시간대 없이 줄 때도 있어서, 없으면 UTC로 봄.
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  const d = new Date(t);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.7 1.2 5.2 3 1.5-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z"/></svg>';

// ctx: initRoomNav 결과 { mine, viewingCode, readOnly }.
// 돌려주는 것: { isLinked, askLogin, showToast } — 카드 공감(main.js)이 같은 로그인 안내·알림을 씀.
export function initSocial({ mine, viewingCode, readOnly }) {
  const root = document.getElementById('social');
  if (!root) return { isLinked: () => Promise.resolve(false), askLogin() {}, showToast() {} };
  const likeBtn = document.getElementById('likeBtn');
  const likeCount = document.getElementById('likeCount');
  const gbBtn = document.getElementById('guestbookBtn');
  const gbCount = document.getElementById('guestbookCount');
  const panel = document.getElementById('guestbook');
  const listEl = document.getElementById('gbList');
  const totalEl = document.getElementById('gbTotal');
  const form = document.getElementById('gbForm');
  const input = document.getElementById('gbInput');
  const anon = document.getElementById('gbAnon');
  const sendBtn = document.getElementById('gbSend');
  const loginRow = document.getElementById('gbLogin');
  const toast = document.getElementById('socialToast');
  const loginDialog = document.getElementById('loginDialog');

  likeBtn.querySelector('.ico').innerHTML = HEART;
  gbBtn.querySelector('.ico').innerHTML = BUBBLE;
  root.hidden = false;

  const api = (path) => `${API_BASE}/api/rooms/${encodeURIComponent(viewingCode)}/${path}`;
  const actorHeaders = { 'X-Actor-Code': mine.code, 'X-Actor-Token': mine.token };
  let roomName = null;
  const whose = () => (readOnly ? roomTitle(roomName) : '내 기록');

  // 이 브라우저의 내 방에 구글 계정이 연동돼 있는지 — 한 번만 물어봄.
  let linkedPromise = null;
  const isLinked = () => {
    if (!linkedPromise) {
      linkedPromise = fetch(`${API_BASE}/api/rooms/${encodeURIComponent(mine.code)}/google`, { headers: { 'X-Room-Token': mine.token } })
        .then((res) => (res.ok ? res.json() : null))
        .then((s) => !!(s && s.linked), () => false);
    }
    return linkedPromise;
  };

  // ---- 잠깐 뜨는 안내(좋아요 눌렀을 때 등) ----
  let toastTimer;
  function showToast(text) {
    toast.textContent = text;
    toast.hidden = false;
    toast.classList.remove('show');
    void toast.offsetWidth; // 같은 글을 연달아 띄워도 다시 나타나게
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2200);
  }

  // ---- 구글 로그인 안내 창 ----
  let loginRendered = false;
  function askLogin(why) {
    document.getElementById('loginWhy').textContent = why;
    if (!loginRendered) {
      initGoogleAuth(document.getElementById('loginGoogle'), mine);
      loginRendered = true;
    }
    loginDialog.hidden = false;
    loginDialog.querySelector('.login-close').focus();
  }
  const closeLogin = () => { loginDialog.hidden = true; };
  loginDialog.querySelector('.login-close').addEventListener('click', closeLogin);
  loginDialog.addEventListener('click', (e) => { if (e.target === loginDialog) closeLogin(); });

  // ---- 좋아요 ----
  let likes = { count: 0, liked: false };
  function paintLikes() {
    likeCount.textContent = likes.count;
    likeBtn.setAttribute('aria-pressed', String(likes.liked));
    likeBtn.classList.toggle('on', likes.liked);
    const label = readOnly
      ? (likes.liked ? `${whose()}에 좋아요를 눌렀어요 · 다시 누르면 취소` : `${whose()}에 좋아요 누르기`)
      : `내 기록이 받은 좋아요 ${likes.count}개`;
    likeBtn.setAttribute('aria-label', label);
    likeBtn.dataset.tip = label;
  }
  paintLikes();
  fetch(api('likes'), { headers: actorHeaders })
    .then((res) => (res.ok ? res.json() : null))
    .then((l) => { if (l) { likes = l; paintLikes(); } })
    .catch(() => {});

  likeBtn.addEventListener('click', async () => {
    if (!readOnly) { showToast(`내 기록이 받은 좋아요 ${likes.count}개`); return; }
    if (likeBtn.disabled) return;
    if (!likes.liked && !(await isLinked())) {
      askLogin('좋아요는 구글 계정을 연동한 사람만 누를 수 있어요.');
      return;
    }
    likeBtn.disabled = true;
    const wasLiked = likes.liked;
    try {
      const res = await fetch(api('likes'), { method: wasLiked ? 'DELETE' : 'PUT', headers: actorHeaders });
      if (res.status === 401 || res.status === 403) { askLogin('좋아요는 구글 계정을 연동한 사람만 누를 수 있어요.'); return; }
      if (!res.ok) throw new Error('like failed');
      likes = await res.json();
      paintLikes();
      if (likes.liked) {
        likeBtn.classList.remove('pop'); void likeBtn.offsetWidth; likeBtn.classList.add('pop');
        showToast(`${whose()}에 좋아요를 눌렀어요 ♥`);
      } else {
        showToast('좋아요를 취소했어요');
      }
    } catch (e) {
      showToast('지금은 좋아요를 누를 수 없어요');
    } finally {
      likeBtn.disabled = false;
    }
  });

  // ---- 방명록 ----
  let entries = [];
  let total = 0;
  function paintCount() {
    gbCount.textContent = total;
    gbCount.hidden = total === 0;
    totalEl.textContent = total ? ` ${total}` : '';
  }

  function entryHtml(e) {
    const who = e.author;
    const name = who ? escapeHtml(who.name || '이름 없는 기록') : '익명';
    const nameHtml = who && !e.mine
      ? `<a class="gb-name" href="${escapeHtml(roomLink('./', who.code, mine.code))}">${name}</a>`
      : `<span class="gb-name">${e.mine ? (e.anonymous ? '나 (익명)' : '나') : name}</span>`;
    return `
      <li class="gb-entry${e.mine ? ' mine' : ''}" data-id="${e.id}">
        <span class="avatar gb-avatar">${who ? avatarInner(who.avatar_url) : '<span class="anon-face" aria-hidden="true">?</span>'}</span>
        <div class="gb-body">
          <div class="gb-meta">${nameHtml}<time>${timeAgo(e.created_at)}</time>
            ${e.can_delete ? '<button type="button" class="gb-del" aria-label="이 글 지우기" title="지우기">×</button>' : ''}</div>
          <p class="gb-text">${escapeHtml(e.message)}</p>
        </div>
      </li>`;
  }

  function paintList() {
    if (!entries.length) {
      listEl.innerHTML = `<li class="gb-empty">${readOnly ? `${escapeHtml(whose())}에 첫 방명록을 남겨 보세요.` : '아직 방명록이 없어요. 친구에게 내 기록을 보여 주면 여기에 글이 남아요.'}</li>`;
      return;
    }
    listEl.innerHTML = entries.map(entryHtml).join('');
    listEl.scrollTop = listEl.scrollHeight; // 최신 글이 맨 아래(채팅처럼)
  }

  function load() {
    return fetch(api('guestbook'), { headers: actorHeaders })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => { entries = data.entries; total = data.total; paintCount(); paintList(); })
      .catch(() => { listEl.innerHTML = '<li class="gb-empty">방명록을 불러오지 못했어요.</li>'; });
  }
  // 버튼의 글 수는 처음부터 보이게 미리 받아 둠.
  load();

  async function paintComposer() {
    const ok = await isLinked();
    form.hidden = !ok;
    loginRow.hidden = ok;
  }

  function openPanel() {
    panel.hidden = false;
    gbBtn.setAttribute('aria-expanded', 'true');
    paintComposer();
    load().then(() => { if (!form.hidden) input.focus(); });
  }
  function closePanel() {
    panel.hidden = true;
    gbBtn.setAttribute('aria-expanded', 'false');
    gbBtn.focus();
  }
  gbBtn.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
  panel.querySelector('.gb-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!loginDialog.hidden) closeLogin();
    else if (!panel.hidden) closePanel();
  });
  loginRow.querySelector('button').addEventListener('click', () => askLogin('방명록은 구글 계정을 연동한 사람만 남길 수 있어요.'));

  // 지우기 — 한 번 묻고 지움.
  listEl.addEventListener('click', (e) => {
    const del = e.target.closest('.gb-del');
    if (!del) return;
    const li = del.closest('.gb-entry');
    if (!confirm('이 방명록 글을 지울까요?')) return;
    fetch(api(`guestbook/${li.dataset.id}`), { method: 'DELETE', headers: actorHeaders })
      .then((res) => (res.ok ? load() : Promise.reject()))
      .catch(() => showToast('지우지 못했어요'));
  });

  // 남기기 — Enter로 보내고 Shift+Enter는 줄바꿈(한글 조합 중 Enter는 무시).
  const updateSend = () => { sendBtn.disabled = !input.value.trim(); };
  input.addEventListener('input', updateSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message || sendBtn.disabled) return;
    sendBtn.disabled = true;
    try {
      const res = await fetch(api('guestbook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...actorHeaders },
        body: JSON.stringify({ message, anonymous: anon.checked }),
      });
      if (res.status === 401 || res.status === 403) { askLogin('방명록은 구글 계정을 연동한 사람만 남길 수 있어요.'); return; }
      if (res.status === 429) { showToast('잠시 후에 다시 남겨 주세요'); return; }
      if (!res.ok) throw new Error('post failed');
      input.value = '';
      await load();
    } catch (err) {
      showToast('남기지 못했어요. 잠시 후 다시 해 주세요.');
    } finally {
      updateSend();
    }
  });
  updateSend();

  // 이름(좋아요 안내 문구에 씀).
  fetch(`${API_BASE}/api/rooms/${encodeURIComponent(viewingCode)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((info) => { if (info) { roomName = info.name; paintLikes(); } })
    .catch(() => {});

  return { isLinked, askLogin, showToast };
}
