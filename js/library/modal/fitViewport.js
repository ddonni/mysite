// 폰에서 키보드가 올라와도 기록 창이 키보드 뒤로 깔리지 않게 하는 위젯.
// 아이폰(안드로이드 크롬도 기본값은)은 키보드가 올라와도 position:fixed 창의 높이를
// 줄여 주지 않아서, 창 아래쪽(저장 버튼, 검색 목록 끝)이 키보드에 가려졌음.
//   - 창(.overlay)을 실제로 보이는 부분(visualViewport)에 맞춤 — 그 안에서만
//     스크롤되고, 저장·취소 줄은 CSS(position:sticky)로 그 아래쪽에 붙음.
//   - 제목·만든 사람 칸 아래 검색 목록이 저장 줄 위까지만 펼쳐지게 남은 높이를
//     --ac-room으로 알려 줌(library.css의 .ac-list max-height가 씀).
// visualViewport가 없는 브라우저에선 아무것도 안 함(예전처럼 CSS만으로).
const GAP = 8; // 목록 끝과 저장 줄 사이 여백

export function fitToViewport({ overlay, group, actions, win = window }) {
  const vv = win.visualViewport;
  if (!vv) return { update() {} };

  function update() {
    if (!overlay.classList.contains('open')) return;
    overlay.style.top = `${vv.offsetTop}px`;
    overlay.style.height = `${vv.height}px`;
    overlay.style.bottom = 'auto';
    // 목록은 두 칸 묶음(.title-group) 바로 아래에서 시작함(top:100% + 4px).
    const listTop = group.getBoundingClientRect().bottom + 4;
    const floor = Math.min(actions.getBoundingClientRect().top, overlay.getBoundingClientRect().bottom);
    group.style.setProperty('--ac-room', `${Math.max(0, Math.floor(floor - listTop - GAP))}px`);
  }

  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  overlay.addEventListener('scroll', update, { passive: true });
  return { update };
}
