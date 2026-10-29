// "목록으로 추가" 창에 붙여 넣은 글을 기록 후보 줄로 나눔(DOM 없음 — 테스트 대상).
// 메모장·노션·왓챠 등에서 복사한 목록을 그대로 받으려고, 줄 앞의 번호("1.", "2)")와
// 글머리표("-", "•", 체크박스)는 떼고, "제목 / 작가"처럼 앞뒤에 띄어쓰기가 있는 /로
// 만든 사람을 같이 받음 — 띄어쓰기를 요구하는 건 "Fate/stay night" 같은 제목을 안
// 쪼개려고.
import { squash } from '../modal/recordSearch.js';

// 한 번에 받는 줄 수 — 줄마다 검색을 한 번(영화·애니는 감독까지 두 번) 보내서, 백엔드
// 검색 한도(시간당 600, search_routes.py)를 한 번에 많이 쓰지 않게.
export const MAX_LINES = 50;

// 맨 앞의 번호·글머리표·체크박스. 번호는 뒤에 띄어쓰기나 숫자 아닌 글자가 와야 뗌
// ("1984", "2.5차원의 유혹"은 제목).
const LEAD = /^\s*(?:[-*•·◦▪–—]|\[[ xX]?\]|[☐☑✓✔]|\(?\d{1,3}[.)]\s|\d{1,3}[.)](?=[^\d\s]))\s*/;

function stripLead(line) {
  let s = line;
  // "- [ ] 1. 데미안"처럼 여러 개가 겹친 경우까지.
  for (let i = 0; i < 3; i++) {
    const next = s.replace(LEAD, '');
    if (next === s) break;
    s = next;
  }
  return s.trim();
}

// → { items: [{ title, creator }], overflow: 잘린 줄 수 }. 같은 제목(띄어쓰기·대소문자
// 무시)이 두 번 나오면 처음 것만.
export function parseList(text) {
  const seen = new Set();
  const items = [];
  let overflow = 0;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = stripLead(raw);
    if (!line) continue;
    const cut = line.indexOf(' / ');
    const title = (cut >= 0 ? line.slice(0, cut) : line).trim();
    const creator = cut >= 0 ? line.slice(cut + 3).trim() : '';
    if (!title) continue;
    const key = squash(title);
    if (seen.has(key)) continue;
    seen.add(key);
    if (items.length >= MAX_LINES) { overflow++; continue; }
    items.push({ title, creator });
  }
  return { items, overflow };
}
