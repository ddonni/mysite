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
// keys: 함께 받은 결과들의 가수 이름 조각 전부 — 앨범 결과는 "Epik High"(영어)인데 검색어는 "에픽하이"라
// 그 앨범 가수만 보면 안 빠져서 "샴페인 에픽하이"라는 노래가 됐음(2026-11-19). 다 빠지면 검색어 그대로.
function withoutArtist(q, keys) {
  const rest = q.split(/\s+/).filter((w) => !keys.has(squash(w))).join(' ').trim();
  return rest || q;
}

function songCandidate(m) {
  return {
    title: m.song,
    creator: m.creator || '',
    cover: m.cover,
    label: m.song,
    meta: [m.album, m.year].filter(Boolean).join(' · '),
    square: true,
    listen: m.listen || null,
    albumId: m.album_id || null,
  };
}

// 음악 — 기록은 노래 단위라(앨범 이름은 잘 모름) 노래 줄로 돌려줌. 세 가지를 같이 찾음:
//   by=songs: 검색어와 비슷한 가수 하나의 노래 목록(수록곡을 모은 것)
//   일반 검색: 앨범·싱글(로그인 없는 유튜브 뮤직은 노래 검색을 안 해 줌) + iTunes로 찾은 앨범 하나
//   by=track: 그 제목의 노래들(iTunes 노래 검색 → 유튜브 앨범의 곡, 2026-11-19) — 앨범 안 수록곡도
//     제목으로("샴페인" → 2PM·동방신기·윤미래의 샴페인). 전엔 가수 이름을 써야만 수록곡이 나왔음.
// 그리고:
//   - 검색어가 가수 이름이면("검정치마") 그 가수의 노래 목록.
//   - "제목 가수"("뉴질랜드 래원")면 그 가수의 그 노래를 맨 앞에(2026-11-06).
//   - "제목 가수"인데 그 가수 노래 중 제목이 안 맞으면("샴페인 에픽하이" — 유튜브엔 "Champagne") 쓴 제목의
//     줄 하나 + 그 가수의 노래 목록 전체(거기서 고르게, 2026-11-19).
//   - 노래 제목이면 제목 검색(by=track)의 곡들 → 쓴 제목 그대로의 줄을 가수마다 하나씩(제목 검색 맨 위와
//     앨범·싱글 이름이 그 제목인 것 — 같은 제목을 여러 가수가 낸 일이 많아서, "넋두리") → 비슷한 가수의
//     노래 중 제목이 맞는 것.
function findSongs(q) {
  const settle = (pr) => Promise.resolve(pr).then((list) => ({ list: list || [] }), () => ({ failed: true }));
  return Promise.all([
    settle(searchMusic(q, undefined, 'songs')),
    settle(searchMusic(q)),
    settle(searchMusic(q, undefined, 'track')),
  ]).then(([a, b, c]) => {
    if (a.failed && b.failed && c.failed) throw new Error('search failed');
    const songs = (a.list || []).filter((m) => m.song).map(songCandidate);
    const tracks = (c.list || []).filter((m) => m.song).map(songCandidate);
    const albums = b.list || [];
    const key = squash(q);
    const isArtist = (name) => {
      const x = squash(name);
      return !!x && (x.includes(key) || key.includes(x));
    };
    const combo = [...songs, ...tracks].filter((s) => titleWithArtist(s, key));
    if (combo.length) return combo;
    if ((albums[0] && isArtist(albums[0].creator)) || songs.some((s) => isArtist(s.creator))) return songs;

    const keys = new Set([...songs, ...tracks, ...albums].flatMap((m) => artistKeys(m.creator)));
    const title = (creator) => withoutArtist(q, new Set([...keys, ...artistKeys(creator)]));
    // "제목 가수" — 노래 목록 가수의 이름 낱말이 검색어에 따로 있음(낱말 하나뿐이면 제목일 수도 있어서 둘 이상일 때만).
    const listArtist = songs[0] && songs[0].creator;
    const listKeys = listArtist ? artistKeys(listArtist) : [];
    const words = q.split(/\s+/).filter(Boolean);
    if (listArtist && words.length > 1 && words.some((w) => listKeys.includes(squash(w)))) {
      // 표지: 가수 표기가 똑같은 앨범(대개 검색어 낱말이 걸린 그 앨범) → 이름 조각이 같은 가수의 앨범.
      const own = albums.find((m) => m.creator === listArtist)
        || albums.find((m) => artistKeys(m.creator).some((k) => listKeys.includes(k)));
      const row = {
        title: title(listArtist),
        creator: listArtist,
        cover: own ? own.cover : null,
        label: title(listArtist),
        meta: `${listArtist} · 아래 노래 목록에서 골라도 돼요`,
        square: true,
        listen: null,
        albumId: null,
      };
      // 그 가수의 노래 목록은 150곡까지라 — 일반 검색이 이 검색어로 찾아 준 그 가수의 앨범("샴페인 에픽하이" →
      // Epik High Is Here 下, 그 안에 "Champagne")의 곡을 앞으로. 가수 표기가 노래 목록과 똑같은 앨범만(유튜브가
      // 찾은 것 — iTunes로 찾은 앨범은 영어 이름이라 다름).
      const hinted = albums.filter((m) => m.creator === listArtist).map((m) => squash(m.album));
      const rank = (m) => { const i = hinted.indexOf(squash(m.album)); return i < 0 ? hinted.length : i; };
      const ordered = (a.list || []).filter((m) => m.song)
        .map((m, i) => [m, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(([m]) => songCandidate(m));
      return [row, ...tracks.filter((t) => listKeys.some((k) => artistKeys(t.creator).includes(k))), ...ordered];
    }

    const trackArtists = new Set(tracks.map((t) => squash(t.creator)));
    const typed = albums
      .filter((m, i) => i === 0 || squash(m.album) === key)
      .filter((m) => !trackArtists.has(squash(m.creator))) // 같은 가수의 진짜 노래 줄이 이미 있으면 그걸로
      .map((m) => ({
        title: title(m.creator),
        creator: m.creator || '',
        cover: m.cover,
        label: title(m.creator),
        meta: [m.creator, m.album && `앨범 ${m.album}`].filter(Boolean).join(' · '),
        square: true,
        listen: null,
        albumId: m.album_id || null,
      }));
    return [...tracks, ...typed, ...songs.filter((s) => squash(s.title) === key)];
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
