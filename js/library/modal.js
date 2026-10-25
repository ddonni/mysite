// "새 기록 추가 / 기존 기록 수정하기" 모달창을 담당하는 모듈.
// 카테고리 탭, 제목 입력, 저장 버튼 배선은 여기서 하지만, 별점/사진
// 첨부/제목 추천 목록은 각자 자기 상태를 스스로 관리하는 위젯
// (modal/starPicker.js, modal/photoPicker.js, modal/presetAutocomplete.js)
// 으로 빠져 있음 — 이 파일은 그 위젯들의 getValue()/getFile() 같은
// 결과만 모아서 폼을 채우고 비우고 저장하는 오케스트레이션만 함.
//
// 실제 서버 저장은 records.js의 uploadPhoto/saveRecord를 불러 씀.
import { CATS, PRESETS, uploadPhoto, saveRecord, fetchSuggestions, searchBooks, searchMusic } from './records.js';
import { CREATOR_FIELD } from './modal/categoryFields.js';
import { createStarPicker } from './modal/starPicker.js';
import { createPhotoPicker } from './modal/photoPicker.js';
import { createPresetAutocomplete } from './modal/presetAutocomplete.js';
import { shrinkImage } from './modal/shrinkImage.js';

export function createModal({ onSaved }) {
  const overlay = document.getElementById('overlay');
  const catTabsEl = document.getElementById('catTabs');
  const fTitle = document.getElementById('fTitle');
  const fCreator = document.getElementById('fCreator');
  const creatorLabel = document.getElementById('creatorLabel');
  const fMemo = document.getElementById('fMemo');
  const saveBtn = document.getElementById('saveBtn');
  const titleError = document.getElementById('titleError');
  const modalTitle = document.getElementById('modalTitle');

  const starPicker = createStarPicker(document.getElementById('starPicker'));
  const photoPicker = createPhotoPicker({
    input: document.getElementById('fPhoto'),
    preview: document.getElementById('photoPreview'),
    removeBtn: document.getElementById('removePhoto'),
    dropZone: document.getElementById('photoDrop'),
    dropText: document.getElementById('photoDropText'),
  });
  // 제목 칸·만든 사람 칸 자동 완성 — 서로 독립(제목만 고른 후보로는 만든 사람을 안
  // 채움: 동명의 다른 작품이 흔하고, 만든 사람을 모르고 기록하는 경우도 많아서).
  // 예외는 책·음악 검색 결과 — 특정 판본·앨범 하나를 고른 것이라 나머지 칸·표지까지
  // 채움(fillFromPick). 두 칸 모두 책·음악이면 검색 결과를 보여줌(제목 칸은 제목으로,
  // 만든 사람 칸은 작가·가수 이름으로 찾음).
  const getCat = () => currentCat;
  const presetAutocomplete = createPresetAutocomplete(
    { input: fTitle, listEl: document.getElementById('presetList') },
    {
      getCat,
      fetchSuggestions: titleSuggestions,
      presets: (cat) => PRESETS[cat],
      markMine: true, // 내 방에 이미 있는 제목 → "이미 기록함"
      onPick: (s) => { if (s.pick) fillFromPick(s.pick); },
      footer: titleFooter,
      header: (items) => searchHeader('title', items),
      pendingText: (q) => (searchesWeb(currentCat, q) ? '검색 중…' : ''),
      emptyText: (q) => emptyText('title', q),
      // 제목 결과를 보면서 작가 칸을 눌러도 안 닫힘 — 작가 칸에 입력을 시작하면 닫음(아래).
      // 작가 칸 목록이 열려 있을 땐 제목 칸을 눌러도 그 위를 덮지 않음(반대도 같음).
      keepOpenOn: [fCreator],
      openOnFocus: () => !creatorAutocomplete.isOpen(),
    },
  );
  const creatorAutocomplete = createPresetAutocomplete(
    { input: fCreator, listEl: document.getElementById('creatorList') },
    {
      getCat,
      fetchSuggestions: creatorSuggestions,
      onPick: (s) => {
        if (!s.pick) return;
        // 작가·가수 검색 결과를 고른 것 — 칸에 들어간 이름은 사용자가 고른 것이라
        // 자동으로 채운 값으로 치지 않음(검색어에 쓰고, 다음 선택에 안 덮어씀).
        autoCreator = null;
        skipCreatorRefresh = true;
        fillFromPick(s.pick);
      },
      footer: creatorFooter,
      header: (items) => searchHeader('creator', items),
      pendingText: (q) => (searchesWeb(currentCat, q) ? '검색 중…' : ''),
      emptyText: (q) => emptyText('creator', q),
      keepOpenOn: [fTitle],
      openOnFocus: () => !presetAutocomplete.isOpen(),
    },
  );

  let currentCat = 'book';
  let editingId = null;
  // 검색 결과로 채워 넣은 제목·작가·표지 — 사용자가 그 뒤 직접 바꾸지 않았으면
  // 다른 결과를 다시 골랐을 때 새 값으로 바꿔도 됨(직접 쓴/올린 건 안 덮어씀).
  let autoTitle = null;
  let autoCreator = null;
  let autoCover = null;
  // 작가 칸에서 검색 결과를 고를 땐 아래 change 리스너의 "제목 칸 다시 검색"을 건너뜀.
  let skipCreatorRefresh = false;

  // 책·음악이면 이 방·공개 방들의 후보 뒤에 검색 결과를 붙임. 한 글자로는 검색 결과가
  // 너무 넓어서 두 글자부터. 어느 한쪽이 실패해도 나머지만으로 보여줌.
  //
  // 두 칸이 다 차 있으면 어느 칸에서 치든 둘을 합쳐 찾음(webSearch) — 책은 "제목 작가"
  // (카카오가 제목·작가 둘 다 맞는 책을 앞에 둠), 음악은 "가수 제목"(유튜브 뮤직은
  // 로그인 없이 앨범만 찾아져서 노래 제목만으론 남의 커버곡이 먼저 나오기 쉬움 —
  // 백엔드 music_search.py). 다른 칸 값은 **직접 쓴** 것만 씀 — 앞서 고른 결과로
  // 자동으로 채워진 값은 이쪽 칸을 바꾼 뒤엔 엉뚱할 수 있어서. 합쳐서 0건이면 지금
  // 칸만으로 한 번 더 찾고 목록 위에 알림.
  //   - 책 제목 칸: 같은 제목이 이 방 후보와 검색 결과 둘 다에 있으면 검색 결과 쪽만
  //     남기고("이미 기록함" 표시는 옮겨 붙임) — 같은 줄이 두 번 보이지 않게.
  //   - 음악: 고르면 제목은 입력한 그대로 둠(대개 노래 제목이라 앨범 이름으로 덮으면
  //     틀어짐).
  //
  // searchState: 칸마다 방금 끝난 검색이 실패했는지·다른 칸 값을 빼고 다시 찾았는지 —
  // 목록 위·아래 문구와 "결과 없음" 문구가 봄. 새 입력으로 취소된(abort) 옛 검색은 안 적음.
  const searchState = {
    title: { failed: false, dropped: '' },
    creator: { failed: false, dropped: '' },
  };

  function searchesWeb(cat, q) {
    return (cat === 'book' || cat === 'music') && q.length >= 2;
  }

  function typedTitle() {
    const v = fTitle.value.trim();
    return v && v !== autoTitle ? v : '';
  }

  function typedArtist() {
    const v = fCreator.value.trim();
    return v && v !== autoCreator ? v : '';
  }

  // 검색 결과 배열 또는 실패(null). 취소된 요청은 abort 에러 그대로 넘김.
  function tryWeb(promise, signal) {
    return promise.catch((err) => {
      if (signal && signal.aborted) throw err;
      return null;
    });
  }

  function record(field, signal, state) {
    if (!(signal && signal.aborted)) searchState[field] = state;
  }

  // field 칸에 q를 친 것 — 다른 칸에 직접 쓴 값이 있으면 합쳐서, 0건이면 q만으로.
  // → { found: 결과 배열|null(실패), dropped: 합쳤다가 뺀 다른 칸 값 }
  function webSearch(cat, field, q, signal) {
    const other = field === 'title' ? typedArtist() : typedTitle();
    const alone = () => (cat === 'music'
      ? searchMusic(q, signal)
      : searchBooks(q, signal, field === 'creator' ? 'author' : 'title'));
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

  const bookMeta = (b) => [b.creator, b.publisher, b.year].filter(Boolean).join(' · ');
  const albumCard = (m) => ({
    title: m.song || m.album,
    meta: [m.creator, m.song ? m.album : m.kind, m.year].filter(Boolean).join(' · '),
    cover: m.cover,
    square: true,
  });

  function titleSuggestions(cat, q, signal) {
    const own = fetchSuggestions(cat, 'title', q, signal);
    if (!searchesWeb(cat, q)) {
      record('title', signal, { failed: false, dropped: '' });
      return own;
    }
    return Promise.all([own.catch(() => []), webSearch(cat, 'title', q, signal)]).then(([mine, { found, dropped }]) => {
      record('title', signal, { failed: found === null, dropped });
      const results = found || [];
      if (cat === 'book') {
        const mineTitles = new Set(mine.filter((s) => s.mine).map((s) => s.value.trim()));
        const bookTitles = new Set(results.map((b) => b.title.trim()));
        const rest = mine.filter((s) => !bookTitles.has(s.value.trim()));
        return rest.slice(0, 3).concat(results.map((b) => ({
          value: b.title,
          mine: mineTitles.has(b.title.trim()),
          card: { title: b.full_title, meta: bookMeta(b), cover: b.cover },
          pick: { creator: b.creator, cover: b.cover },
          source: 'book',
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

  // 만든 사람 칸 — 작가·가수 이름으로 찾음(제목 칸에 직접 쓴 제목이 있으면 합쳐서).
  // 고르면 칸엔 결과의 이름(예: "헤세" → "헤르만 헤세"), 표지도 채움. 책은 제목이
  // 비었거나 자동으로 채운 것이면 제목까지, 음악은 제목을 안 채움(결과가 앨범이라
  // 노래 제목과 다름 — 제목 칸은 사용자가 씀).
  function creatorSuggestions(cat, q, signal) {
    const own = fetchSuggestions(cat, 'creator', q, signal);
    if (!searchesWeb(cat, q)) {
      record('creator', signal, { failed: false, dropped: '' });
      return own;
    }
    return Promise.all([own.catch(() => []), webSearch(cat, 'creator', q, signal)]).then(([mine, { found, dropped }]) => {
      record('creator', signal, { failed: found === null, dropped });
      const results = (found || []).map((r) => (cat === 'book'
        ? {
          value: r.creator || q,
          card: { title: r.full_title, meta: bookMeta(r), cover: r.cover },
          pick: { title: r.title, cover: r.cover },
          source: 'book',
        }
        : {
          value: r.creator || q,
          card: albumCard(r),
          pick: { cover: r.cover },
          source: 'music',
        }));
      return mine.slice(0, 3).concat(results);
    });
  }

  // 목록 맨 아래 작은 글씨 — 검색 결과가 섞여 있을 때만. 책은 카카오 검색 API
  // 약관의 출처 표기, 음악은 고르면 무엇이 채워지는지 + 가수를 안 썼으면 요령.
  function titleFooter(items) {
    if (items.some((s) => s.source === 'book')) return '책 정보 제공: Kakao';
    if (items.some((s) => s.source === 'music')) {
      const tip = typedArtist() ? '' : ' · 가수를 함께 쓰면 더 정확해요';
      return '고르면 가수·앨범 커버를 채워요' + tip;
    }
    return '';
  }

  function creatorFooter(items) {
    if (items.some((s) => s.source === 'book')) return '책 정보 제공: Kakao';
    if (items.some((s) => s.source === 'music')) return '고르면 가수·앨범 커버를 채워요';
    return '';
  }

  // 목록 맨 위 — 다른 칸 값까지 합쳐서는 0건이라 이 칸만으로 다시 찾은 결과일 때.
  function searchHeader(field, items) {
    const dropped = searchState[field].dropped;
    if (!dropped || !items.some((s) => s.source)) return '';
    const alone = field === 'title' ? '제목' : '이름';
    return `'${dropped}'까지 넣으면 결과가 없어 ${alone}만으로 찾았어요`;
  }

  // 검색까지 했는데 후보가 하나도 없을 때. 검색 자체가 실패한 것(서버·카카오·유튜브
  // 오류)과 정말 결과가 없는 것을 구분해서 알려줌.
  function emptyText(field, q) {
    if (!searchesWeb(currentCat, q)) return '';
    if (searchState[field].failed) return '지금은 검색할 수 없어요. 직접 입력해 주세요.';
    const tip = field === 'title' && currentCat === 'music' && !typedArtist() ? ' 가수를 함께 써 보세요.' : '';
    return `'${q}' 검색 결과가 없어요.${tip}`;
  }

  // pick: { title?, creator?, cover? } — 빈 칸이거나 전에 자동으로 채운 칸만 채움.
  function fillFromPick(pick) {
    const title = fTitle.value.trim();
    if (pick.title && (!title || title === autoTitle)) {
      fTitle.value = pick.title;
      autoTitle = pick.title;
    }
    const creator = fCreator.value.trim();
    if (pick.creator && (!creator || creator === autoCreator)) {
      fCreator.value = pick.creator;
      autoCreator = pick.creator;
    }
    // 사진은 아직 없거나, 전에 검색 결과로 채운 표지일 때만 바꿈 — 직접 고른
    // 파일이나 수정 중인 기록의 원래 사진은 그대로 둠.
    const current = photoPicker.getFile() ? 'file' : photoPicker.getUrl();
    if (pick.cover && (!current || current === autoCover)) {
      photoPicker.setExisting(pick.cover);
      autoCover = pick.cover;
    }
  }

  // 칸에 한 번이라도 직접 손대면 그 값은 사용자가 쓴 것 — 자동으로 채운 값이었다는
  // 표시를 지워서, 검색어에 넣고(typedArtist) 다음 결과를 골라도 안 덮어씀
  // (fillFromPick). 고쳤다가 같은 글자로 되돌려도 마찬가지.
  // 한쪽 칸에 입력을 시작하면 다른 칸의 목록은 닫음 — 두 목록이 같은 자리(묶음 아래)에
  // 떠서 겹치지 않게(keepOpenOn으로 눌렀을 때는 열어 둠).
  fTitle.addEventListener('input', () => { autoTitle = null; creatorAutocomplete.hide(); });
  fCreator.addEventListener('input', () => { autoCreator = null; presetAutocomplete.hide(); });

  // 작가·가수를 제목보다 나중에 써도 되게 — 작가 칸을 고치고 나가면 제목 칸의
  // 검색 결과를 두 칸을 합친 검색으로 다시 찾아 보여줌(webSearch). 작가 칸 목록에서
  // 결과를 고르며 나갈 때는 안 함 — 고르는 클릭에 칸이 blur되며 change가 onPick보다
  // 먼저 오므로 다음 틱에 판단.
  fCreator.addEventListener('change', () => {
    setTimeout(() => {
      if (skipCreatorRefresh) { skipCreatorRefresh = false; return; }
      if (searchesWeb(currentCat, fTitle.value.trim())) presetAutocomplete.refresh();
    }, 0);
  });

  function updateCreatorField() {
    const field = CREATOR_FIELD[currentCat] || CREATOR_FIELD.book;
    creatorLabel.textContent = field.label;
  }

  // ---- 카테고리 탭(책/애니/영화/음악) ----
  CATS.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat.label;
    btn.dataset.key = cat.key;
    if (cat.key === currentCat) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentCat = cat.key;
      [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === cat.key));
      updateCreatorField();
      presetAutocomplete.refresh();
      creatorAutocomplete.refresh();
    });
    catTabsEl.appendChild(btn);
  });

  // ---- 모달 열기/닫기 ----
  // cat: 처음 골라둘 카테고리 — 보고 있던 탭(음악 탭이면 음악). 전체 탭이면 책.
  function resetFormForAdd(cat) {
    editingId = null;
    titleError.style.display = 'none';
    modalTitle.textContent = '새 기록';
    currentCat = CATS.some((c) => c.key === cat) ? cat : 'book';
    [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
    updateCreatorField();
    fTitle.value = '';
    fCreator.value = '';
    fMemo.value = '';
    autoTitle = null;
    autoCreator = null;
    autoCover = null;
    photoPicker.reset();
    starPicker.setValue(0);
    presetAutocomplete.hide();
    creatorAutocomplete.hide();
  }

  // 창은 "취소"(또는 저장 성공)로만 닫힘 — 예전엔 창 바깥을 누르면 닫혀서,
  // 입력하다 실수로 바깥을 건드리면 쓰던 내용이 통째로 날아갔음.
  document.getElementById('cancelBtn').addEventListener('click', () => overlay.classList.remove('open'));

  // ---- 저장 ----
  async function handleSave() {
    if (saveBtn.disabled) return; // 저장 중에 또 눌려도(더블클릭 등) 두 번 저장하지 않게
    // 한글은 마지막 글자가 아직 "조합 중"일 수 있음 — 저장 버튼을 눌러도
    // 입력칸에서 포커스가 안 빠지는 브라우저(Mac Safari/Chrome, 폰 키보드 등)에선
    // 그 글자가 확정되기 전에 값을 읽어서 마지막 한 글자가 빠진 채 저장됐음.
    // 포커스를 빼서 조합을 확정시키고, 확정이 반영된 다음 틱에 값을 읽음.
    saveBtn.disabled = true;
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    await new Promise((r) => setTimeout(r, 0));

    const title = fTitle.value.trim();
    if (!title) {
      saveBtn.disabled = false;
      titleError.style.display = 'block';
      fTitle.focus();
      return;
    }
    titleError.style.display = 'none';

    saveBtn.textContent = '저장 중…';
    try {
      let photo_url = photoPicker.getUrl();
      if (photoPicker.getFile()) {
        photo_url = await uploadPhoto(await shrinkImage(photoPicker.getFile()));
      }
      await saveRecord({
        cat: currentCat,
        title,
        creator: fCreator.value.trim(),
        rating: starPicker.getValue(),
        memo: fMemo.value.trim(),
        photo_url,
      }, editingId);

      onSaved(); // main.js가 목록을 다시 불러와 화면에 반영함
      overlay.classList.remove('open');
    } catch (err) {
      alert('저장에 실패했어요. 잠시 후 다시 시도해주세요.');
      console.error(err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  }
  saveBtn.addEventListener('click', handleSave);

  return {
    openAdd(cat) {
      resetFormForAdd(cat);
      overlay.classList.add('open');
    },

    // list.js에서 "수정하기"를 누르면 그 기록(item) 전체를 그대로
    // 넘겨받아서, 모달 폼에 기존 값을 채워 넣음.
    openEdit(item) {
      titleError.style.display = 'none';
      editingId = item.id;
      modalTitle.textContent = '기록 수정하기';
      currentCat = item.cat;
      [...catTabsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.key === currentCat));
      updateCreatorField();
      fTitle.value = item.title || '';
      fCreator.value = item.creator || '';
      fMemo.value = item.memo || '';
      autoTitle = null;
      autoCreator = null;
      autoCover = null;
      photoPicker.setExisting(item.photo_url || null);
      starPicker.setValue(item.rating || 0);
      presetAutocomplete.hide();
      creatorAutocomplete.hide();
      overlay.classList.add('open');
    },
  };
}
