// 빈 방 안내 — 내 방에 기록이 없는 동안 "어디서 시작하나"를 방 안에서 알려줌
// (처음 온 사람 피드백). 환영 카드(helpDialog.js)는 한 번만 뜨지만 이건 기록이 생길
// 때까지 계속:
//   - 기록이 하나도 없으면 오른쪽 아래 카테고리 버튼 위에 "여기서 첫 기록을 남겨
//     보세요" 말풍선(환영 카드·도움말이 떠 있는 동안은 CSS가 숨김, 버튼을 누르면 치움).
//   - 비어 있는 카테고리의 가구를 누르면 카드 문구가 "아직 책이 없어요…"로, 버튼이
//     "첫 책 기록하기"로 바뀌고, 누르면 기록 보관소에서 새 기록 창이 바로 열림(new=1).
// 남의 방에선 아무것도 안 함(기록은 주인만 남길 수 있어서).
import { roomContext, roomRecords } from './roomContext.js';

const EMPTY_CARD = {
  book: { body: '아직 책이 없어요. 첫 책을 기록하면 책장에 꽂혀요.', enter: '첫 책 기록하기' },
  anime: { body: '아직 애니가 없어요. 기록하면 아크릴 스탠드로 진열돼요.', enter: '첫 애니 기록하기' },
  movie: { body: '아직 영화가 없어요. 기록하면 포스터로 한 장씩 붙어요.', enter: '첫 영화 기록하기' },
  music: { body: '아직 음악이 없어요. 기록하면 LP로 꽂히고 턴테이블에서 돌아가요.', enter: '첫 음악 기록하기' },
};

// roomInfo: main.js의 ROOM_INFO(가구 카드 문구) — 빈 카테고리 것만 고쳐 씀(controls.js가
// 카드를 열 때마다 이 객체를 읽어서 바로 반영됨). 돌려주는 Set은 비어 있는 카테고리 —
// main.js가 "입장하기"를 새 기록 창으로 보낼지 정하는 데 씀(기록을 받기 전엔 비어 있음).
export function initEmptyRoom(roomInfo) {
  const empty = new Set();
  Promise.all([roomContext, roomRecords]).then(([ctx, records]) => {
    if (ctx.readOnly || !Array.isArray(records)) return;
    Object.keys(EMPTY_CARD).forEach((cat) => {
      if (records.some((r) => r.cat === cat)) return;
      empty.add(cat);
      Object.assign(roomInfo[cat], EMPTY_CARD[cat]);
    });
    if (records.length === 0) showHint();
  }).catch(() => {});
  return empty;
}

// 환영 카드·도움말이 떠 있는 동안은 CSS가 숨김(body.help-open — helpDialog.js).
function showHint() {
  const hint = document.getElementById('ctaHint');
  if (!hint) return;
  hint.hidden = false;
  document.querySelectorAll('#cta .room-btn').forEach((b) => b.addEventListener('click', () => {
    hint.hidden = true;
  }));
}
