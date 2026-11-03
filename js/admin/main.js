// 운영자 피드백 페이지 — "의견 보내기"로 받은 걸 psql 없이 폰·PC에서 바로 봄.
// 구글로 로그인하면 그 ID 토큰을 백엔드 GET /api/admin/feedback에 보내고, 서버가
// 이메일이 ADMIN_EMAILS에 있는지 확인함(다른 계정이면 403). 이 페이지는 메뉴에
// 링크가 없고, 주소를 알아도 운영자 계정이 아니면 아무것도 안 보임.
import { API_BASE, GOOGLE_CLIENT_ID } from '../shared/config.js';
import { escapeHtml } from '../shared/dom.js';
import { pageLabel, timeAgo, filterFeedback, isNew } from './feedbackView.js';

// 구글 ID 토큰은 한 시간 동안 유효 — 새로고침할 때마다 다시 로그인하지 않게 탭이
// 살아 있는 동안만 기억함. "어디까지 읽었는지"는 다음에 와도 새 의견을 표시하려고 남김.
const TOKEN_KEY = 'adminGoogleToken';
const SEEN_KEY = 'adminFeedbackSeen';

const $ = (id) => document.getElementById(id);
const signInEl = $('adminSignIn');
const metaEl = $('adminMeta');
const toolsEl = $('adminTools');
const searchEl = $('adminSearch');
const listEl = $('adminList');

let items = [];
let lastSeenId = null;

function store(kind, key, value) {
  try {
    if (value == null) window[kind].removeItem(key);
    else window[kind].setItem(key, value);
  } catch (e) { /* 저장 못 해도 이번 화면은 그대로 동작 */ }
}

function load(kind, key) {
  try { return window[kind].getItem(key); } catch (e) { return null; }
}

function showSignIn(message) {
  metaEl.textContent = message;
  toolsEl.hidden = true;
  listEl.innerHTML = '';
  signInEl.hidden = false;
  if (typeof google === 'undefined' || !GOOGLE_CLIENT_ID) {
    metaEl.textContent = '구글 로그인을 불러오지 못했어요. 새로고침해 보세요.';
    return;
  }
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => fetchFeedback(r.credential), auto_select: true });
  google.accounts.id.renderButton(signInEl, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with' });
  google.accounts.id.prompt();
}

function fetchFeedback(token) {
  signInEl.hidden = true;
  metaEl.textContent = '불러오는 중…';
  fetch(`${API_BASE}/api/admin/feedback`, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => {
      if (res.status === 401) throw new Error('relogin');
      if (res.status === 403) throw new Error('운영자 계정이 아니에요. 다른 계정으로 로그인해 주세요.');
      if (!res.ok) throw new Error('불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      return res.json();
    })
    .then((list) => {
      store('sessionStorage', TOKEN_KEY, token);
      items = list;
      const saved = load('localStorage', SEEN_KEY);
      lastSeenId = saved == null ? null : Number(saved);
      if (items.length) store('localStorage', SEEN_KEY, String(items[0].id));
      toolsEl.hidden = false;
      render();
    })
    .catch((err) => {
      store('sessionStorage', TOKEN_KEY, null);
      showSignIn(err.message === 'relogin' ? '로그인이 만료됐어요. 다시 로그인해 주세요.' : err.message);
    });
}

function card(f) {
  const where = [pageLabel(f.page), f.room_code && `방 ${f.room_code}`].filter(Boolean).join(' · ');
  const room = f.room_code
    ? `<a class="fb-room" href="./?room=${encodeURIComponent(f.room_code)}" target="_blank" rel="noopener">방 구경하기 ↗</a>`
    : '';
  const time = f.created_at ? `<time datetime="${escapeHtml(f.created_at)}" title="${escapeHtml(new Date(f.created_at).toLocaleString('ko-KR'))}">${timeAgo(f.created_at)}</time>` : '';
  return `
    <article class="fb-card${isNew(f, lastSeenId) ? ' is-new' : ''}">
      <header class="fb-head">
        <span class="fb-name">${escapeHtml(f.name || '이름 없음')}</span>
        ${isNew(f, lastSeenId) ? '<span class="fb-new">새 의견</span>' : ''}
        ${time}
      </header>
      <p class="fb-message">${escapeHtml(f.message)}</p>
      ${where || room ? `<footer class="fb-foot"><span>${escapeHtml(where)}</span>${room}</footer>` : ''}
    </article>`;
}

function render() {
  const shown = filterFeedback(items, searchEl.value);
  const fresh = items.filter((f) => isNew(f, lastSeenId)).length;
  metaEl.textContent = `받은 의견 ${items.length}개${fresh ? ` · 새 의견 ${fresh}개` : ''}`;
  listEl.innerHTML = shown.length
    ? shown.map(card).join('')
    : `<p class="empty">${items.length ? '찾는 내용이 없어요.' : '아직 받은 의견이 없어요.'}</p>`;
}

searchEl.addEventListener('input', render);
$('adminRefresh').addEventListener('click', () => {
  const token = load('sessionStorage', TOKEN_KEY);
  if (token) fetchFeedback(token);
  else showSignIn('다시 로그인해 주세요.');
});

const saved = load('sessionStorage', TOKEN_KEY);
if (saved) fetchFeedback(saved);
else showSignIn('운영자 계정으로 로그인하면 받은 의견이 보여요.');
