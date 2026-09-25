// 스케치북 페이지의 "시작점". 여기서 하는 일은 딱 두 가지:
//   1. 조각난 모듈들(store/canvas/pager/dock/toast)을 만들고 서로 연결하기
//   2. 첫 페이지를 불러와서 화면에 띄우기
//
// 각 모듈이 무슨 일을 하는지 궁금하면 해당 파일을 열어보면 됨 —
// 이 파일은 "무슨 순서로 조립되는지"만 보여주는 목차 같은 역할.
import { checkApi, makeApiStore, makeLocalStore } from './store.js';
import { createCanvas } from './canvas.js';
import { createPager } from './pager.js';
import { initDock } from './dock.js';
import { createToast } from './toast.js';
import { initRoomNav } from '../shared/roomNav.js';
import { watchForSlowWake, WAKE_MESSAGE } from '../shared/wake.js';

async function main() {
  const toast = createToast();

  const { mine, viewingCode, readOnly } = await initRoomNav({
    navEl: document.querySelector('.site-nav'),
    currentPage: 'sketchbook',
  });
  // 남의 방을 보는 중이면 그리기 도구/페이지 삭제를 아예 숨김 — 서버도
  // 토큰 없는 쓰기 요청은 403으로 막지만, 애초에 누를 수 없게 하는 게
  // 더 친절함.
  document.body.classList.toggle('read-only', readOnly);
  const ownerToken = readOnly ? undefined : mine.token;

  // 서버가 45초 안에 응답하면 서버(=여러 기기 공유) 저장소를, 아니면
  // 이 기기에서만 쓰는 로컬 저장소를 씀. 어느 쪽이든 store.js가 정해둔
  // 똑같은 인터페이스를 따르기 때문에 아래 코드는 신경 쓸 필요 없음.
  // (로컬 폴백은 내 방일 때만 의미가 있음 — 남의 방을 로컬로 대신할 순 없어서
  // 읽기 전용일 때 서버가 안 닿으면 그냥 빈 캔버스를 보여줌.)
  // Render 무료 플랜은 서버가 잠들어 있으면 깨는 데 오래 걸리는데, 예전엔
  // 2.5초만 기다리고 바로 로컬로 넘어가버려서 그 사이에 그린 그림이 서버에
  // 저장되지 않았음 — 훨씬 오래 기다리되, 3초가 지나도 응답이 없으면 그냥
  // 느린 게 아니라 서버가 깨는 중이라고 알려줌.
  const stopWatch = watchForSlowWake(() => toast(WAKE_MESSAGE, 0));
  const reachable = await checkApi(viewingCode, 45000);
  stopWatch();
  toast.hide();
  // 남의 방을 보는 중인데 서버가 안 닿으면 로컬로 대신할 방법이 없음
  // (내 기기엔 그 사람 데이터가 없으니) — 그래도 store는 만들어두고
  // 에러 토스트로 상황만 알려줌.
  const store = (!reachable && !readOnly) ? makeLocalStore() : makeApiStore(viewingCode, ownerToken);
  if (!reachable) toast(readOnly ? '지금은 이 방의 그림을 불러올 수 없어요' : '지금은 서버에 연결되지 않아 이 기기에만 저장돼요');

  const canvas = createCanvas({ toast });
  const pager = createPager({ store, canvas });
  // canvas는 "그림이 바뀌었다"는 것만 알고, 그걸 실제로 저장할지는
  // pager가 알고 있으므로 이제서야 연결해줌.
  canvas.setOnChange(pager.persistChange);

  initDock({ canvas, toast });

  canvas.layout();
  await pager.boot();
}

main();
