// 첫 화면(index.html — 기록 카드)의 시작점. list.js(카드 격자)와 modal.js(추가/수정 창),
// welcome.js(처음 온 사람 안내)를 만들어서 서로 연결하고, 첫 목록을 불러옴.
// (예전엔 첫 화면이 3D 방이었고 이 화면은 library.html "기록 보관소"였음 — library.html은
// 이제 쿼리를 들고 여기로 넘어오기만 함.)
import { fetchRecords, deleteRecord, setFeatured, setRoom, setActor, likeRecord, WORK_CATS } from './records.js';
import { createList } from './list.js';
import { createModal } from './modal.js';
import { saveNote } from './quickNote.js';
import { initWelcome } from './welcome.js';
import { initProfileHeader } from './profileHeader.js';
import { initSocial } from './social.js';
import { initRoomNav } from '../shared/roomNav.js';
import { displayTitle, featureLabel, withEunNeun, withEulReul } from './list/itemFormat.js';
import { watchForSlow, SLOW_MESSAGE } from '../shared/slow.js';
import { getPlayer } from '../shared/youtube.js';
import { API_BASE } from '../shared/config.js';
import { forgetMyRoom, roomLink } from '../shared/room.js';

// 남의 방을 구경하는 사람의 "내 방으로" 버튼 문구 — 내 방이 비었으면 "만들기"(방은 이
// 페이지를 연 순간 이미 만들어져 있고, 이 링크는 거기로 이동만 함), 모르면 "돌아가기".
export function myRoomLabel(empty) {
  return empty === true ? '나도 내 기록 만들기' : '내 기록으로';
}

// 서버에서 기록을 다시 불러와 목록을 새로 그림. 추가/수정/삭제가 성공한
// 뒤에는 항상 이 함수를 불러서 화면을 최신 상태로 맞춤. 처음 불러올 때는
// index.html이 넣어둔 "불러오는 중…" placeholder가 그대로 보이다가,
// 3초가 지나도 안 끝나면(연결이 느린 경우) 안내를 바꿔줌 — list.render가
// 끝내 그 자리를 덮어쓰므로 별도로 치울 필요는 없음.
function reload() {
  const listEl = document.getElementById('list');
  const isPlaceholder = () => listEl.children.length === 1 && listEl.firstElementChild.classList.contains('empty');
  const stopWatch = watchForSlow(() => {
    if (isPlaceholder()) listEl.firstElementChild.textContent = SLOW_MESSAGE;
  });
  return fetchRecords()
    .then((items) => { stopWatch(); currentItems = items; list.render(items); return items; })
    .catch(() => {
      stopWatch();
      // list.render()가 실행되기 전(=최초 로딩)에만 이 자리를 대신 채움 —
      // 이미 목록이 그려진 뒤라면(새로고침 실패) 있던 목록을 그대로 둠.
      if (isPlaceholder()) listEl.firstElementChild.textContent = '기록을 불러오지 못했어요. 새로고침해 보세요.';
      return null;
    });
}

// 방 코드가 서버에 없으면(404) 알려줌 — 남의 방이면 내 방으로 돌려보내고, 내 방이면
// (로컬/운영 서버를 오가며 테스트했거나 방이 실제로 사라진 경우) 낡은 방 정보를 지우고
// 새로고침해서 새 방을 만들게 함. 있으면 true.
function checkRoomExists({ viewingCode, readOnly }) {
  return fetch(`${API_BASE}/api/rooms/${encodeURIComponent(viewingCode)}`)
    .then((res) => {
      if (res.status !== 404) return true;
      if (!readOnly) {
        alert('내 기록을 찾지 못했어요. 새로 하나 만들게요.');
        forgetMyRoom();
        window.location.reload();
      } else {
        alert(`기록 ${viewingCode}을(를) 찾을 수 없어요. 내 기록으로 돌아갈게요.`);
        window.location.replace('./');
      }
      return false;
    }, () => true); // 연결 실패는 여기서 판단하지 않음(reload가 안내함)
}

// 남의 방을 보는 중이면 "+ 기록" 자리에 내 방으로 가는 버튼 — 서랍의 "내 방으로 돌아가기"는
// 열어 봐야 보여서, 링크로 들어온 사람이 자기 방 가는 길을 놓치지 않게 하나 더 둠.
function showMyRoomCta(mine) {
  const cta = document.getElementById('myRoomCta');
  if (!cta) return;
  cta.href = './';
  cta.textContent = myRoomLabel(null);
  cta.hidden = false;
  fetch(`${API_BASE}/api/rooms/${encodeURIComponent(mine.code)}/records`)
    .then((res) => (res.ok ? res.json() : null), () => null)
    .then((records) => { if (Array.isArray(records)) cta.textContent = myRoomLabel(records.length === 0); });
}

