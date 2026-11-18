// "지금 그려진 내용을 1페이지와 어떻게 주고받는가" 를 담당하는 모듈.
// 스케치북은 여러 장을 넘길 필요가 없어서 페이지 이동/추가/삭제 UI는
// 없앴고, 항상 고정된 1페이지 하나만 씀.
//
// canvas.js는 "페이지"라는 개념을 모르기 때문에, "지금 뭔가 그려졌다"는
// 소식을 받아서 실제로 store.setPage(1, …)를 불러주는 것도 이 모듈의
// 역할임 (persistChange).

const PAGE = 1;

export function createPager({ store, canvas }) {
  let pageUnsub = null; // 실시간 구독을 끊는 함수

  function attachPageSubscription() {
    if (pageUnsub) { pageUnsub(); pageUnsub = null; }
    if (!store.shared) return; // 로컬 저장소는 실시간 동기화가 없음
    pageUnsub = store.subscribePage(PAGE, (strokes) => canvas.applyRemote(strokes));
  }

  return {
    // canvas.js가 "그려진 내용이 바뀌었다"고 알려줄 때 실제로 저장하는
    // 함수. canvas.setOnChange(pager.persistChange) 형태로 main.js에서
    // 연결해줌 — canvas.js는 이 함수가 존재한다는 것만 알 뿐, 안에서
    // 무슨 일이 일어나는지는 모름.
    persistChange(combined, gen, savedIds) {
      store.setPage(PAGE, combined)
        .then(() => canvas.reconcileSaved(gen, combined, savedIds))
        .catch((err) => canvas.saveFailed(err));
    },

    // 1페이지 내용을 서버(혹은 로컬)에서 읽어와 화면에 띄우고, 실시간
    // 구독을 건다.
    boot() {
      attachPageSubscription();
      return store.getPage(PAGE).then((strokes) => canvas.loadPage(strokes));
    },
  };
}
