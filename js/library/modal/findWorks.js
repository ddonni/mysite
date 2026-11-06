// 새 기록 창 검색 화면(searchView.js)의 검색 — 검색어 하나 → 작품 후보 목록(DOM 없음).
// 결과 설명은 입력 칸 자동 완성(recordSearch.js)과 같게 맞춤.
import { searchBooks, searchMusic, searchScreen } from '../records.js';
import { squash, bookMeta, screenMeta } from './recordSearch.js';

const isScreen = (cat) => cat === 'movie' || cat === 'anime';

// 후보 하나: { title, creator, cover, label(목록에 보일 제목), meta, square?, screen?, listen?, albumId? }.
// screen이 있으면 감독을 아직 모름 — 고르거나 넣을 때 fetchScreenCreator로 물어봄.
// 음악: listen은 틀 유튜브 주소(노래 목록엔 바로 있음), 없고 albumId가 있으면 고를 때 물어봄.
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

// 가수 이름의 조각(붙여 쓴 것) — "래원 (Layone)" → 래원layone, 래원, layone. 백엔드
// music_search._artist_keys와 같은 생각.
function artistKeys(name) {
  const keys = new Set([squash(name)]);
  String(name || '').split(/[()（）[\],&/]|\s+(?:feat\.?|x|with)\s+/i).forEach((p) => keys.add(squash(p)));
  keys.delete('');
  return [...keys];
}

// 검색어가 "제목 가수"나 "가수 제목"인 노래 — "뉴질랜드 래원" → 래원의 "뉴질랜드".
function titleWithArtist(song, key) {
  const t = squash(song.title);
  return !!t && artistKeys(song.creator).some((a) => key === t + a || key === a + t);
}

// 검색어에서 가수 이름 낱말을 뺀 것 — 노래 제목 줄의 제목으로("뉴질랜드 래원" → "뉴질랜드").
// 다 빠지면 검색어 그대로.
function withoutArtist(q, creator) {
  const keys = artistKeys(creator);
  const rest = q.split(/\s+/).filter((w) => !keys.includes(squash(w))).join(' ').trim();
  return rest || q;
}

// 음악 — 기록은 노래 단위라(앨범 이름은 잘 모름) 노래 줄로 돌려줌.
//   - 검색어가 가수 이름이면("검정치마") 그 가수의 노래 목록(by=songs, 수록곡을 모은 것).
//   - 노래 제목이면 쓴 제목 그대로의 줄을 가수마다 하나씩 — 제목 검색 맨 위(백엔드가 iTunes로 그
//     노래가 실린 앨범을 찾아 줌)와, 앨범(싱글) 이름이 그 제목인 결과들. 같은 제목의 노래를 여러
//     가수가 냈을 때가 많아서("넋두리" — 하동균·닐로·…). by=songs는 검색어와 비슷한 가수를
//     골라 오므로 그 가수의 노래 중 제목이 맞는 것만 남김.
//   - "제목 가수"("뉴질랜드 래원")면 그 가수의 그 노래를 맨 앞에 — 예전엔 검색어 전체가 제목인
//     줄만 남아 "뉴질랜드 래원"이라는 노래가 나왔음(2026-11-06). 노래 제목 줄도 가수 낱말은 뺌.
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
      listen: m.listen || null,
      albumId: m.album_id || null,
    }));
    const albums = b.list || [];
    const key = squash(q);
    const isArtist = (name) => {
      const x = squash(name);
      return !!x && (x.includes(key) || key.includes(x));
    };
    const combo = songs.filter((s) => titleWithArtist(s, key));
    if (combo.length) return combo;
    if ((albums[0] && isArtist(albums[0].creator)) || songs.some((s) => isArtist(s.creator))) return songs;
    const typed = albums
      .filter((m, i) => i === 0 || squash(m.album) === key)
      .map((m) => ({
        title: withoutArtist(q, m.creator),
        creator: m.creator || '',
        cover: m.cover,
        label: withoutArtist(q, m.creator),
        meta: [m.creator, m.album && `앨범 ${m.album}`].filter(Boolean).join(' · '),
        square: true,
        listen: null,
        albumId: m.album_id || null,
      }));
    return [...typed, ...songs.filter((s) => squash(s.title) === key)];
  });
}

// 검색어 하나로 작품 목록. 검색어가 제목인지 작가·감독·가수 이름인지 모르니 둘 다 찾아
// 합침: 이름 검색(책 by=author, 영화·애니 by=director) 결과를 앞에 — 같은 사람의 작품을 여러
// 개 봤을 때가 많아서 — 그 뒤에 제목 검색 결과(음악은 findSongs). 같은 제목(책의 여러 판본,
// 양쪽에 다 나온 작품, 음악은 같은 가수의 같은 노래)은 처음 것만. 한쪽이 실패해도 나머지로 보여주고, 둘 다 실패하면 reject.
export function findWorks(cat, q) {
  let byName;
  let byTitle;
  if (cat === 'book') {
    byName = searchBooks(q, undefined, 'author').then((rs) => rs.map(bookCandidate));
    byTitle = searchBooks(q).then((rs) => rs.map(bookCandidate));
  } else if (cat === 'music') {
    // findSongs가 이름·제목을 다 봄 — 실패하면 그대로 실패(결과 없음과 구분되게).
    byName = findSongs(q);
    byTitle = byName;
  } else if (isScreen(cat)) {
    byName = searchScreen(q, cat, undefined, 'director').then((rs) => rs.map((r) => screenCandidate(cat, r)));
    byTitle = searchScreen(q, cat).then((rs) => rs.map((r) => screenCandidate(cat, r)));
  } else {
    return Promise.resolve([]);
  }
  const settle = (pr) => pr.then((list) => ({ list }), () => ({ failed: true }));
  return Promise.all([settle(byName), settle(byTitle)]).then(([a, b]) => {
    if (a.failed && b.failed) throw new Error('search failed');
    if (cat === 'music') b = { list: [] };
    // 음악은 같은 제목을 여러 가수가 내서 가수까지 봄.
    const seen = new Set();
    return [...(a.list || []), ...(b.list || [])].filter((c) => {
      const key = squash(c.title) + (cat === 'music' ? `|${squash(c.creator)}` : '');
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
