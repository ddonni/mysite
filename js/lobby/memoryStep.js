// 꺼내 본 기록에서 옆 기록으로(2026-11-27 사용자 요청) — 서가 순서(k)대로 delta(±1)만큼, keep(k)가 참인 것만
// (그 사람 기록 안에서만). 끝에서 넘기면 처음으로. 갈 데가 없으면 null.
export function stepIndex(k, delta, n, keep) {
  for (let i = 1; i < n; i++) {
    const j = (((k + delta * i) % n) + n) % n;
    if (keep(j)) return j;
  }
  return null;
}
