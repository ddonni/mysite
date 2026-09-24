import { roomApi } from './roomContext.js';

// 지금 보는 방의 실제 데이터(스트로크/기록)를 서버에서 받아와 3D 씬의
// 각 가구를 채움 — 이젤 보드, 턴테이블 LP, 벽 액자 3개, 책장.
// sceneSetters는 buildScene()이 돌려준 set* 함수들을 그대로 넘기면 됨.
// 셋 다 독립적인 요청이라 하나가 실패해도(catch) 나머지는 그대로
// 채워짐 — 로비 자체가 어느 하나의 실패로 멎지 않게 함.
export function loadRoomIntoScene(ctx, sceneSetters) {
  const { setSketchbookPreview, setFeaturedSong, setFeaturedWorks, setLibraryBooks } = sceneSetters;

  // 이젤 보드에 지금 보는 방의 1페이지 그림을 채워넣음. 실시간 동기화는
  // 필요 없어서(로비에서 그리는 기능도 없음) 로드 시 한 번만 조회. 읽기는
  // 방 코드만 있으면 되니 남의 방이어도 그대로 동작함.
  fetch(`${roomApi(ctx)}/pages/1`)
    .then((res) => (res.ok ? res.json() : null))
    .then((page) => { if (page) setSketchbookPreview(page.strokes || []); })
    .catch(() => {}); // 실패해도 이젤은 그냥 빈 종이로 남아있을 뿐, 로비 자체는 멀쩡히 작동함

  // 턴테이블에 대표곡(가장 최근에 추가한 음악 기록)을 채워넣음 —
  // 목록은 이미 최신순 정렬이라 첫 번째 항목이 곧 최신곡.
  fetch(`${roomApi(ctx)}/records?cat=music`)
    .then((res) => (res.ok ? res.json() : []))
    .then((records) => { if (records && records.length) setFeaturedSong(records[0]); })
    .catch(() => {}); // 실패해도 턴테이블은 기본 상태로 남을 뿐, 로비 자체는 멀쩡히 작동함

  // 벽 액자 3개(왼쪽/가운데/오른쪽) + 책장을 실제 기록으로 채워넣음.
  // 같은 목록을 두 군데에 다 쓰므로 요청은 한 번만 함:
  //  - 가운데 액자: library.html에서 별표(⭐)로 직접 지정한 기록이
  //    있으면 그걸 쓰고, 없으면 책/애니/영화 중 가장 최근 기록으로
  //    대신함(목록이 이미 최신순 정렬이라 그중 첫 항목) — 가장 눈에
  //    띄는 자리라 "대표작"을 걺.
  //  - 왼쪽/오른쪽 액자: 가운데를 뺀 나머지 중 최신 두 개.
  //  - 책장: 음악을 뺀 나머지 기록 전부의 제목으로 그 개수만큼만 채움.
  fetch(`${roomApi(ctx)}/records`)
    .then((res) => (res.ok ? res.json() : []))
    .then((records) => {
      const list = records || [];
      const works = list.filter((r) => r.cat !== 'music');
      const mid = works.find((r) => r.featured) || works[0];
      const rest = works.filter((r) => r !== mid);
      [rest[0], mid, rest[1]].forEach((work, i) => { if (work) setFeaturedWorks[i](work); });
      setLibraryBooks(works.map((r) => r.title));
    })
    .catch(() => {}); // 실패해도 액자/책장은 기본 상태로 남을 뿐, 로비 자체는 멀쩡히 작동함
}
