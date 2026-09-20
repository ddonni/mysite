// 기록 보관소 페이지의 시작점. list.js(목록 그리기)와 modal.js(추가/
// 수정 창)를 만들어서 서로 연결하고, 첫 목록을 불러옴.
import { fetchRecords, deleteRecord, setFeatured, setRoom } from './records.js';
import { createList } from './list.js';
import { createModal } from './modal.js';
import { initRoomNav } from '../shared/roomNav.js';

// 서버에서 기록을 다시 불러와 목록을 새로 그림. 추가/수정/삭제가 성공한
// 뒤에는 항상 이 함수를 불러서 화면을 최신 상태로 맞춤.
function reload() {
  return fetchRecords().then((items) => list.render(items));
}

let list; // readOnly를 알아야 목록을 그릴 수 있어서, 방을 안 뒤에 만듦

initRoomNav({ navEl: document.querySelector('.site-nav'), currentPage: 'library.html' }).then(({ mine, viewingCode, readOnly }) => {
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
    onDelete: (id) => deleteRecord(id).then(reload),
    onFeature: (item) => setFeatured(item.id, !item.featured).then(reload),
  });

  document.getElementById('addTabBtn').addEventListener('click', () => modal.openAdd());

  reload();
});
