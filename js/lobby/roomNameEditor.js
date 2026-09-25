import { roomApi } from './roomContext.js';

// 헤더 제목을 방 이름으로 바꿔서 "누구 방인지" 보여줌(이름이 없으면 내 방은
// "내 방", 남의 방은 "친구의 방"). 제목 위 작은 영문도 같이 맞춤.
// 내 방이면 제목을 클릭했을 때만 이름을 짓고 고치는 입력칸이 열리고(평소엔
// 숨김), 남의 방이면 읽기 전용이라 이름만 보임.
export function renderRoomName(ctx, name) {
  const h1 = document.querySelector('#header h1');
  const eyebrow = document.querySelector('#header .eyebrow');
  if (eyebrow) eyebrow.textContent = ctx.readOnly ? "Friend's Room" : 'My Room';
  const fallback = ctx.readOnly ? '친구의 방' : '내 방';
  const showName = (n) => {
    if (h1) h1.textContent = n || fallback;
    document.title = n || fallback;
  };
  showName(name);

  const box = document.getElementById('roomName');
  if (!box || ctx.readOnly) return;
  box.innerHTML = `
    <form class="room-name-form" hidden>
      <input type="text" maxlength="20" placeholder="방 이름 (최대 20자)" aria-label="방 이름">
      <button type="submit">저장</button>
    </form>
  `;
  const form = box.querySelector('.room-name-form');
  const input = form.querySelector('input');
  const btn = form.querySelector('button');
  input.value = name || '';

  const openForm = () => { form.hidden = false; input.focus(); input.select(); };
  const closeForm = () => { form.hidden = true; };
  if (h1) {
    // 제목 자체가 버튼 역할: 클릭(또는 Enter/Space)하면 입력칸이 열리고 닫힘.
    h1.classList.add('editable');
    h1.tabIndex = 0;
    h1.setAttribute('role', 'button');
    h1.title = '클릭해서 방 이름 바꾸기';
    const toggle = () => (form.hidden ? openForm() : closeForm());
    h1.addEventListener('click', toggle);
    h1.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeForm(); });

  const flash = (label) => {
    btn.textContent = label;
    setTimeout(() => { btn.textContent = '저장'; }, 1200);
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    btn.disabled = true;
    fetch(`${roomApi(ctx)}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Room-Token': ctx.mine.token },
      body: JSON.stringify({ name: input.value.trim() }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((saved) => { showName(saved.name); input.value = saved.name || ''; closeForm(); })
      .catch(() => flash('실패'))
      .finally(() => { btn.disabled = false; });
  });
}
