// 기록 보관소 페이지의 시작점. list.js(목록 그리기)와 modal.js(추가/
// 수정 창)를 만들어서 서로 연결하고, 첫 목록을 불러옴.
import { fetchRecords, deleteRecord, setFeatured, setRoom } from './records.js';
import { createList } from './list.js';
import { createModal } from './modal.js';
import { initRoomNav } from '../shared/roomNav.js';
import { watchForSlowWake, WAKE_MESSAGE } from '../shared/wake.js';

// 서버에서 기록을 다시 불러와 목록을 새로 그림. 추가/수정/삭제가 성공한
// 뒤에는 항상 이 함수를 불러서 화면을 최신 상태로 맞춤. 처음 불러올 때는
// library.html이 넣어둔 "불러오는 중…" placeholder가 그대로 보이다가,
// 3초가 지나도 안 끝나면(서버가 잠들어 있던 경우) 안내를 바꿔줌 — list.render가
// 끝내 그 자리를 덮어쓰므로 별도로 치울 필요는 없음.
function reload() {
  const listEl = document.getElementById('list');
  const isPlaceholder = () => listEl.children.length === 1 && listEl.firstElementChild.classList.contains('empty');
  const stopWatch = watchForSlowWake(() => {
    if (isPlaceholder()) listEl.firstElementChild.textContent = WAKE_MESSAGE;
  });
  return fetchRecords()
    .then((items) => { stopWatch(); list.render(items); })
    .catch(() => {
      stopWatch();
      // list.render()가 실행되기 전(=최초 로딩)에만 이 자리를 대신 채움 —
      // 이미 목록이 그려진 뒤라면(새로고침 실패) 있던 목록을 그대로 둠.
      if (isPlaceholder()) listEl.firstElementChild.textContent = '기록을 불러오지 못했어요. 새로고침해 보세요.';
    });
}

let list; // readOnly를 알아야 목록을 그릴 수 있어서, 방을 안 뒤에 만듦

initRoomNav({ navEl: document.querySelector('.site-nav'), currentPage: 'library' }).then(({ mine, viewingCode, readOnly }) => {
  setRoom(viewingCode, readOnly ? null : mine.token);
  document.body.classList.toggle('read-only', readOnly);

  // 로비의 턴테이블처럼 특정 카테고리를 먼저 보여주고 싶을 때
  // library.html?cat=music 형태로 들어옴.
  const initialTab = new URLSearchParams(location.search).get('cat');

  const modal = createModal({ onSaved: reload });
  list = createList({
    readOnly,
    initialTab,
    onEdit: (item) => modal.openEdit(item),
    onDelete: (id) => deleteRecord(id).then(reload).catch(() => alert('삭제에 실패했어요. 잠시 후 다시 시도해주세요.')),
    onFeature: (item) => setFeatured(item.id, !item.featured).then(reload).catch((err) => {
      alert(err && err.code === 'featured_limit'
        ? '대표작은 카테고리마다 3개까지예요. 다른 대표작을 먼저 해제해주세요.'
        : '저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    }),
  });

  document.getElementById('addTabBtn').addEventListener('click', () => modal.openAdd());

  reload();
});
