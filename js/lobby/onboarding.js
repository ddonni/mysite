// 빈 보관소 안내 — 내 기록이 하나도 없는 동안 아래 버튼 위에 "첫 기록을 남기면 서가에 첫 권이 꽂혀요"
// (누르면 카드 화면의 새 기록 창). 환영 카드(helpDialog.js)는 한 번만 뜨지만 이건 기록이 생길 때까지.
// 환영 카드·도움말이 떠 있는 동안은 CSS가 숨김. 남의 방에선 아무것도 안 함.
import { roomContext, roomRecords, pageUrl } from './roomContext.js';

export function initEmptyRoom() {
  Promise.all([roomContext, roomRecords]).then(([ctx, records]) => {
    if (ctx.readOnly || !Array.isArray(records) || records.length) return;
    const hint = document.getElementById('ctaHint');
    if (!hint) return;
    hint.href = pageUrl('./?cat=book&new=1', ctx);
    hint.hidden = false;
  }).catch(() => {});
}