let list; // readOnly를 알아야 목록을 그릴 수 있어서, 방을 안 뒤에 만듦
let currentItems = []; // 마지막으로 받은 기록 — 새 기록 창 검색 결과에 "기록함"을 표시하려고

const navEl = document.querySelector('.site-nav');

initRoomNav({ navEl, currentPage: './', settings: true }).then((ctx) => {
  const { mine, viewingCode, readOnly } = ctx;
  setRoom(viewingCode, readOnly ? null : mine.token);
  setActor(mine);
  document.body.classList.toggle('read-only', readOnly);
  if (readOnly) showMyRoomCta(mine);
  initProfileHeader(ctx);
  const social = initSocial(ctx);

  // 특정 카테고리를 먼저 보여주고 싶을 때 ./?cat=music 형태로 들어옴.
  const initialTab = new URLSearchParams(location.search).get('cat');

  const modal = createModal({ onSaved: reload, getItems: () => currentItems });
  // ?!는 창 없이 — 맨 앞 "+ ?!" 칸과 카드의 "수정"이 그 자리에서 입력 칸으로(quickNote.js).
  list = createList({
    readOnly,
    initialTab,
    onEdit: (item) => modal.openEdit(item),
    onSaveNote: (item, parts) => saveNote(parts, item && item.id).then(reload),
    onDelete: (id) => deleteRecord(id).then(reload).catch(() => alert('삭제에 실패했어요. 잠시 후 다시 시도해주세요.')),
    onFeature: (item) => setFeatured(item.id, !item.featured).then(reload).catch((err) => {
      const label = featureLabel(item.cat);
      alert(err && err.code === 'featured_limit'
        ? `${withEunNeun(label)} 3개까지예요. 다른 ${withEulReul(label)} 먼저 빼 주세요.`
        : '저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    }),
    // 유튜브 링크가 있는 음악을 화면 구석의 작은 플레이어로 틂.
    // ?!의 유튜브 영상도 같은 플레이어로(제목 칸이 없어서 글 첫 줄을 제목으로).
    onListen: (item) => getPlayer().play(item.cat === 'note' ? { ...item, title: displayTitle(item) } : item),
    // 남의 기록 카드에 공감 — 구글 연동이 안 됐으면 로그인 안내 창(social.js).
    onLike: async (item) => {
      const why = '공감은 구글 계정을 연동한 사람만 누를 수 있어요.';
      if (!item.liked && !(await social.isLinked())) { social.askLogin(why); return null; }
      try {
        const res = await likeRecord(item.id, !item.liked);
        social.showToast(res.liked ? `"${displayTitle(item)}"에 공감했어요 ♥` : '공감을 취소했어요');
        return res;
      } catch (err) {
        if (err.code === 'login') social.askLogin(why);
        else social.showToast('지금은 공감할 수 없어요');
        return null;
      }
    },
    // 칩을 바꾸면 아래로 내려와 있었어도 맨 위로(그 카테고리를 처음부터 보게).
    onTabChange: () => window.scrollTo({ top: 0 }),
    // 맨 앞 "+"의 작품 기록(전체·작품만이면 책).
    onAdd: (tab) => modal.openAdd(tab),
  });

  // 보기 방식 전환(카드 · 촘촘히 · 목록) — 위 줄의 아이콘 버튼.
  const viewBtns = [...document.querySelectorAll('#viewSwitch [data-view]')];
  const paintView = () => viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === list.view())));
  viewBtns.forEach((b) => b.addEventListener('click', () => { list.setView(b.dataset.view); paintView(); }));
  paintView();

  // 티어리스트 페이지로 — 지금 보는 기록(남의 기록이면 그 기록)과 칩(카테고리)을 그대로 들고 감.
  document.getElementById('tierBtn').addEventListener('click', () => {
    const tab = list.activeTab();
    const isWork = WORK_CATS.some((c) => c.key === tab); // 전체·작품만·?!면 티어리스트 전체로
    window.location.href = roomLink(isWork ? `tier?cat=${tab}` : 'tier', viewingCode, mine.code);
  });


  // 처음 온 사람 환영 카드에서 카테고리를 고르면 그 카테고리로 새 기록 창.
  const startWith = (cat) => {
    list.selectTab(cat);
    modal.openAdd(cat);
    document.getElementById('fTitle').focus();
  };
  const welcome = initWelcome(ctx, { onStart: startWith });

  // ./?cat=book&new=1로 오면 새 기록 창을 바로 엶. 새로고침하면 또 열리지 않도록 주소에서
  // new는 지움.
  const params = new URLSearchParams(location.search);
  const openNew = params.get('new') === '1';
  if (openNew) {
    params.delete('new');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    if (!readOnly) startWith(initialTab);
  }

  checkRoomExists(ctx).then((ok) => {
    if (!ok) return;
    reload().then((items) => { if (!openNew) welcome.showIfFirstVisit(items); });
  });
});
