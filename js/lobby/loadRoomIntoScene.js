import { roomApi } from './roomContext.js';
import { pickShowcase } from './showcase.js';

// 지금 보는 방의 실제 데이터(스트로크/기록)를 서버에서 받아와 3D 씬의
// 각 가구를 채움 — 이젤 캔버스, 책장과 그 위 액자, 영화 포스터 벽, 애니
// 진열장, 턴테이블. sceneSetters는 buildScene()이 돌려준
// set* 함수들을 그대로 넘기면 됨. 두 요청은 독립적이라 하나가 실패해도(catch)
// 나머지는 그대로 채워짐 — 로비 자체가 어느 하나의 실패로 멎지 않게 함.
export function loadRoomIntoScene(ctx, sceneSetters) {
  const { setSketchbookPreview, setBookFrames, setLibraryBooks, setMovies, setAnime, setMusic } = sceneSetters;

  // 이젤 보드에 지금 보는 방의 1페이지 그림을 채워넣음. 실시간 동기화는
  // 필요 없어서(로비에서 그리는 기능도 없음) 로드 시 한 번만 조회. 읽기는
  // 방 코드만 있으면 되니 남의 방이어도 그대로 동작함.
  fetch(`${roomApi(ctx)}/pages/1`)
    .then((res) => (res.ok ? res.json() : null))
    .then((page) => { if (page) setSketchbookPreview(page.strokes || []); })
    .catch(() => {}); // 실패해도 이젤은 그냥 빈 종이로 남아있을 뿐, 로비 자체는 멀쩡히 작동함

  // 기록은 한 번에 받아서 카테고리별로 나눠 각 가구에 줌(목록은 이미 최신순):
  //  - 책: 대표작 3개는 책장 위 액자, 책장엔 책 전체의 제목.
  //  - 영화/애니: 기본은 전부 작은 포스터/작은 스탠드로 쌓이고, 별표로
  //    직접 고른 대표작(최대 3개)만 위에 큰 포스터/큰 스탠드로 올라감.
  //  - 음악: 첫 번째 대표곡(없으면 가장 최근 곡)이 턴테이블에서 돎.
  fetch(`${roomApi(ctx)}/records`)
    .then((res) => (res.ok ? res.json() : []))
    .then((records) => {
      const list = records || [];
      setMusic(pickShowcase(list, 'music'));
      setBookFrames(pickShowcase(list, 'book'));
      setLibraryBooks(list.filter((r) => r.cat === 'book').map((r) => r.title));
      setMovies(pickShowcase(list, 'movie', { fill: false }));
      setAnime(pickShowcase(list, 'anime', { fill: false }));
    })
    .catch(() => {}); // 실패해도 가구들은 기본(빈) 상태로 남을 뿐, 로비 자체는 멀쩡히 작동함
}
