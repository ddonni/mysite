// "구글 계정으로 내 방 복구/연결" — 로그인 시스템이 아니라, 이 브라우저의
// localStorage가 지워지거나(캐시 삭제, 새 기기) 원래 방을 잃어버렸을 때
// 구글 계정으로 token을 되찾아오기 위한 기능. 서버(POST /api/auth/google)
// 가 "이 구글 계정이 이미 어떤 방에 연결돼 있으면 그 방을 돌려주고,
// 아니면 지금 브라우저가 갖고 있는 방에 새로 연결"을 한 번에 처리해줘서,
// 버튼도 콜백도 하나로 끝남 — "연결하기"/"복구하기" 버튼을 따로 안 둠.
import { API_BASE, GOOGLE_CLIENT_ID } from './config.js';
import { getStoredRoom, adoptRoom } from './room.js';

// index.html이 <script src=".../gsi/client">를 THREE.js처럼 모듈
// 스크립트보다 먼저 (async/defer 없이) 불러와서, 이 모듈이 실행되는
// 시점엔 전역 google이 이미 준비돼 있음.
export function renderGoogleButton(containerEl) {
  if (!GOOGLE_CLIENT_ID || typeof google === 'undefined' || !containerEl) return; // 설정 안 했으면 버튼 자체를 안 띄움

  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
  google.accounts.id.renderButton(containerEl, { type: 'standard', theme: 'outline', size: 'medium', text: 'signin_with' });
}

function handleCredential(response) {
  const stored = getStoredRoom();
  fetch(`${API_BASE}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_token: response.credential,
      current_code: stored && stored.code,
      current_token: stored && stored.token,
    }),
  })
    .then((res) => (res.ok ? res.json() : Promise.reject()))
    .then(({ code, token, linked_new }) => {
      if (linked_new) {
        // 처음 연결된 것 — 지금 방은 그대로고, 나중에 이 계정으로
        // 로그인하면 이 방을 되찾을 수 있다는 것만 알려주면 됨.
        alert('구글 계정을 이 방에 연결했어요. 나중에 다른 기기에서 같은 계정으로 로그인하면 이 방을 불러올 수 있어요.');
        return;
      }
      if (stored && stored.code === code) {
        alert('이미 이 방에 연결된 계정이에요.');
        return;
      }
      // 이미 다른 방에 연결된 계정으로 로그인한 경우 — 지금 방을 덮어쓰는
      // 되돌리기 어려운 전환이라 한 번 확인함.
      if (stored && !confirm(`이 구글 계정에 연결된 방(${code})을 불러올까요? 지금 브라우저의 방은 더 이상 안 보여요.`)) {
        return;
      }
      adoptRoom({ code, token });
      window.location.reload();
    })
    .catch(() => alert('구글 로그인에 실패했어요. 잠시 후 다시 시도해주세요.'));
}
