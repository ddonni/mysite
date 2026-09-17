// sketchbook.html/library.html/index.html 셋 다 상단 .site-nav에 붙는
// "지금 어느 방을 보고 있는가" UI를 여기 한 곳에서 만듦 — 코드 복사,
// 다른 방 코드로 이동, 읽기 전용일 때 "내 방으로" 돌아가기.
import { getMyRoom, getViewingRoomCode, roomLink } from './room.js';

// currentPage: 지금 페이지 자신의 파일명(예: 'sketchbook.html') — 코드
// 입력창에서 "이동"을 누르면 같은 페이지를 그 방 코드로 다시 여는 데 씀.
export function initRoomNav({ navEl, currentPage }) {
  return getMyRoom().then((mine) => {
    const viewingCode = getViewingRoomCode(mine.code);
    const readOnly = viewingCode !== mine.code;

    // 로비/스케치북/기록보관소 사이를 오갈 때도 지금 보고 있는 방을 유지.
    navEl.querySelectorAll('a[data-page]').forEach((a) => {
      a.href = roomLink(a.dataset.page, viewingCode, mine.code);
    });

    const box = document.createElement('div');
    box.className = 'room-box';
    if (readOnly) {
      box.innerHTML = `
        <span class="room-tag readonly">방 <b>${viewingCode}</b> 보는 중 · 읽기 전용</span>
        <a class="room-home" href="${roomLink(currentPage, mine.code, mine.code)}">내 방으로</a>
      `;
    } else {
      box.innerHTML = `
        <span class="room-tag mine">내 방 코드 <b>${mine.code}</b></span>
        <button class="room-copy" type="button">복사</button>
      `;
    }
    navEl.appendChild(box);

    if (!readOnly) {
      const copyBtn = box.querySelector('.room-copy');
      copyBtn.addEventListener('click', () => {
        (navigator.clipboard ? navigator.clipboard.writeText(mine.code) : Promise.reject())
          .then(() => { copyBtn.textContent = '복사됨'; setTimeout(() => { copyBtn.textContent = '복사'; }, 1500); })
          .catch(() => {});
      });
    }

    const visitForm = document.createElement('form');
    visitForm.className = 'room-visit';
    visitForm.innerHTML = `
      <input type="text" maxlength="6" placeholder="방 코드로 방문" aria-label="방 코드">
      <button type="submit">이동</button>
    `;
    visitForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = visitForm.querySelector('input').value.trim().toUpperCase();
      if (code) window.location.href = roomLink(currentPage, code, mine.code);
    });
    navEl.appendChild(visitForm);

    return { mine, viewingCode, readOnly };
  });
}
