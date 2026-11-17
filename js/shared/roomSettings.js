// ☰ 서랍의 "계정" — 구글 계정 연결(브라우저가 바뀌어도 내 기록을 되찾게). 이름·프로필 사진·한 줄
// 소개·둘러보기 공개는 2026-11-17에 첫 화면 위 프로필 줄로 옮김(js/library/profileHeader.js — 누르면
// 바로 고침). roomNav.js가 첫 화면에서만 부름(구글 버튼 스크립트를 그 페이지만 불러서). 내 방일 때만.
import { initGoogleAuth } from './googleAuth.js';

export function renderRoomSettings(el, mine) {
  el.innerHTML = `
    <div class="drawer-section-title">구글 계정 연동</div>
    <div class="google-btn"></div>
    <div class="google-unlink-slot"></div>`;
  initGoogleAuth(el.querySelector('.google-btn'), mine, el.querySelector('.google-unlink-slot'));
}
