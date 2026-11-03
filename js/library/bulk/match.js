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

// 검색해서 고르기의 음악 — 기록은 노래 단위라(앨범 이름은 잘 모름) 가수의 노래 목록(by=songs,
// 수록곡을 모은 것)을 주고, 검색어가 노래 제목이면 맨 앞에 쓴 제목 그대로의 줄 하나를 둠
// (가수·커버는 제목 검색 맨 위 결과 — 백엔드가 iTunes로 그 노래가 실린 앨범을 찾아 줌).
// 검색어가 그 가수 이름이면("검정치마") 그 줄은 뺌 — "검정치마"라는 노래가 생기지 않게.
function findSongs(q) {
  const settle = (pr) => pr.then((list) => ({ list }), () => ({ failed: true }));
  return Promise.all([settle(searchMusic(q, undefined, 'songs')), settle(searchMusic(q))]).then(([a, b]) => {
    if (a.failed && b.failed) throw new Error('search failed');
    const songs = (a.list || []).filter((m) => m.song).map((m) => ({
      title: m.song,
      creator: m.creator || '',
      cover: m.cover,
      label: m.song,
      meta: [m.album, m.year].filter(Boolean).join(' · '),
      square: true,
    }));
    const top = (b.list || [])[0];
    const isArtist = (name) => {
      const x = squash(name);
      const y = squash(q);
      return !!x && (x.includes(y) || y.includes(x));
    };
    if (!top || isArtist(top.creator) || songs.some((s) => isArtist(s.creator))) return songs;
    const typed = {
      title: q,
      creator: top.creator || '',
      cover: top.cover,
      label: q,
      meta: [top.creator, top.album && `앨범 ${top.album}`].filter(Boolean).join(' · '),
      square: true,
    };
    return [typed, ...songs];
  });
}

// 검색어 하나로 작품 목록 — "검색해서 고르기"에서 본 것만 체크하게. 검색어가 제목인지
// 작가·감독·가수 이름인지 모르니 둘 다 찾아 합침: 이름 검색(책 by=author, 영화·애니
// by=director) 결과를 앞에 — 같은 사람의 작품을 여러 개 봤을 때가 많아서 — 그 뒤에 제목
// 검색 결과(음악은 findSongs). 같은 제목(책의 여러 판본, 양쪽에 다 나온 작품)은 처음 것만.
// 한쪽이 실패해도 나머지로 보여주고, 둘 다 실패하면 reject.
export function findWorks(cat, q) {
  let byName;
  let byTitle;
  if (cat === 'book') {
    byName = searchBooks(q, undefined, 'author').then((rs) => rs.map(bookCandidate));
    byTitle = searchBooks(q).then((rs) => rs.map(bookCandidate));
  } else if (cat === 'music') {
    byName = findSongs(q);
    byTitle = Promise.resolve([]);
  } else if (isScreen(cat)) {
    byName = searchScreen(q, cat, undefined, 'director').then((rs) => rs.map((r) => screenCandidate(cat, r)));
    byTitle = searchScreen(q, cat).then((rs) => rs.map((r) => screenCandidate(cat, r)));
  } else {
    return Promise.resolve([]);
  }
  const settle = (pr) => pr.then((list) => ({ list }), () => ({ failed: true }));
  return Promise.all([settle(byName), settle(byTitle)]).then(([a, b]) => {
    if (a.failed && b.failed) throw new Error('search failed');
    const seen = new Set();
    return [...(a.list || []), ...(b.list || [])].filter((c) => {
      const key = squash(c.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
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
