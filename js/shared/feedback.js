// 모든 페이지 상단 메뉴의 "의견 보내기" — 피드백을 카톡으로 따로 받아 손으로
// 옮겨 적던 걸 사이트 안에서 바로 받으려고 만듦. 백엔드 POST /api/feedback에
// 저장만 하고, 읽는 화면은 없음(운영자가 서버에서 psql로 봄).
//
// 페이지마다 main.js가 따로라서, 각 html이 이 파일을 <script type="module">로
// 따로 불러옴 — 페이지 본체 스크립트가 실패해도 의견은 보낼 수 있게.
// 창(dialog)은 처음 누를 때 여기서 만들어 body에 붙임.
import { API_BASE } from './config.js';
import { getStoredRoom, getViewingRoomCode } from './room.js';

// 백엔드 schemas.FeedbackIn의 길이 제한과 같아야 함.
export const MESSAGE_MAX = 1000;
export const NAME_MAX = 30;

// 서버 응답을 화면 문구로 바꿈. 429는 IP당 한 시간 60개 제한(백엔드 main.py).
export function errorMessage(status) {
  if (status === 429) return '짧은 시간에 너무 많이 보내셨습니다. 잠시 후 다시 보내 주세요.';
  return '보내지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

// 성공하면 resolve, 실패하면 화면에 보여줄 문구를 담아 reject.
// page/room_code는 "어느 화면·어느 방을 보다가 썼는지" 맥락용.
export function sendFeedback({ message, name }) {
  const stored = getStoredRoom();
  const body = {
    message,
    name: name || null,
    page: location.pathname,
    room_code: getViewingRoomCode(stored ? stored.code : null) || null,
  };
  return fetch(API_BASE + '/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(
    (res) => { if (!res.ok) throw new Error(errorMessage(res.status)); },
    () => { throw new Error(errorMessage(0)); },
  );
}

function buildDialog() {
  const dialog = document.createElement('div');
  dialog.className = 'feedback-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'feedbackTitle');
  dialog.hidden = true;
  dialog.innerHTML = `
    <form class="feedback-card" novalidate>
      <h2 id="feedbackTitle">의견 보내기</h2>
      <p class="feedback-lead">있었으면 하는 기능, 불편했던 점 등 무엇이든 편하게 적어 주세요. 개발자만 읽습니다.</p>
      <label class="feedback-field">
        <span>내용</span>
        <textarea name="message" rows="5" maxlength="${MESSAGE_MAX}" placeholder="예: 캔버스에서 색을 RGB 값으로 고를 수 있으면 좋겠습니다"></textarea>
      </label>
      <label class="feedback-field">
        <span>이름 (선택)</span>
        <input type="text" name="name" maxlength="${NAME_MAX}" autocomplete="nickname" placeholder="적어 주시면 나중에 더 여쭤볼 수 있습니다">
      </label>
      <p class="feedback-status" role="status" aria-live="polite"></p>
      <div class="feedback-actions">
        <button type="button" class="feedback-cancel">닫기</button>
        <button type="submit" class="feedback-send">보내기</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  return dialog;
}

export function initFeedback() {
  const openBtns = document.querySelectorAll('[data-feedback-open]');
  if (!openBtns.length) return;

  let dialog = null;
  let returnFocus = null;
  let closeTimer = null;

  function close() {
    if (!dialog || dialog.hidden) return;
    clearTimeout(closeTimer);
    dialog.hidden = true;
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }

  function setup() {
    dialog = buildDialog();
    const form = dialog.querySelector('form');
    const messageEl = form.elements.message;
    const nameEl = form.elements.name;
    const statusEl = dialog.querySelector('.feedback-status');
    const sendBtn = dialog.querySelector('.feedback-send');

    dialog.querySelector('.feedback-cancel').addEventListener('click', close);
    // 카드 바깥(어두운 배경)을 눌러도 닫힘. 쓰던 내용은 그대로 남아 있음.
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = messageEl.value.trim();
      if (!message) {
        statusEl.textContent = '내용을 적어 주세요.';
        statusEl.dataset.kind = 'error';
        messageEl.focus();
        return;
      }
      sendBtn.disabled = true;
      statusEl.textContent = '보내는 중…';
      statusEl.dataset.kind = '';
      sendFeedback({ message, name: nameEl.value.trim() })
        .then(() => {
          form.reset();
          statusEl.textContent = '감사합니다! 잘 받았습니다.';
          statusEl.dataset.kind = 'ok';
          closeTimer = setTimeout(close, 1500);
        })
        .catch((err) => {
          statusEl.textContent = err.message;
          statusEl.dataset.kind = 'error';
        })
        .finally(() => { sendBtn.disabled = false; });
    });
  }

  function open() {
    if (!dialog) setup();
    returnFocus = document.activeElement;
    const statusEl = dialog.querySelector('.feedback-status');
    // 보내고 닫힌 뒤 다시 열면 지난 "잘 받았습니다"는 지움(실패 문구는 남겨 둠).
    if (statusEl.dataset.kind === 'ok') { statusEl.textContent = ''; statusEl.dataset.kind = ''; }
    dialog.hidden = false;
    dialog.querySelector('textarea').focus();
  }

  openBtns.forEach((btn) => btn.addEventListener('click', open));
}

initFeedback();
