// 기록 보관소 페이지의 시작점. list.js(목록 그리기)와 modal.js(추가/
// 수정 창)를 만들어서 서로 연결하고, 첫 목록을 불러옴.
import { fetchRecords, deleteRecord } from './records.js';
import { createList } from './list.js';
import { createModal } from './modal.js';

// 서버에서 기록을 다시 불러와 목록을 새로 그림. 추가/수정/삭제가 성공한
// 뒤에는 항상 이 함수를 불러서 화면을 최신 상태로 맞춤.
function reload() {
  return fetchRecords().then((items) => list.render(items));
}

const modal = createModal({ onSaved: reload });
const list = createList({
  onEdit: (item) => modal.openEdit(item),
  onDelete: (id) => deleteRecord(id).then(reload),
});

document.getElementById('addTabBtn').addEventListener('click', () => modal.openAdd());

reload();
