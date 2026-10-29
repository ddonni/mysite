// "목록으로 추가"의 줄 하나 → 검색 후보 찾기와, 고른 후보 → 저장할 기록 만들기(DOM 없음).
// 검색 규칙은 새 기록 창(modal/recordSearch.js)과 같게 맞춤 — 작가를 같이 쓴 줄이면
// 합쳐 찾고(책 "제목 작가", 음악 "가수 제목", 영화·애니는 감독 연출작을 제목으로 거름),
// 0건이면 제목만으로 다시 찾음. 창과 달리 사용자가 한 줄씩 고르지 않으니 맨 위 후보를
// 기본으로 고르고, 틀렸으면 bulk.js 화면에서 다른 후보로 바꿈.
import { searchBooks, searchMusic, searchScreen } from '../records.js';
import { squash, titled, bookMeta, screenMeta, albumCard } from '../modal/recordSearch.js';

// 한 줄에 보여줄 후보 수 — 맨 위가 틀렸을 때 고를 거리만큼.
const MAX_CANDIDATES = 5;

const isScreen = (cat) => cat === 'movie' || cat === 'anime';

// 후보 하나: { title, creator, cover, label(목록에 보일 제목), meta, square?, screen? }.
// screen이 있으면 감독을 아직 모름 — 저장할 때 fetchScreenCreator로 물어봄.
function bookCandidate(r) {
  return { title: r.title, creator: r.creator || '', cover: r.cover, label: r.full_title || r.title, meta: bookMeta(r) };
}

function screenCandidate(cat, r) {
  return {
    title: r.title,
    creator: r.creator || '',
    cover: r.cover,
    label: r.title,
    meta: screenMeta(cat, r),
    screen: r.creator ? null : { media: r.media, id: r.id },
  };
}

// 음악은 결과가 앨범이라 제목은 쓴 그대로(노래 제목) 두고 가수·커버만 가져옴 — 새 기록 창과 같음.
function musicCandidate(title, m) {
  const card = albumCard(m);
  return { title, creator: m.creator || '', cover: m.cover, label: card.title, meta: card.meta, square: true };
}

// 합친 검색 → 0건이면 제목만으로.
function withFallback(first, again) {
  return first().then((found) => (found.length || !again ? found : again()));
}

// → 후보 배열(없으면 []). 검색 자체가 실패하면 reject — 부르는 쪽이 "제목만 저장"으로 둠.
export function findCandidates(cat, { title, creator }) {
  let found;
  if (cat === 'book') {
    found = withFallback(
      () => searchBooks(creator ? `${title} ${creator}` : title),
      creator ? () => searchBooks(title) : null,
    ).then((rs) => rs.map(bookCandidate));
  } else if (cat === 'music') {
    found = withFallback(
      () => searchMusic(creator ? `${creator} ${title}` : title),
      creator ? () => searchMusic(title) : null,
    ).then((rs) => rs.map((m) => musicCandidate(title, m)));
  } else if (isScreen(cat)) {
    found = withFallback(
      () => (creator ? searchScreen(creator, cat, undefined, 'director').then((works) => titled(works, title)) : searchScreen(title, cat)),
      creator ? () => searchScreen(title, cat) : null,
    ).then((rs) => rs.map((r) => screenCandidate(cat, r)));
  } else {
    found = Promise.resolve([]);
  }
  return found.then((list) => list.slice(0, MAX_CANDIDATES));
}

// 이 카테고리에 같은 제목(띄어쓰기·대소문자 무시)이 이미 기록돼 있는지.
export function isRecorded(items, cat, title) {
  const key = squash(title);
  return items.some((it) => it.cat === cat && squash(it.title) === key);
}

// 줄 하나 + 고른 후보(없으면 null — 제목만) → saveRecord에 보낼 기록. 별점·감상은
// 비워 둠(나중에 하나씩 고침). 작가는 후보에 없으면 줄에 쓴 값.
export function toRecord(cat, line, candidate) {
  return {
    cat,
    title: candidate ? candidate.title : line.title,
    creator: (candidate && candidate.creator) || line.creator || '',
    rating: 0,
    memo: '',
    photo_url: candidate ? candidate.cover || null : null,
  };
}

// items를 동시에 limit개씩만 fn에 넘김(검색을 50개 한꺼번에 쏘지 않게). 결과 순서는 items 순서.
export function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = () => {
    if (next >= items.length) return Promise.resolve();
    const i = next++;
    return Promise.resolve(fn(items[i], i)).then((r) => { results[i] = r; }).then(worker);
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  return Promise.all(workers).then(() => results);
}
