import { THEMES } from './scene.js';
import { API_BASE } from '../shared/config.js';

const THEME_LABELS = { wood: '우드', night: '나이트', pastel: '파스텔' };

// 로비 3D 씬의 색 팔레트를 고르는 스와치 버튼들. 내 방일 때만 그려짐
// (main.js가 그 조건을 판단). 고르면 저장 후 새로고침해서 buildScene이
// 처음부터 새 팔레트로 다시 짓게 함.
export function renderThemePicker(picker, mine, current) {
  picker.innerHTML = '';
  Object.keys(THEMES).forEach((key) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-swatch';
    btn.style.background = '#' + THEMES[key].wall.toString(16).padStart(6, '0');
    btn.title = THEME_LABELS[key] || key;
    btn.setAttribute('aria-pressed', String(key === current));
    btn.addEventListener('click', () => {
      if (key === current || btn.disabled) return;
      btn.disabled = true;
      fetch(`${API_BASE}/api/rooms/${mine.code}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Room-Token': mine.token },
        body: JSON.stringify({ theme: key }),
      })
        // 씬 색상을 그때그때 다시 칠하는 대신, 저장 후 새로고침해서
        // buildScene이 처음부터 새 팔레트로 다시 짓게 함 — 훨씬 간단하고
        // 로비는 어차피 자주 여는 화면이 아니라 새로고침 비용이 적음.
        .then((res) => { if (res.ok) window.location.reload(); else btn.disabled = false; })
        .catch(() => { btn.disabled = false; });
    });
    picker.appendChild(btn);
  });
}
