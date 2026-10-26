// 새 기록 창의 제목 칸·만든 사람 칸 자동 완성과 책·음악·영화·애니 검색 규칙 — modal.js가
// 창 배선(탭·열기/닫기·저장)만 하도록 여기로 뺌. 두 칸의 자동 완성 위젯을 만들고, 검색
// 결과를 골랐을 때 다른 칸·표지를 채우는 것(fillFromPick)까지 담당함.
//
// 제목 칸·만든 사람 칸 자동 완성 — 서로 독립(제목만 고른 후보로는 만든 사람을 안
// 채움: 동명의 다른 작품이 흔하고, 만든 사람을 모르고 기록하는 경우도 많아서).
// 예외는 검색 결과 — 특정 판본·앨범·작품 하나를 고른 것이라 나머지 칸·표지까지
// 채움(fillFromPick). 네 탭 모두 두 칸에서 검색함(제목 칸은 제목으로, 만든 사람 칸은
// 작가·가수·감독 이름으로 찾음).
//
// 책·음악·영화·애니면 이 방·공개 방들의 후보 뒤에 검색 결과를 붙임. 한 글자로는 검색
// 결과가 너무 넓어서 두 글자부터. 어느 한쪽이 실패해도 나머지만으로 보여줌.
//
// 두 칸이 다 차 있으면 어느 칸에서 치든 둘을 합쳐 찾음(webSearch) — 책은 "제목 작가"
// (카카오가 제목·작가 둘 다 맞는 책을 앞에 둠), 음악은 "가수 제목"(유튜브 뮤직은
// 로그인 없이 앨범만 찾아져서 노래 제목만으론 남의 커버곡이 먼저 나오기 쉬움 —
// 백엔드 music_search.py), 영화·애니는 감독의 연출작을 제목으로 거름(screenSearch).
// 다른 칸 값은 **직접 쓴** 것만 씀 — 앞서 고른 결과로 자동으로 채워진 값은 이쪽 칸을
// 바꾼 뒤엔 엉뚱할 수 있어서. 합쳐서 0건이면 지금 칸만으로 한 번 더 찾고 목록 위에 알림.
//   - 책·영화·애니 제목 칸: 같은 제목이 이 방 후보와 검색 결과 둘 다에 있으면 검색 결과
//     쪽만 남기고("이미 기록함" 표시는 옮겨 붙임) — 같은 줄이 두 번 보이지 않게.
//   - 음악: 고르면 제목은 입력한 그대로 둠(대개 노래 제목이라 앨범 이름으로 덮으면
//     틀어짐).
import { fetchSuggestions, searchBooks, searchMusic, searchScreen, fetchScreenCreator } from '../records.js';
import { createAutocomplete } from './autocomplete.js';
import { isSearchCover } from '../../shared/photoSrc.js';

const isScreen = (cat) => cat === 'movie' || cat === 'anime';

function searchesWeb(cat, q) {
  return (cat === 'book' || cat === 'music' || isScreen(cat)) && q.length >= 2;
}

// 영화·애니에서 감독의 연출작 중 제목이 맞는 것만 — 띄어쓰기·대소문자는 무시하고,
// 원제로 쓴 경우도 맞춰 줌.
const squash = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
const titled = (works, title) => works.filter((w) => squash(w.title).includes(squash(title))
  || squash(w.original_title).includes(squash(title)));

// 검색 결과 배열 또는 실패(null). 취소된 요청은 abort 에러 그대로 넘김.
function tryWeb(promise, signal) {
  return promise.catch((err) => {
    if (signal && signal.aborted) throw err;
    return null;
  });
}

// 목록 한 줄의 설명 — 책: 작가 · 출판사 · 연도 / 영화·애니: 원제(한국어 제목과 다를
// 때만 옴) · 연도, 애니는 TV판인지 극장판인지도 / 음악: 앨범 카드(정사각형 커버).
const bookMeta = (b) => [b.creator, b.publisher, b.year].filter(Boolean).join(' · ');
const screenMeta = (cat, r) => [
  r.original_title, r.year, cat === 'anime' ? (r.media === 'tv' ? 'TV' : '극장판') : '',
].filter(Boolean).join(' · ');
const albumCard = (m) => ({
  title: m.song || m.album,
  meta: [m.creator, m.song ? m.album : m.kind, m.year].filter(Boolean).join(' · '),
  cover: m.cover,
  square: true,
});

// TMDB 이용 약관의 출처 표기 + "TMDB가 보증하지 않음" 문구.
const TMDB_NOTE = '정보 제공: TMDB(TMDB의 보증을 받은 서비스는 아니에요)';

