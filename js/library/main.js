// 기록 보관소 페이지의 시작점. list.js(목록 그리기)와 modal.js(추가/
// 수정 창)를 만들어서 서로 연결하고, 첫 목록을 불러옴.
import { fetchRecords, deleteRecord, setFeatured, setPlaying, setRoom, fetchRoomInfo, setWardrobePublic } from './records.js';
import { createList } from './list.js';
import { createModal } from './modal.js';
import { initRoomNav, setActiveCat } from '../shared/roomNav.js';
import { featureLabel, withEunNeun, withEulReul } from './list/itemFormat.js';
import { SHELF_CATS, SHELF_FEATURED } from '../lobby/showcase.js';
import { watchForSlow, SLOW_MESSAGE } from '../shared/slow.js';
import { getPlayer } from '../shared/youtube.js';

// 서버에서 기록을 다시 불러와 목록을 새로 그림. 추가/수정/삭제가 성공한
// 뒤에는 항상 이 함수를 불러서 화면을 최신 상태로 맞춤. 처음 불러올 때는
// library.html이 넣어둔 "불러오는 중…" placeholder가 그대로 보이다가,
// 3초가 지나도 안 끝나면(연결이 느린 경우) 안내를 바꿔줌 — list.render가
// 끝내 그 자리를 덮어쓰므로 별도로 치울 필요는 없음.
function reload() {
  const listEl = document.getElementById('list');
  const isPlaceholder = () => listEl.children.length === 1 && listEl.firstElementChild.classList.contains('empty');
  const stopWatch = watchForSlow(() => {
    if (isPlaceholder()) listEl.firstElementChild.textContent = SLOW_MESSAGE;
  });
  return fetchRecords()
    .then((items) => { stopWatch(); currentItems = items; list.render(items); })
    .catch(() => {
      stopWatch();
      // list.render()가 실행되기 전(=최초 로딩)에만 이 자리를 대신 채움 —
      // 이미 목록이 그려진 뒤라면(새로고침 실패) 있던 목록을 그대로 둠.
      if (isPlaceholder()) listEl.firstElementChild.textContent = '기록을 불러오지 못했어요. 새로고침해 보세요.';
    });
}

let list; // readOnly를 알아야 목록을 그릴 수 있어서, 방을 안 뒤에 만듦
let currentItems = []; // 마지막으로 받은 기록 — 새 기록 창 검색 결과에 "기록함"을 표시하려고

const navEl = document.querySelector('.site-nav');

// 옷장 탭에서 방 주인에게만 보이는 줄 — 방문자에게도 보여 줄지 고름(처음엔 나만 봄).
function createWardrobeShare() {
  const el = document.getElementById('wardrobeShare');
  const text = document.getElementById('wardrobeShareText');
  const btn = document.getElementById('wardrobeShareBtn');
  let shown = false;
  let known = false; // 서버에서 값을 받기 전엔 줄을 안 띄움
  let tab = null;
  function paint() {
    el.hidden = !(known && tab === 'wardrobe');
    text.textContent = shown ? '방문자도 내 옷장을 볼 수 있어요.' : '옷장은 나만 봐요.';
    btn.textContent = shown ? '나만 보기' : '방문자에게도 보여 주기';
  }
  btn.addEventListener('click', () => {
    btn.disabled = true;
    setWardrobePublic(!shown)
      .then((v) => { shown = v; paint(); })
      .catch(() => alert('저장에 실패했어요. 잠시 후 다시 시도해주세요.'))
      .finally(() => { btn.disabled = false; });
  });
  fetchRoomInfo().then((info) => { shown = !!info.wardrobe_public; known = true; paint(); }, () => {});
  return { setTab(t) { tab = t; paint(); } };
}

