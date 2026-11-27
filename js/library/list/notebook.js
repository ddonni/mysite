// "내 방" 책상 위 공책을 누르면 뜨는 ?! 모음(2026-11-27 사용자 요청 "?!는 벽에서 빼고 그 책을 클릭해야 볼 수 있게,
// 그 화면은 날짜와 내용이 보여야"). 최신순으로 날짜 + 내용(글 · 사진 · 유튜브 썸네일 — 누르면 작은 플레이어).
// 보기만 함(고치기는 편집 화면의 ?! 카드에서). 바깥·×·Esc로 닫힘.
import { escapeHtml, escapeAttr } from '../../shared/dom.js';
import { photoSrc } from '../../shared/photoSrc.js';
import { youtubeThumb } from '../noteText.js';

// "2026-11-25" → "2026.11.25"
export const noteDate = (d) => (d || '').replace(/-/g, '.');

// 최신순(날짜, 같은 날이면 나중에 넣은 것 먼저).
export function notesNewestFirst(notes) {
  return notes.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || 0) - (a.id || 0));
}

function entryHtml(it) {
  const thumb = youtubeThumb(it.listen_url);
  return `
    <article class="nb-entry" data-id="${escapeAttr(String(it.id))}">
      <time class="nb-date" datetime="${escapeAttr(it.date || '')}">${escapeHtml(noteDate(it.date))}</time>
      ${it.memo ? `<p class="nb-text">${escapeHtml(it.memo)}</p>` : ''}
      ${it.photo_url ? `<img class="nb-photo" src="${escapeAttr(photoSrc(it.photo_url))}" alt="" loading="lazy" crossorigin="anonymous">` : ''}
      ${it.listen_url ? `<button type="button" class="nb-video" data-act="listen" aria-label="영상 보기">${thumb
        ? `<img src="${escapeAttr(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span class="nb-play">▶</span></button>` : ''}
    </article>`;
}

// onListen(it): 유튜브를 누르면(작은 플레이어). → { open(notes), close }
export function createNotebook({ onListen } = {}) {
  let el = null;
  let items = [];
  let returnFocus = null;
  const close = () => {
    if (!el || el.hidden) return;
    el.hidden = true;
    document.body.classList.remove('modal-open');
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  };
  const build = () => {
    el = document.createElement('div');
    el.className = 'notebook';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '?! 공책');
    el.hidden = true;
    el.innerHTML = `
      <div class="nb-paper">
        <header class="nb-head"><h2>?!</h2><button type="button" class="nb-close" aria-label="닫기">×</button></header>
        <div class="nb-list"></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      if (e.target === el) { close(); return; }
      const play = e.target.closest('[data-act="listen"]');
      if (play && onListen) {
        const id = play.closest('.nb-entry').dataset.id;
        const it = items.find((x) => String(x.id) === id);
        if (it) onListen(it);
      }
    });
    el.querySelector('.nb-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  };
  function open(notes) {
    if (!el) build();
    items = notesNewestFirst(notes);
    returnFocus = document.activeElement;
    el.querySelector('.nb-list').innerHTML = items.length
      ? items.map(entryHtml).join('')
      : '<p class="nb-empty">아직 아무것도 없어요.</p>';
    el.hidden = false;
    document.body.classList.add('modal-open');
    el.querySelector('.nb-list').scrollTop = 0;
    el.querySelector('.nb-close').focus();
  }
  return { open, close };
}
