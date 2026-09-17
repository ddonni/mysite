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

async function main() {
  const toast = createToast();

  // 서버가 2.5초 안에 응답하면 서버(=여러 기기 공유) 저장소를, 아니면
  // 이 기기에서만 쓰는 로컬 저장소를 씀. 어느 쪽이든 store.js가 정해둔
  // 똑같은 인터페이스를 따르기 때문에 아래 코드는 신경 쓸 필요 없음.
  const reachable = await checkApi(2500);
  const store = reachable ? makeApiStore() : makeLocalStore();
  if (!reachable) toast('서버에 연결할 수 없어 이 기기에만 저장돼요');

  const canvas = createCanvas({ toast });
  const pager = createPager({ store, canvas, toast });
  // canvas는 "그림이 바뀌었다"는 것만 알고, 그걸 실제로 어디에(몇
  // 페이지에) 저장할지는 pager가 알고 있으므로 이제서야 연결해줌.
  canvas.setOnChange(pager.persistChange);

  initDock({ canvas, toast });

  canvas.layout();
  const hashN = parseInt((location.hash || '').replace('#', ''), 10);
  await pager.boot(hashN);
}

main();
