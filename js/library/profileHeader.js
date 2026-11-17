// 첫 화면 맨 위 프로필 줄 — 프로필 사진 · 이름 · 그 아래 한 줄 소개 · (내 기록이면) 둘러보기 공개 스위치.
// 2026-11-17 사용자 요청: ☰ 서랍 안에 있던 이름·사진·소개·공개 설정을 밖으로 꺼내서, 누르면 그 자리에서
// 바로 고치게 함. 이 줄은 스크롤하면 같이 올라가고, 그 아래 메뉴 줄(☰ · 칩 · + 기록)만 위에 붙어 있음.
//
//   - 이름·소개: 누르면 입력 칸으로 바뀜. Enter나 바깥을 누르면 저장, Esc는 취소.
//   - 사진: 누르면 화면 가운데에 크게 — 내 기록이면 연필(파일 고르기)과 휴지통(기본 사진으로).
//     남의 기록이면 보기만.
import { API_BASE, DEVELOPER_ROOM_CODE } from '../shared/config.js';
import { roomTitle } from '../shared/room.js';
import { avatarInner } from '../shared/avatar.js';
import { renderVisibilityToggle } from '../shared/visibilityToggle.js';
import { saveName, saveBio, saveAvatar, uploadAvatar, NAME_MAX, BIO_MAX } from '../shared/profileApi.js';

const MY_LABEL = '내 기록';
const BIO_PLACEHOLDER = '한 줄 소개를 써 보세요';

const PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

// 글자를 누르면 그 자리에 입력 칸을 띄워 고침. save(값) → 저장된 값(Promise). 저장 중엔 다시 못 엶.
function makeEditable(el, { max, placeholder, read, save, show }) {
  let editing = false;
  el.classList.add('editable');
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  const open = () => {
    if (editing) return;
    editing = true;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit';
    input.maxLength = max;
    input.placeholder = placeholder;
    input.value = read() || '';
    input.setAttribute('aria-label', placeholder);
    el.hidden = true;
    el.after(input);
    input.focus();
    input.select();
    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;
      // 한글 마지막 글자가 조합 중이면 blur로 확정된 다음 값을 읽음(기록 창과 같은 이유).
      await new Promise((r) => setTimeout(r, 0));
      const value = input.value.trim();
      const close = () => { input.remove(); el.hidden = false; editing = false; };
      if (!commit || value === (read() || '')) { close(); return; }
      input.disabled = true;
      save(value)
        .then((saved) => { close(); show(saved); })
        .catch(() => { close(); el.classList.add('save-failed'); setTimeout(() => el.classList.remove('save-failed'), 1500); });
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  };
  el.addEventListener('click', open);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
}

// 사진 크게 보기 창. 내 기록이면 연필·휴지통. 바꾸면 onChange(새 주소 또는 null).
function makeAvatarDialog({ readOnly, mine, getUrl, onChange }) {
  const dialog = document.getElementById('avatarDialog');
  const big = document.getElementById('avatarBig');
  const actions = document.getElementById('avatarActions');
  const status = document.getElementById('avatarStatus');
  const file = document.getElementById('avatarFile');
  let returnFocus = null;

  function paintActions() {
    if (readOnly) { actions.innerHTML = ''; return; }
    actions.innerHTML = `
      <button type="button" class="icon-btn" data-act="edit" aria-label="사진 바꾸기" title="사진 바꾸기">${PENCIL}</button>
      ${getUrl() ? `<button type="button" class="icon-btn" data-act="delete" aria-label="사진 지우기" title="사진 지우기">${TRASH}</button>` : ''}`;
  }
  function paint() {
    big.innerHTML = avatarInner(getUrl());
    paintActions();
  }
  function open() {
    returnFocus = document.activeElement;
    status.textContent = '';
    paint();
    dialog.hidden = false;
    document.body.classList.add('modal-open');
    (actions.querySelector('button') || dialog.querySelector('.avatar-close')).focus();
  }
  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    document.body.classList.remove('modal-open');
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }
  const changed = (url) => { onChange(url); status.textContent = ''; paint(); };
  const failed = () => { status.textContent = '저장하지 못했어요. 잠시 후 다시 해 주세요.'; paintActions(); };

  actions.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'edit': file.click(); break;
      // 지우기는 바로 하지 않고 한 번 물음(사진은 다시 올려야 해서).
      case 'delete':
        actions.innerHTML = `
          <span class="confirm-text">기본 사진으로 바꿀까요?</span>
          <button type="button" class="text-btn danger" data-act="confirm-delete">지우기</button>
          <button type="button" class="text-btn" data-act="cancel">아니요</button>`;
        actions.querySelector('[data-act="cancel"]').focus();
        break;
      case 'confirm-delete':
        status.textContent = '지우는 중…';
        saveAvatar(mine, null).then(changed, failed);
        break;
      case 'cancel': paintActions(); break;
      default: break;
    }
  });
  file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    status.textContent = '올리는 중…';
    uploadAvatar(mine, f).then(changed, failed);
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.querySelector('.avatar-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { open };
}