// fTitle·fCreator: 두 입력칸, titleList·creatorList: 각 칸의 목록, photoPicker: 표지를
// 채울 사진 위젯, getCat: 지금 카테고리. 돌려주는 reset()은 창을 새로 열 때, refresh()는
// 카테고리 탭을 바꿀 때 modal.js가 부름.
export function createRecordSearch({ fTitle, fCreator, titleList, creatorList, photoPicker, getCat }) {
  // 검색 결과로 채워 넣은 제목·작가 — 사용자가 그 뒤 손대지 않았으면 "직접 쓴 값"이
  // 아니라서 두 칸을 합친 검색에 안 씀(typedTitle/typedArtist).
  let autoTitle = null;
  let autoCreator = null;
  // 검색 결과를 골라 채운 표지 — 카테고리를 바꾸면 그대로 남아 있을 때만 지움.
  let autoCover = null;
  // 작가 칸에서 검색 결과를 고를 땐 아래 change 리스너의 "제목 칸 다시 검색"을 건너뜀.
  let skipCreatorRefresh = false;
  // 영화·애니를 고른 뒤 감독을 따로 물어보는 요청의 번호 — 그사이 다른 작품을 고르거나
  // 창을 다시 열면 늦게 온 옛 답은 버림.
  let creatorLookup = 0;
  // 칸마다 방금 끝난 검색이 실패했는지·다른 칸 값을 빼고 다시 찾았는지 — 목록 위·아래
  // 문구와 "결과 없음" 문구가 봄. 새 입력으로 취소된(abort) 옛 검색은 안 적음.
  const searchState = {
    title: { failed: false, dropped: '' },
    creator: { failed: false, dropped: '' },
  };

  function typedTitle() {
    const v = fTitle.value.trim();
    return v && v !== autoTitle ? v : '';
  }

  function typedArtist() {
    const v = fCreator.value.trim();
    return v && v !== autoCreator ? v : '';
  }

  function record(field, signal, state) {
    if (!(signal && signal.aborted)) searchState[field] = state;
  }

  // 영화·애니 버전의 webSearch. TMDB는 "제목 감독"을 한 번에 찾는 검색이 없어서, 두 칸이
  // 다 차 있으면 감독의 연출작(by=director)을 받아 제목으로 걸러냄. 걸러서 0건이면
  // 지금 칸만으로(제목 칸이면 제목 검색, 감독 칸이면 거르기 전 연출작 전체).
  function screenSearch(cat, field, q, signal) {
    const director = field === 'title' ? typedArtist() : q;
    const title = field === 'title' ? q : typedTitle();
    const byTitle = () => tryWeb(searchScreen(q, cat, signal), signal);
    if (field === 'title' && !director) return byTitle().then((found) => ({ found, dropped: '' }));
    return tryWeb(searchScreen(director, cat, signal, 'director'), signal).then((works) => {
      if (!title) return { found: works, dropped: '' };
      const hit = works ? titled(works, title) : [];
      if (hit.length) return { found: hit, dropped: '' };
      if (field === 'creator') return { found: works, dropped: works && works.length ? title : '' };
      return byTitle().then((again) => ({ found: again, dropped: again && again.length ? director : '' }));
    });
  }

  // field 칸에 q를 친 것 — 다른 칸에 직접 쓴 값이 있으면 합쳐서, 0건이면 q만으로.
  // → { found: 결과 배열|null(실패), dropped: 합쳤다가 뺀 다른 칸 값 }
  function webSearch(cat, field, q, signal) {
    if (isScreen(cat)) return screenSearch(cat, field, q, signal);
    const other = field === 'title' ? typedArtist() : typedTitle();
    // 만든 사람 칸만으로 찾을 땐 이름 전용 검색 — 책은 작가 이름, 음악은 그 가수의
    // 앨범·싱글 목록(일반 검색은 앨범을 3개까지만 줌).
    const byPerson = field === 'creator';
    const alone = () => (cat === 'music'
      ? searchMusic(q, signal, byPerson ? 'artist' : 'title')
      : searchBooks(q, signal, byPerson ? 'author' : 'title'));
    if (!other) return tryWeb(alone(), signal).then((found) => ({ found, dropped: '' }));
    const title = field === 'title' ? q : other;
    const person = field === 'title' ? other : q;
    // 합친 검색은 책도 by=title(카카오 기본 — 제목·작가 등 전부에서 찾음).
    const both = cat === 'music' ? searchMusic(`${person} ${title}`, signal) : searchBooks(`${title} ${person}`, signal);
    return tryWeb(both, signal).then((found) => {
      if (found && found.length) return { found, dropped: '' };
      return tryWeb(alone(), signal).then((again) => ({
        found: again,
        dropped: again && again.length ? other : '',
      }));
    });
  }

  function titleSuggestions(cat, q, signal) {
    const own = fetchSuggestions(cat, 'title', q, signal);
    if (!searchesWeb(cat, q)) {
      record('title', signal, { failed: false, dropped: '' });
      return own;
    }
    return Promise.all([own.catch(() => []), webSearch(cat, 'title', q, signal)]).then(([mine, { found, dropped }]) => {
      record('title', signal, { failed: found === null, dropped });
      const results = found || [];
      if (cat === 'book' || isScreen(cat)) {
        const mineTitles = new Set(mine.filter((s) => s.mine).map((s) => s.value.trim()));
        const webTitles = new Set(results.map((r) => r.title.trim()));
        const rest = mine.filter((s) => !webTitles.has(s.value.trim()));
        return rest.slice(0, 3).concat(results.map((r) => ({
          value: r.title,
          mine: mineTitles.has(r.title.trim()),
          ...(cat === 'book'
            ? {
              card: { title: r.full_title, meta: bookMeta(r), cover: r.cover },
              pick: { creator: r.creator, cover: r.cover },
              source: 'book',
            }
            : {
              card: { title: r.title, meta: screenMeta(cat, r), cover: r.cover },
              // 감독으로 걸러 찾은 결과면 감독을 이미 앎 — 아니면 고른 뒤 따로 물어봄.
              pick: r.creator
                ? { creator: r.creator, cover: r.cover }
                : { cover: r.cover, screen: { media: r.media, id: r.id } },
              source: 'screen',
            }),
        })));
      }
      return mine.slice(0, 3).concat(results.map((m) => ({
        // 로그인 검색이 노래까지 돌려주면 그 노래 제목, 아니면 입력한 그대로.
        value: m.song || q,
        card: albumCard(m),
        pick: { creator: m.creator, cover: m.cover },
        source: 'music',
      })));
    });
  }

  // 만든 사람 칸 — 작가·가수·감독 이름으로 찾음(제목 칸에 직접 쓴 제목이 있으면 합쳐서).
  // 고르면 칸엔 결과의 이름(예: "헤세" → "헤르만 헤세"), 표지도 채움. 책·영화·애니는
  // 제목까지, 음악은 제목을 안 채움(결과가 앨범이라 노래 제목과 다름 — 제목 칸은 사용자가 씀).
  function creatorSuggestions(cat, q, signal) {
    const own = fetchSuggestions(cat, 'creator', q, signal);
    if (!searchesWeb(cat, q)) {
      record('creator', signal, { failed: false, dropped: '' });
      return own;
    }
    return Promise.all([own.catch(() => []), webSearch(cat, 'creator', q, signal)]).then(([mine, { found, dropped }]) => {
      record('creator', signal, { failed: found === null, dropped });
      const results = (found || []).map((r) => {
        if (cat === 'book') {
          return {
            value: r.creator || q,
            card: { title: r.full_title, meta: bookMeta(r), cover: r.cover },
            pick: { title: r.title, cover: r.cover },
            source: 'book',
          };
        }
        if (isScreen(cat)) {
          // 감독의 연출작 — 고르면 제목·포스터.
          return {
            value: r.creator || q,
            card: { title: r.title, meta: screenMeta(cat, r), cover: r.cover },
            pick: { title: r.title, cover: r.cover },
            source: 'screen',
          };
        }
        return {
          value: r.creator || q,
          card: albumCard(r),
          pick: { cover: r.cover },
          source: 'music',
        };
      });
      return mine.slice(0, 3).concat(results);
    });
  }

  // 목록 맨 아래 작은 글씨 — 검색 결과가 섞여 있을 때만. 책·영화·애니는 API 약관의 출처
  // 표기, 음악은 고르면 무엇이 채워지는지 + 가수를 안 썼으면 요령.
  function titleFooter(items) {
    if (items.some((s) => s.source === 'book')) return '책 정보 제공: Kakao';
    if (items.some((s) => s.source === 'screen')) return `고르면 감독·포스터를 채워요 · ${TMDB_NOTE}`;
    if (items.some((s) => s.source === 'music')) {
      const tip = typedArtist() ? '' : ' · 가수를 함께 쓰면 더 정확해요';
      return '고르면 가수·앨범 커버를 채워요 · 제목은 쓴 그대로 남아요' + tip;
    }
    return '';
  }

  function creatorFooter(items) {
    if (items.some((s) => s.source === 'book')) return '책 정보 제공: Kakao';
    if (items.some((s) => s.source === 'screen')) return `고르면 제목·포스터를 채워요 · ${TMDB_NOTE}`;
    if (items.some((s) => s.source === 'music')) return '고르면 가수·앨범 커버를 채워요';
    return '';
  }

  // 목록 맨 위 — 다른 칸 값까지 합쳐서는 0건이라 이 칸만으로 다시 찾은 결과일 때.
  // 음악 제목 칸에선 항상 맨 위에 "노래는 실린 앨범으로 나온다"는 안내도 붙임 —
  // "뉴질랜드"를 쳤는데 앨범 "원래"만 보이면 노래가 없는 줄 알게 돼서(로그인 없는
  // 유튜브 뮤직 검색은 노래를 안 줌, music_search.py).
  function searchHeader(field, items) {
    const lines = [];
    const dropped = searchState[field].dropped;
    if (dropped && items.some((s) => s.source)) {
      lines.push(`'${dropped}'까지 넣으면 결과가 없어 ${field === 'title' ? '제목' : '이름'}만으로 찾았어요`);
    }
    if (field === 'title' && items.some((s) => s.source === 'music')) {
      lines.push('노래는 그 노래가 실린 앨범으로 나와요 — 앨범을 고르면 돼요');
    }
    return lines.join('\n');
  }

  // 검색까지 했는데 후보가 하나도 없을 때. 검색 자체가 실패한 것(서버·카카오·유튜브·TMDB
  // 오류)과 정말 결과가 없는 것을 구분해서 알려줌.
  function emptyText(field, q) {
    const cat = getCat();
    if (!searchesWeb(cat, q)) return '';
    if (searchState[field].failed) return '지금은 검색할 수 없어요. 직접 입력해 주세요.';
    const tip = field === 'title' && cat === 'music' && !typedArtist() ? ' 가수를 함께 써 보세요.' : '';
    return `'${q}' 검색 결과가 없어요.${tip}`;
  }

  // pick: { title?, creator?, cover?, screen? } — 목록에서 고른 것 자체가 "이걸로 하겠다"는
  // 선택이라 결과가 가진 제목·작가는 전에 직접 쓴 값이 있어도 바꿈(고른 뒤에 고친
  // 값은 다음에 또 고르기 전까지 그대로). 사진만 예외 — 직접 올린 사진(새로 고른 파일,
  // 수정 중인 기록에 올려 둔 사진)은 다시 찾아 올리기 번거로워서 안 바꾸고, 검색으로
  // 가져온 표지만 새 선택으로 바꿈.
  function fillFromPick(pick) {
    if (pick.title) {
      fTitle.value = pick.title;
      autoTitle = pick.title;
    }
    if (pick.creator) {
      fCreator.value = pick.creator;
      autoCreator = pick.creator;
    }
    const current = photoPicker.getUrl();
    const ownPhoto = photoPicker.getFile() || (current && !isSearchCover(current));
    if (pick.cover && !ownPhoto) {
      photoPicker.setExisting(pick.cover);
      autoCover = pick.cover;
    }
    // 영화·애니는 검색 결과에 감독이 없어서 고른 작품만 따로 물어봄. 답이 오기 전에
    // 다른 걸 고르거나 감독 칸을 직접 고치면(아래 input 리스너) 늦게 온 답은 버림.
    const lookup = ++creatorLookup;
    if (pick.screen) {
      fetchScreenCreator(pick.screen.media, pick.screen.id)
        .then((name) => {
          if (lookup !== creatorLookup || !name) return;
          fCreator.value = name;
          autoCreator = name;
        })
        .catch(() => {}); // 못 찾으면 사용자가 직접 씀
    }
  }

  const pendingText = (q) => (searchesWeb(getCat(), q) ? '검색 중…' : '');
  const titleAutocomplete = createAutocomplete(
    { input: fTitle, listEl: titleList },
    {
      getCat,
      fetchSuggestions: titleSuggestions,
      markMine: true, // 내 방에 이미 있는 제목 → "이미 기록함"
      onPick: (s) => { if (s.pick) fillFromPick(s.pick); },
      footer: titleFooter,
      header: (items) => searchHeader('title', items),
      pendingText,
      emptyText: (q) => emptyText('title', q),
      // 제목 결과를 보면서 작가 칸을 눌러도 안 닫힘 — 작가 칸에 입력을 시작하면 닫음(아래).
      // 작가 칸 목록이 열려 있을 땐 제목 칸을 눌러도 그 위를 덮지 않음(반대도 같음).
      keepOpenOn: [fCreator],
      openOnFocus: () => !creatorAutocomplete.isOpen(),
      // 두 목록은 같은 자리(묶음 아래)에 떠서, 나중에 열린 쪽만 남김 — 작가 칸을 고치고
      // 제목 칸을 누르면(change → 제목 목록 다시 찾기) 둘이 겹쳐 보였음.
      onShow: () => creatorAutocomplete.hide(),
    },
  );
  const creatorAutocomplete = createAutocomplete(
    { input: fCreator, listEl: creatorList },
    {
      getCat,
      fetchSuggestions: creatorSuggestions,
      onPick: (s) => {
        if (!s.pick) return;
        // 작가·가수·감독 검색 결과를 고른 것 — 칸에 들어간 이름은 사용자가 고른 것이라
        // 자동으로 채운 값으로 치지 않음(두 칸을 합친 검색에 씀).
        autoCreator = null;
        skipCreatorRefresh = true;
        fillFromPick(s.pick);
      },
      footer: creatorFooter,
      header: (items) => searchHeader('creator', items),
      pendingText,
      emptyText: (q) => emptyText('creator', q),
      keepOpenOn: [fTitle],
      openOnFocus: () => !titleAutocomplete.isOpen(),
      onShow: () => titleAutocomplete.hide(),
    },
  );

  // 칸에 한 번이라도 직접 손대면 그 값은 사용자가 쓴 것 — 자동으로 채운 값이었다는
  // 표시를 지워서 검색어에 넣음(typedArtist/typedTitle). 고쳤다가 같은 글자로 되돌려도
  // 마찬가지. 감독 칸을 고치면 아직 안 온 감독 조회 답도 버림(고친 값을 덮지 않게).
  // 한쪽 칸에 입력을 시작하면 다른 칸의 목록은 닫음 — 두 목록이 같은 자리(묶음 아래)에
  // 떠서 겹치지 않게(keepOpenOn으로 눌렀을 때는 열어 둠).
  fTitle.addEventListener('input', () => { autoTitle = null; creatorAutocomplete.hide(); });
  fCreator.addEventListener('input', () => { autoCreator = null; creatorLookup++; titleAutocomplete.hide(); });

  // 작가·가수·감독을 제목보다 나중에 써도 되게 — 작가 칸을 고치고 나가면 제목 칸의
  // 검색 결과를 두 칸을 합친 검색으로 다시 찾아 보여줌(webSearch). 작가 칸 목록에서
  // 결과를 고르며 나갈 때는 안 함 — 고르는 클릭에 칸이 blur되며 change가 onPick보다
  // 먼저 오므로 다음 틱에 판단.
  fCreator.addEventListener('change', () => {
    setTimeout(() => {
      if (skipCreatorRefresh) { skipCreatorRefresh = false; return; }
      if (searchesWeb(getCat(), fTitle.value.trim())) titleAutocomplete.refresh();
    }, 0);
  });

  return {
    // 창을 새로 열 때(새 기록·수정) — 자동으로 채운 값 기억과 늦게 올 감독 답을 버리고
    // 두 목록을 닫음.
    reset() {
      autoTitle = null;
      autoCreator = null;
      autoCover = null;
      creatorLookup++;
      titleAutocomplete.hide();
      creatorAutocomplete.hide();
    },
    // 카테고리 탭을 바꿨을 때. 직접 쓴 값은 그대로 두고(애니 탭에서 쓴 "괴물"이 사실
    // 영화였을 때 탭만 바꾸면 다시 찾아지게), 다른 카테고리의 검색 결과를 골라 채운
    // 제목·작가·감독·가수와 표지는 지움 — 책 제목·작가·표지가 영화 기록에 남지 않게.
    // 그다음 지금 입력값으로 목록을 다시 찾음 — 두 목록은 한 번에 하나만 뜨니(onShow)
    // 작가 칸 목록이 열려 있었으면 그쪽, 아니면 제목 칸.
    refresh() {
      creatorLookup++; // 아직 안 온 감독 답이 새 탭의 칸을 채우지 않게
      if (autoTitle && fTitle.value.trim() === autoTitle) fTitle.value = '';
      autoTitle = null;
      if (autoCreator && fCreator.value.trim() === autoCreator) fCreator.value = '';
      autoCreator = null;
      if (autoCover && !photoPicker.getFile() && photoPicker.getUrl() === autoCover) photoPicker.reset();
      autoCover = null;
      if (creatorAutocomplete.isOpen() && fCreator.value.trim()) creatorAutocomplete.refresh();
      else titleAutocomplete.refresh();
    },
  };
}
