// 운영자 피드백 페이지(admin.html)의 화면 문구 — DOM 없음(테스트용으로 따로 뺌).

// 보낸 화면 경로(feedback.js가 location.pathname을 보냄, 예: "/mysite/library") → 이름.
const PAGE_NAMES = { '': '로비', index: '로비', library: '기록 보관소', sketchbook: '캔버스', rooms: '방 둘러보기' };

export function pageLabel(path) {
  if (!path) return '';
  const last = path.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '');
  const key = last === 'mysite' ? '' : last;
  return PAGE_NAMES[key] ?? path;
}

// "방금" / "5분 전" / "3시간 전" / "어제" / "4일 전", 일주일 넘으면 "10월 22일"(올해가 아니면 연도도).
export function timeAgo(iso, now = new Date()) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  const md = `${t.getMonth() + 1}월 ${t.getDate()}일`;
  return t.getFullYear() === now.getFullYear() ? md : `${t.getFullYear()}년 ${md}`;
}

// 검색창 — 내용·이름·방 코드에 그 글자가 들어 있는 것만(대소문자 무시).
export function filterFeedback(items, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((f) => [f.message, f.name, f.room_code].some((v) => v && v.toLowerCase().includes(needle)));
}

// 지난번에 본 것 중 가장 큰 id보다 큰 것 = 새 의견. 처음 열면(lastSeen 없음) 표시 안 함.
export function isNew(item, lastSeenId) {
  return lastSeenId != null && item.id > lastSeenId;
}
