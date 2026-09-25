import { DEFAULT_THEME } from './scene.js';
import { roomInfo, pageUrl, lobbyUrl } from './roomContext.js';
import { renderRoomName } from './roomNameEditor.js';
import { renderThemePicker } from './themePicker.js';
import { initGoogleAuth } from '../shared/googleAuth.js';
import { copyToClipboard } from '../shared/dom.js';

// 방 코드 표시 + 다른 방 방문 폼(+ 남의 방을 보는 중이면 "내 방으로"),
// 구글 계정 연동, 방 이름/테마 스위처까지 — 로비 헤더/카드 "주변" UI를
// 전부 채움. 3D든 폴백 링크 화면이든 둘 다에 있는 .room-info 자리를
// 똑같이 채움(둘 중 하나만 실제로 보임). main.js가 roomContext가
// resolve된 뒤 한 번 불러줌.
export function initRoomChrome(ctx) {
  const { mine, viewingCode, readOnly } = ctx;

  document.querySelectorAll('.room-info').forEach((el) => {
    const visitForm = `
      <form class="room-visit">
        <input type="text" maxlength="6" placeholder="방 코드로 방문" aria-label="방 코드">
        <button type="submit">방문</button>
      </form>
    `;
    if (readOnly) {
      el.innerHTML = `
        <span class="room-tag readonly">방 <b class="viewing-code"></b> 보는 중 · 읽기 전용</span>
        <a class="room-home" href="${lobbyUrl(mine.code, mine.code)}">내 방으로</a>
      ` + visitForm;
      // 주소창의 ?room= 값이라 아무 문자열이나 들어올 수 있음 — innerHTML에
      // 직접 끼우지 않고 textContent로 넣어서 HTML 주입을 막음.
      el.querySelector('.viewing-code').textContent = viewingCode;
    } else {
      el.innerHTML = `
        <span class="room-tag">내 방 코드 <b>${mine.code}</b></span>
        <button class="room-copy" type="button">복사</button>
      ` + visitForm;
      // 복사됐는지 알 수 있게 버튼 글자를 잠깐 "복사됨"으로 바꿈.
      const copyBtn = el.querySelector('.room-copy');
      copyBtn.addEventListener('click', () => {
        copyToClipboard(mine.code)
          .then(() => {
            copyBtn.textContent = '복사됨';
            setTimeout(() => { copyBtn.textContent = '복사'; }, 1200);
          })
          .catch(() => {});
      });
    }
    el.querySelector('.room-visit').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = el.querySelector('.room-visit input').value.trim().toUpperCase();
      if (code) window.location.href = lobbyUrl(code, mine.code);
    });
  });

  if (readOnly) {
    // 폴백 링크 화면의 정적 링크들도 이 방을 이어서 보게 함. 테마 변경과
    // 구글 계정 연결은 내 방을 바꾸는 일이라 남의 방에선 아예 안 그림.
    document.querySelectorAll('#fallbackLinks a').forEach((a) => {
      a.href = pageUrl(a.getAttribute('href'), ctx);
    });
  } else {
    // 3D 로비든 폴백 링크 화면이든 상관없이 "구글 계정으로 방 복구/연결"
    // 자리를 둠 — 이미 연동된 계정이 있으면 버튼 대신 그 이메일을 보여주고,
    // GOOGLE_CLIENT_ID가 안 채워져 있으면 initGoogleAuth이 그냥 아무것도 안 그림.
    const unlinkEl = document.getElementById('googleUnlink');
    document.querySelectorAll('.google-btn').forEach((el) => initGoogleAuth(el, mine, unlinkEl));
  }

  // 방 이름(누구 방인지)과 테마 스위처는 방 정보를 받아와야 그릴 수 있음.
  // 조회가 실패해도 이름 없음 + 기본 테마로 그대로 그림.
  roomInfo
    .then((info) => (info && !info.missing ? info : null), () => null)
    .then((info) => {
      renderRoomName(ctx, info && info.name);
      // 3D 로비에만 있는 테마 스위처(폴백 링크 화면엔 #themePicker 자체가 없음).
      // 남의 방의 테마는 바꿀 수 없으니 내 방일 때만 그림.
      const picker = document.getElementById('themePicker');
      if (picker && !readOnly) renderThemePicker(picker, mine, (info && info.theme) || DEFAULT_THEME);
    });
}
