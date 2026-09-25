// 여러 모듈에서 똑같이 필요한 아주 작은 DOM 유틸들을 모아둔 곳.
// (roomNav.js, lobby/main.js, library/list.js, shared/googleAuth.js가 씀)

// 사용자가 입력한 텍스트(제목/감상/이메일 등)를 innerHTML에 그대로 넣으면
// 안 되므로(예: <script> 삽입), 브라우저의 텍스트 이스케이프 기능을 빌려
// 안전한 문자열로 바꿔줌.
export function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// 속성값(src="…" 등)에 넣을 문자열 — escapeHtml은 따옴표를 안 바꿔서,
// 속성 안에 그대로 넣으면 "로 속성을 닫고 다른 속성을 끼워 넣을 수 있음.
export function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

// 클립보드 API가 없는 환경(구형 브라우저, http:// 등)에서도 안전하게
// 실패하는 복사 함수. 성공/실패 후처리(버튼 텍스트 바꾸기 등)는 호출한
// 쪽이 .then()/.catch()로 알아서 함.
export function copyToClipboard(text) {
  return navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject();
}