// ctx: initRoomNav 결과 { mine, viewingCode, readOnly }.
export function initProfileHeader({ mine, viewingCode, readOnly }) {
  const head = document.getElementById('profileHead');
  if (!head) return;
  const avatarBtn = document.getElementById('avatarBtn');
  const avatarEl = document.getElementById('profileAvatar');
  const nameEl = document.getElementById('profileName');
  const bioEl = document.getElementById('profileBio');
  const visEl = document.getElementById('profileVis');
  const viewingDev = !!DEVELOPER_ROOM_CODE && viewingCode === DEVELOPER_ROOM_CODE.toUpperCase();
  const profile = { name: null, bio: null, avatar_url: null };

  const showName = () => {
    // 남의 기록은 "○○의 기록"(누구 것인지 바로 알게), 이름이 없으면 "친구의 기록"·"개발자의 기록".
    nameEl.textContent = !readOnly ? (profile.name || MY_LABEL)
      : viewingDev && !profile.name ? '개발자의 기록' : roomTitle(profile.name);
  };
  const showBio = () => {
    bioEl.textContent = profile.bio || (readOnly ? '' : BIO_PLACEHOLDER);
    bioEl.classList.toggle('bio-empty', !profile.bio); // 'empty'는 목록 안내 칸의 전역 스타일(큰 여백)과 겹쳐서 다른 이름
    // 소개가 없어도 줄은 남겨 둠(빈 줄) — 있을 때와 없을 때 이름 위치가 달라지지 않게.
    bioEl.setAttribute('aria-hidden', String(readOnly && !profile.bio));
  };
  const showAvatar = () => { avatarEl.innerHTML = avatarInner(profile.avatar_url); };
  showName(); showBio(); showAvatar();
  head.classList.toggle('mine', !readOnly);

  const dialog = makeAvatarDialog({
    readOnly,
    mine,
    getUrl: () => profile.avatar_url,
    onChange: (url) => { profile.avatar_url = url; showAvatar(); },
  });
  avatarBtn.addEventListener('click', dialog.open);
  avatarBtn.setAttribute('aria-label', readOnly ? '프로필 사진 크게 보기' : '프로필 사진 보기·바꾸기');

  if (!readOnly) {
    makeEditable(nameEl, {
      max: NAME_MAX, placeholder: '이름 (예: 도현의 기록)', read: () => profile.name,
      save: (v) => saveName(mine, v), show: (v) => { profile.name = v; showName(); },
    });
    makeEditable(bioEl, {
      max: BIO_MAX, placeholder: BIO_PLACEHOLDER, read: () => profile.bio,
      save: (v) => saveBio(mine, v), show: (v) => { profile.bio = v; showBio(); },
    });
  }

  fetch(`${API_BASE}/api/rooms/${encodeURIComponent(viewingCode)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((info) => {
      if (!info) return;
      Object.assign(profile, { name: info.name || null, bio: info.bio || null, avatar_url: info.avatar_url || null });
      showName(); showBio(); showAvatar();
      if (!readOnly) {
        visEl.hidden = false;
        renderVisibilityToggle(visEl, mine, info.is_public);
      }
    })
    .catch(() => {});
}
