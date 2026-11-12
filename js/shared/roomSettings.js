// ☰ 서랍의 "방 설정" — 방 이름, 둘러보기 공개 스위치, 구글 계정 연결. 예전엔 3D 방(로비)
// 머리말에 있던 것들로, 첫 화면이 카드 화면이 되면서 서랍으로 옮김(roomNav.js가 첫 화면에서만
// 부름 — 구글 버튼 스크립트를 그 페이지만 불러서). 내 방일 때만 그림.
import { API_BASE } from './config.js';
import { initGoogleAuth } from './googleAuth.js';
import { renderVisibilityToggle } from './visibilityToggle.js';

// 기록 이름 — 비우면 이름 없음("내 기록"). 저장하면 onRenamed(새 이름) — 위 줄 표시를 바꿈.
function renderNameForm(el, mine, name, onRenamed) {
  el.innerHTML = `
    <form class="room-name-form">
      <label for="roomNameInput">이름</label>
      <div class="room-name-row">
        <input type="text" id="roomNameInput" maxlength="20" placeholder="예: 도현의 기록" autocomplete="off">
        <button type="submit">저장</button>
      </div>
    </form>`;
  const form = el.querySelector('form');
  const input = form.querySelector('input');
  const btn = form.querySelector('button');
  input.value = name || '';
  const flash = (label) => { btn.textContent = label; setTimeout(() => { btn.textContent = '저장'; }, 1200); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true;
    // 한글 마지막 글자가 아직 조합 중이면 확정시킨 다음 값을 읽음 — 안 그러면 Enter를
    // 누른 순간 마지막 한 글자가 빠진 채 저장될 수 있음.
    input.blur();
    await new Promise((r) => setTimeout(r, 0));
    fetch(`${API_BASE}/api/rooms/${encodeURIComponent(mine.code)}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Room-Token': mine.token },
      body: JSON.stringify({ name: input.value.trim() }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((saved) => { input.value = saved.name || ''; flash('저장됨'); if (onRenamed) onRenamed(saved.name); })
      .catch(() => flash('실패'))
      .finally(() => { btn.disabled = false; });
  });
}

// el: 서랍 안 빈 자리. info: GET /api/rooms/{code} 결과(이름·공개 여부) — 못 받았으면 null.
export function renderRoomSettings(el, mine, info, { onRenamed } = {}) {
  el.innerHTML = `
    <div class="drawer-section-title">기록 설정</div>
    <div class="settings-name"></div>
    <div class="vis-box"></div>
    <div class="google-title">구글 계정 연동</div>
    <div class="google-btn"></div>
    <div class="google-unlink-slot"></div>`;
  renderNameForm(el.querySelector('.settings-name'), mine, info && info.name, onRenamed);
  if (info) renderVisibilityToggle(el.querySelector('.vis-box'), mine, info.is_public);
  initGoogleAuth(el.querySelector('.google-btn'), mine, el.querySelector('.google-unlink-slot'));
}
