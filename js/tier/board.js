// 티어리스트 보드의 규칙 — 화면(DOM)과 상관없는 순수 함수만(tests/tier/board.test.js).
//
// 보드는 기록(방) 하나에 하나(2026-11-17 사용자 결정). 카테고리는 위 칩으로 거르기만 함 — 같은 보드에서
// 애니만 남기는 식. 줄은 SS · S · A · B · C · D · F와 아래 미배치("-").
// 어느 줄인지는: 방 주인이 직접 놓았으면 그 줄(record.tier), 아니면 별점으로 자동 —
// 별점은 반 별 단위라 10단계(0.5★ = 1점 … 5★ = 10점)이고 점수 하나가 줄 하나에 대응함.

export const TIERS = [
  { key: 'SS', color: '#FF5C8A' },
  { key: 'S', color: '#FF8A7A' },
  { key: 'A', color: '#FFB36B' },
  { key: 'B', color: '#FFD966' },
  { key: 'C', color: '#E8EC7A' },
  { key: 'D', color: '#B6E28C' },
  { key: 'F', color: '#9CCFF0' },
];
export const UNPLACED = '-';
export const ROW_KEYS = [...TIERS.map((t) => t.key), UNPLACED];

// 별점(0~5, 0.5 단위) → 줄. 10점 SS, 9점 S, 8점 A, 7점 B, 6점 C, 5점 D, 4점 이하 F, 별점 없음은 미배치.
export function tierFromRating(rating) {
  const points = Math.round((rating || 0) * 2);
  if (points <= 0) return UNPLACED;
  if (points >= 10) return 'SS';
  return { 9: 'S', 8: 'A', 7: 'B', 6: 'C', 5: 'D' }[points] || 'F';
}

export function tierOf(record) {
  return record.tier && ROW_KEYS.includes(record.tier) ? record.tier : tierFromRating(record.rating);
}

// 줄마다 기록 목록 { SS: [...], ..., '-': [...] }. 줄 안 순서: 직접 놓은 순서(tier_pos)가 있는 것 먼저,
// 그다음 기록한 날짜 최신순(같은 날이면 나중에 남긴 것 먼저).
export function buildRows(records) {
  const rows = Object.fromEntries(ROW_KEYS.map((k) => [k, []]));
  (records || []).forEach((r) => rows[tierOf(r)].push(r));
  const hasPos = (r) => r.tier != null && r.tier_pos != null;
  Object.values(rows).forEach((list) => list.sort((a, b) =>
    (hasPos(b) - hasPos(a))
    || (hasPos(a) && hasPos(b) ? a.tier_pos - b.tier_pos : 0)
    || (b.date || '').localeCompare(a.date || '')
    || (b.id || 0) - (a.id || 0)));
  return rows;
}

// id인 기록을 toKey 줄의 beforeId 앞(없으면 맨 뒤)으로 옮긴 새 rows와, 서버에 보낼 배치
// (바뀐 줄들의 기록 전부 — 줄과 그 줄 안 순서)를 돌려줌. 원래 rows는 안 바꿈.
export function moveRecord(rows, id, toKey, beforeId = null) {
  const next = Object.fromEntries(Object.entries(rows).map(([k, list]) => [k, list.slice()]));
  let fromKey = null;
  let rec = null;
  for (const [k, list] of Object.entries(next)) {
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) { fromKey = k; [rec] = list.splice(i, 1); break; }
  }
  if (!rec || !next[toKey]) return { rows, placements: [] };
  const dest = next[toKey];
  const at = beforeId == null ? -1 : dest.findIndex((r) => r.id === beforeId);
  if (at >= 0) dest.splice(at, 0, rec); else dest.push(rec);
  const changed = fromKey === toKey ? [toKey] : [fromKey, toKey];
  const placements = [];
  changed.forEach((k) => next[k].forEach((r, pos) => {
    const moved = { ...r, tier: k, tier_pos: pos };
    next[k][pos] = moved;
    placements.push({ id: r.id, tier: k, pos });
  }));
  return { rows: next, placements };
}
