// 프로필 사진(방마다 하나 — 백엔드 rooms.avatar_url). 첫 화면 위 줄의 이름 왼쪽, 기록 둘러보기
// 카드, ☰ 서랍의 기록 설정에서 씀. 사진이 없으면 인스타그램처럼 얼굴 없는 회색 실루엣.
import { photoSrc } from './photoSrc.js';
import { escapeAttr } from './dom.js';

const SILHOUETTE = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" fill="#DBDCDF"/>'
  + '<circle cx="20" cy="15.5" r="7" fill="#FFFFFF"/><path d="M5.5 40c1.6-8.6 7.4-13.2 14.5-13.2S32.9 31.4 34.5 40z" fill="#FFFFFF"/></svg>';

// .avatar 안에 넣을 것 — 사진 또는 기본 실루엣.
export function avatarInner(url) {
  if (!url) return SILHOUETTE;
  // crossorigin: 다른 사진들(itemFormat.js)과 같은 방식으로 받아 캐시가 섞이지 않게.
  return `<img src="${escapeAttr(photoSrc(url))}" alt="" loading="lazy" crossorigin="anonymous">`;
}

// <span class="avatar"> 통째로. label은 화면 읽기용 이름(예: "곽도현의 프로필 사진").
export function avatarHtml(url, { cls = '', label = '프로필 사진' } = {}) {
  return `<span class="avatar${cls ? ` ${cls}` : ''}" role="img" aria-label="${escapeAttr(label)}">${avatarInner(url)}</span>`;
}
