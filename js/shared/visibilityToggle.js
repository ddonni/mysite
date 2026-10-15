// "방 둘러보기에 공개" 스위치 — 방 주인만 보임. 켜면 공개 방 목록
// (rooms.html, 서버 GET /api/rooms)에 내 방이 뜨고, 끄면 빠짐. 꺼져 있어도
// 방 코드를 아는 사람은 지금처럼 들어올 수 있음(목록에만 안 뜸).
// 로비 헤더(js/lobby/roomChrome.js)와 둘러보기 페이지(js/rooms/main.js)가 같이 씀.
import { API_BASE } from './config.js';

export function setRoomPublic(mine, isPublic) {
  return fetch(`${API_BASE}/api/rooms/${mine.code}/visibility`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Room-Token': mine.token },
    body: JSON.stringify({ public: isPublic }),
  }).then((res) => {
    if (!res.ok) throw new Error('visibility_failed');
    return res.json();
  }).then((body) => !!body.is_public);
}

// el 안에 스위치를 그림. onChange(isPublic)는 저장이 성공했을 때만 불림.
export function renderVisibilityToggle(el, mine, isPublic, { onChange } = {}) {
  el.innerHTML = `
    <button type="button" class="vis-toggle" role="switch">
      <span class="vis-track"><span class="vis-knob"></span></span>
      <span class="vis-label"></span>
    </button>
    <span class="vis-hint"></span>
  `;
  const btn = el.querySelector('.vis-toggle');
  const label = el.querySelector('.vis-label');
  const hint = el.querySelector('.vis-hint');
  let current = !!isPublic;

  function paint() {
    btn.setAttribute('aria-checked', String(current));
    label.textContent = current ? '둘러보기에 공개 중' : '둘러보기에 비공개';
    hint.textContent = current
      ? '누구나 방 목록에서 내 방을 구경할 수 있어요.'
      : '켜면 방 목록에 내 방이 떠요. 구경만 할 수 있어요.';
    // 설명 줄을 숨기는 곳(로비 헤더)에선 마우스를 올리면 보이게.
    btn.title = hint.textContent;
  }
  paint();

  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    btn.disabled = true;
    setRoomPublic(mine, !current)
      .then((saved) => {
        current = saved;
        paint();
        if (onChange) onChange(current);
      })
      .catch(() => {
        hint.textContent = '바꾸지 못했어요. 잠시 후 다시 시도해 주세요.';
      })
      .finally(() => { btn.disabled = false; });
  });
}