initRoomNav({ navEl, currentPage: 'library' }).then(({ mine, viewingCode, readOnly }) => {
  setRoom(viewingCode, readOnly ? null : mine.token);
  document.body.classList.toggle('read-only', readOnly);

  // 로비의 턴테이블처럼 특정 카테고리를 먼저 보여주고 싶을 때
  // library.html?cat=music 형태로 들어옴.
  const initialTab = new URLSearchParams(location.search).get('cat');

  const modal = createModal({ onSaved: reload, getItems: () => currentItems });
  list = createList({
    readOnly,
    initialTab,
    onEdit: (item) => modal.openEdit(item),
    onDelete: (id) => deleteRecord(id).then(reload).catch(() => alert('삭제에 실패했어요. 잠시 후 다시 시도해주세요.')),
    onFeature: (item) => setFeatured(item.id, !item.featured).then(reload).catch((err) => {
      const label = featureLabel(item.cat);
      // 책·애니·영화는 셋 합쳐 SHELF_FEATURED개(로비 책장 위 액자), 음악·옷장은 각 3개.
      const limitText = SHELF_CATS.includes(item.cat)
        ? `인생작은 책·애니·영화 합쳐 ${SHELF_FEATURED}개까지예요. 다른 인생작을 먼저 빼 주세요.`
        : `${withEunNeun(label)} 3개까지예요. 다른 ${withEulReul(label)} 먼저 빼 주세요.`;
      alert(err && err.code === 'featured_limit' ? limitText : '저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    }),
    // 음악을 로비 턴테이블에 올리거나 내림 — 목록을 다시 불러오면 "턴테이블 위" 표시도 옮겨감.
    onPlay: (item, playing) => setPlaying(item.id, playing).then(reload)
      .catch(() => alert('저장에 실패했어요. 잠시 후 다시 시도해주세요.')),
    // 유튜브 링크가 있는 음악을 화면 구석의 작은 플레이어로 틂.
    onListen: (item) => getPlayer().play(item),
    // 이 페이지의 탭을 바꾸면 상단 메뉴의 카테고리 표시도 따라감('전체'면 아무것도 안 켬).
    onTabChange: (key) => { setActiveCat(navEl, key); if (wardrobeShare) wardrobeShare.setTab(key); },
  });
  const wardrobeShare = readOnly ? null : createWardrobeShare();
  if (wardrobeShare) wardrobeShare.setTab(list.activeTab());

  // 상단 메뉴의 책·애니·영화·음악 — 이미 기록 보관소에 있으니 페이지를 다시 불러오지 않고
  // 탭만 바꾸고, 아래로 내려와 있었으면 맨 위로 올림(그 카테고리를 처음부터 보게).
  navEl.querySelectorAll('a[data-cat]').forEach((a) => a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // 새 탭으로 열기는 그대로
    e.preventDefault();
    list.selectTab(a.dataset.cat);
    window.scrollTo({ top: 0 });
  }));

  // 보고 있던 탭의 카테고리로 새 기록 창을 엶(전체 탭이면 책).
  document.getElementById('addTabBtn').addEventListener('click', () => modal.openAdd(list.activeTab()));

  // 로비의 "첫 기록 남기기"·"첫 책 기록하기"로 오면(library?cat=book&new=1) 새 기록 창을
  // 바로 엶 — 처음 온 사람이 기록 보관소에서 또 "추가" 버튼을 찾지 않게. 새로고침하면
  // 또 열리지 않도록 주소에서 new는 지움.
  const params = new URLSearchParams(location.search);
  if (params.get('new') === '1') {
    params.delete('new');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    if (!readOnly) {
      modal.openAdd(initialTab);
      document.getElementById('fTitle').focus();
    }
  }

  // 로비 책장에서 물건을 눌러 왔으면(library?open=id) 목록을 받은 뒤 그 기록을 엶 — 새로고침하면
  // 또 열리지 않게 주소에서 open은 지움.
  const openId = params.get('open');
  if (openId) {
    params.delete('open');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }
  reload().then(() => { if (openId) list.openById(openId); });
});
