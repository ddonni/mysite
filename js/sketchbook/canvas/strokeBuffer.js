// "지금 페이지에 어떤 획들이 쌓여 있는가"만 관리하는 순수 데이터
// 저장소 — DOM/캔버스와 전혀 무관해서 단독으로 테스트하기도 쉬움.
// 서버(혹은 로컬 저장소)에 이미 저장된 것(server)과, 아직 저장 중이라
// 서버가 모를 수도 있는 것(pending)을 나눠 관리하고, 화면엔 둘을
// 합쳐서(merged()) 보여줌.
const MAX_STROKES = 300; // 한 페이지에 너무 많은 획이 쌓이면 오래된 것부터 버림

export function createStrokeBuffer() {
  let server = [];
  let pending = [];
  // loadPage()가 호출될 때마다 1씩 늘어나는 "세대" 번호. 예를 들어
  // "1페이지 저장 중"에 사용자가 후루룩 "2페이지로" 넘겨버리면, 뒤늦게
  // 도착한 1페이지 저장 완료 응답이 2페이지의 상태를 덮어쓰면 안 됨 —
  // 저장을 요청한 시점의 세대와 응답이 도착했을 때의 세대가 다르면 그
  // 응답은 무시함(reconcile에서 비교).
  let generation = 0;

  function merged() {
    // 같은 id를 가진 획은 pending 쪽(더 최신)을 우선해서 하나만 남기고,
    // 처음 등장한 순서를 유지함(그려진 순서가 곧 화면에 그려지는
    // 순서라서 순서가 중요함).
    const byId = {};
    const order = [];
    server.forEach((s) => { if (!byId[s.id]) order.push(s.id); byId[s.id] = s; });
    pending.forEach((s) => { if (!byId[s.id]) order.push(s.id); byId[s.id] = s; });
    return order.map((id) => byId[id]);
  }

  return {
    merged,
    get generation() { return generation; },

    addPending(stroke) { pending.push(stroke); },

    // 지금 상태를 저장하러 보낼 때 씀 — 너무 길면 오래된 것부터 잘라냄.
    snapshotForSave() {
      let strokes = merged();
      if (strokes.length > MAX_STROKES) strokes = strokes.slice(strokes.length - MAX_STROKES);
      return { strokes, gen: generation, ids: strokes.map((s) => s.id) };
    },

    // 저장이 끝났다고 서버가 알려주면, pending 중 이미 저장된 것들을
    // 걷어내고 server를 갱신함. gen이 그사이 페이지 전환으로 바뀌었으면
    // (더 이상 유효하지 않은 응답이므로) 무시함.
    reconcile(gen, savedStrokes, savedIds) {
      if (gen !== generation) return;
      server = savedStrokes;
      pending = pending.filter((s) => savedIds.indexOf(s.id) === -1);
    },

    // 다른 페이지로 이동하거나(strokes=서버에서 받아온 내용), 아직
    // 로딩 전이라 일단 비워둘 때(strokes=[]) 둘 다 이걸로 처리.
    loadPage(strokes) {
      generation++;
      server = strokes;
      pending = [];
    },

    // 다른 사람(또는 다른 탭)이 같은 페이지에 실시간으로 그린 내용이
    // 도착했을 때.
    applyRemote(strokes) { server = strokes; },

    clear() { server = []; pending = []; },

    // authorId가 그린 획 중 가장 최근 것을 하나 지움 — 아직 저장 안 된
    // pending 쪽을 먼저 보고, 없으면 이미 저장된 server 쪽에서 찾음.
    // 지웠으면 true, 지울 게 없었으면 false를 돌려줌.
    removeLastByAuthor(authorId) {
      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i].author === authorId) { pending.splice(i, 1); return true; }
      }
      for (let j = server.length - 1; j >= 0; j--) {
        if (server[j].author === authorId) { server.splice(j, 1); return true; }
      }
      return false;
    },
  };
}
