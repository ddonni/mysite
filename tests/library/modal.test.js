// modal.js — 음악 탭 제목 검색이 가수 칸을 어떻게 쓰는지(직접 쓴 가수만, 0건이면
// 가수 없이 다시), 검색 실패·결과 없음 문구가 맞게 뜨는지. 서버 호출(records.js)은 가짜.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../js/shared/config.js', () => ({
  API_BASE: 'http://api.test',
  GOOGLE_CLIENT_ID: '',
  DEVELOPER_ROOM_CODE: '',
}));

const searchMusic = vi.fn();
const searchBooks = vi.fn();
const searchScreen = vi.fn();
const fetchScreenCreator = vi.fn();
const saveRecord = vi.fn();
const deleteRecord = vi.fn();
const fetchMusicListen = vi.fn();
const play = vi.fn();
vi.mock('../../js/shared/youtube.js', async (orig) => ({
  ...(await orig()),
  getPlayer: () => ({ play }),
}));
vi.mock('../../js/library/records.js', () => ({
  CATS: [
    { key: 'book', label: '책' }, { key: 'anime', label: '애니' },
    { key: 'movie', label: '영화' }, { key: 'music', label: '음악' }, { key: 'wardrobe', label: '옷장' },
  ],
  uploadPhoto: vi.fn(),
  saveRecord: (...a) => saveRecord(...a),
  deleteRecord: (...a) => deleteRecord(...a),
  fetchSuggestions: () => Promise.resolve([]),
  searchBooks: (...a) => searchBooks(...a),
  searchMusic: (...a) => searchMusic(...a),
  searchScreen: (...a) => searchScreen(...a),
  fetchScreenCreator: (...a) => fetchScreenCreator(...a),
  fetchMusicListen: (...a) => fetchMusicListen(...a),
}));

const { createModal } = await import('../../js/library/modal.js');

const ALBUM = { album: 'LEGEND(전설)', song: null, creator: 'JANNABI', kind: '앨범', year: '', cover: 'https://yt3.googleusercontent.com/x' };

function mountDom() {
  document.body.innerHTML = `
    <div id="overlay"><h2 id="modalTitle"></h2><div id="catTabs"></div>
      <div id="searchView"><input id="sQuery"><button id="sBtn"></button><span id="sStatus"></span>
        <button id="manualBtn"></button><div id="sNotice" hidden></div><ul id="sResults"></ul><p id="sFoot"></p>
        <button id="searchCloseBtn"></button></div>
      <div id="formView" hidden><div class="modal-actions"></div></div>
      <label id="titleLabel"></label><input id="fTitle"><input id="fCreator"><label id="creatorLabel"></label>
      <div id="titleList" style="display:none"></div><div id="creatorList" style="display:none"></div>
      <div id="titleError"></div><div id="starField"><div id="starPicker"></div></div>
      <div id="wardrobeField" hidden></div><label id="memoLabel"></label>
      <div id="photoDrop"><span id="photoDropText"></span><input type="file" id="fPhoto"></div>
      <img id="photoPreview"><span id="removePhoto"></span>
      <textarea id="fMemo"></textarea>
      <div id="listenField" hidden><input id="fListen"><button id="listenTry"></button>
        <div id="listenHint"></div><div id="listenError" style="display:none"></div></div>
      <button id="cancelBtn"></button><button id="saveBtn"></button>
    </div>`;
}

const settle = () => new Promise((r) => setTimeout(r, 250));
const $ = (id) => document.getElementById(id);

function typeTitle(v) {
  $('fTitle').value = v;
  $('fTitle').dispatchEvent(new Event('input'));
}

let modal;
let onSaved;
beforeEach(() => {
  saveRecord.mockReset().mockResolvedValue();
  deleteRecord.mockReset().mockResolvedValue();
  searchMusic.mockReset();
  searchBooks.mockReset();
  searchScreen.mockReset();
  fetchScreenCreator.mockReset();
  fetchMusicListen.mockReset().mockResolvedValue(null);
  play.mockReset();
  mountDom();
  onSaved = vi.fn();
  modal = createModal({ onSaved });
  modal.openAdd('music');
  // 아래 입력 칸 테스트들은 직접 쓰기로 연 입력 칸에서(검색 화면은 맨 아래 묶음).
  $('manualBtn').click();
});

describe('음악 탭 제목 검색', () => {
  const LINK = 'https://www.youtube.com/playlist?list=OLAK5uy_x&index=2';
  const SONG = { album: 'TEAM BABY', song: '나랑 아니면', creator: '검정치마', kind: '노래', year: '2017', cover: 'https://yt3.googleusercontent.com/tb', listen: LINK, album_id: 'A1' };

  it('검색 화면과 같은 검색 — 가수 칸에 쓴 값은 안 붙임', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    $('fCreator').value = '잔나비';
    typeTitle('주저하는 연인들을 위해');
    await settle();
    expect(searchMusic.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ['주저하는 연인들을 위해', 'songs'], ['주저하는 연인들을 위해', undefined],
    ]);
    const item = $('titleList').querySelector('.ac-item.rich');
    expect(item.querySelector('.ac-title').textContent).toBe('주저하는 연인들을 위해');
    expect(item.querySelector('.ac-meta').textContent).toBe('JANNABI · 앨범 LEGEND(전설)');
  });

  it('가수 이름을 치면 그 가수의 노래 — 고르면 제목·가수·커버·유튜브 링크', async () => {
    searchMusic.mockImplementation((q, signal, by) => Promise.resolve(by === 'songs' ? [SONG] : [{ ...ALBUM, creator: '검정치마' }]));
    typeTitle('검정치마');
    await settle();
    expect($('titleList').querySelector('.ac-foot').textContent).toBe('고르면 가수·앨범 커버·유튜브 링크를 채워요');
    $('titleList').querySelector('.ac-item.rich').click();
    expect($('fTitle').value).toBe('나랑 아니면');
    expect($('fCreator').value).toBe('검정치마');
    expect($('photoPreview').getAttribute('src')).toBe(SONG.cover);
    expect($('fListen').value).toBe(LINK);
  });

  it('앨범 줄을 고르면 그 앨범에서 노래 링크를 물어봄', async () => {
    searchMusic.mockImplementation((q, signal, by) => Promise.resolve(by === 'songs' ? [] : [{ ...ALBUM, album_id: 'MPREb_j' }]));
    fetchMusicListen.mockResolvedValue(LINK);
    typeTitle('주저하는 연인들을 위해');
    await settle();
    $('titleList').querySelector('.ac-item.rich').click();
    await settle();
    expect(fetchMusicListen).toHaveBeenCalledWith('MPREb_j', '주저하는 연인들을 위해');
    expect($('fListen').value).toBe(LINK);
  });

  it('제목 칸 안내 글씨', () => {
    expect($('fTitle').placeholder).toBe('노래 제목 — 가수 이름으로도 찾아요');
    modal.openAdd('book'); // 다른 탭은 원래 안내 글씨
    $('manualBtn').click();
    expect($('fTitle').placeholder).toBe('제목을 입력해 보세요');
  });

  it('결과가 없으면 검색어와 함께 알려줌', async () => {
    searchMusic.mockResolvedValue([]);
    typeTitle('없는노래');
    await settle();
    expect($('titleList').querySelector('.ac-message').textContent).toBe("'없는노래' 검색 결과가 없어요.");
  });

  it('검색이 실패하면 결과 없음과 다르게 알려줌', async () => {
    searchMusic.mockRejectedValue(new Error('music search failed'));
    typeTitle('밤양갱');
    await settle();
    expect($('titleList').querySelector('.ac-message').textContent).toBe('지금은 검색할 수 없어요. 직접 입력해 주세요.');
  });
});

describe('두 칸의 목록', () => {
  it('제목 결과가 뜬 채로 작가 칸을 눌러도 안 닫히고, 작가 칸에 입력하면 닫힘', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    typeTitle('주저하는 연인들을 위해');
    await settle();
    expect($('titleList').style.display).toBe('block');

    $('fCreator').click();
    expect($('titleList').style.display).toBe('block');

    $('fCreator').value = '잔';
    $('fCreator').dispatchEvent(new Event('input'));
    expect($('titleList').style.display).toBe('none');
  });

  it('작가 칸에 값이 있어도, 제목 결과가 열려 있으면 포커스만으로 덮지 않음', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    typeTitle('주저하는 연인들을 위해');
    await settle();
    $('titleList').querySelector('.ac-item.rich').click(); // 가수 JANNABI 자동 채움
    typeTitle('LEGEND');
    await settle();
    const calls = searchMusic.mock.calls.length;

    $('fCreator').dispatchEvent(new Event('focus'));
    await settle();
    expect($('titleList').style.display).toBe('block');
    expect($('creatorList').style.display).toBe('none');
    expect(searchMusic.mock.calls.length).toBe(calls); // 작가 검색이 안 나감
  });

  it('두 칸 바깥을 누르면 닫힘', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    typeTitle('주저하는 연인들을 위해');
    await settle();
    $('fMemo').click();
    expect($('titleList').style.display).toBe('none');
  });
});

describe('만든 사람 칸 검색', () => {
  const HAN = { title: '소년이 온다', full_title: '소년이 온다', creator: '한강', publisher: '창비', year: '2014', cover: 'https://t1.daumcdn.net/lbook/image/1' };

  function typeCreator(v) {
    $('fCreator').value = v;
    $('fCreator').dispatchEvent(new Event('input'));
  }

  it('책: 작가 이름으로 찾고, 고르면 이름·제목·표지를 채움', async () => {
    modal.openAdd('book');
    $('manualBtn').click();
    searchBooks.mockResolvedValue([HAN]);
    typeCreator('한강');
    await settle();
    expect(searchBooks).toHaveBeenCalledWith('한강', expect.anything(), 'author');
    $('creatorList').querySelector('.ac-item.rich').click();
    expect($('fCreator').value).toBe('한강');
    expect($('fTitle').value).toBe('소년이 온다');
    expect($('photoPreview').getAttribute('src')).toContain('/api/cover?url=');
  });

  it('책: 이미 쓴 제목이 있어도 고른 결과의 제목으로 바뀜', async () => {
    modal.openAdd('book');
    $('manualBtn').click();
    searchBooks.mockResolvedValue([HAN]);
    typeTitle('채식주의자');
    typeCreator('한강');
    await settle();
    $('creatorList').querySelector('.ac-item.rich').click();
    expect($('fTitle').value).toBe('소년이 온다');
  });

  it('고른 뒤에 고친 값은 그대로 — 저장되는 것도 고친 값', async () => {
    modal.openAdd('book');
    $('manualBtn').click();
    searchBooks.mockResolvedValue([HAN]);
    typeCreator('한강');
    await settle();
    $('creatorList').querySelector('.ac-item.rich').click();
    typeTitle('소년이 온다 (내 메모판)');
    expect($('fTitle').value).toBe('소년이 온다 (내 메모판)');
    expect($('fCreator').value).toBe('한강');
  });

  it('책: 제목 칸에 직접 쓴 제목이 있으면 "제목 작가"로 합쳐 찾음', async () => {
    modal.openAdd('book');
    $('manualBtn').click();
    searchBooks.mockResolvedValue([HAN]);
    typeTitle('소년이 온다');
    await settle();
    typeCreator('한강');
    await settle();
    expect(searchBooks).toHaveBeenLastCalledWith('소년이 온다 한강', expect.anything());
  });

  it('책: 제목 칸은 검색 화면과 같은 검색 — 작가 칸 값은 안 붙이고 제목·작가 이름 둘 다로', async () => {
    modal.openAdd('book');
    $('manualBtn').click();
    searchBooks.mockResolvedValue([HAN]);
    typeCreator('한강');
    await settle();
    searchBooks.mockClear();
    typeTitle('소년이 온다');
    await settle();
    expect(searchBooks.mock.calls.map((c) => [c[0], c[2]])).toEqual([['소년이 온다', 'author'], ['소년이 온다', undefined]]);
  });

  it('책: 합쳐서 0건이면 작가 이름만으로 다시 찾고 맨 위에 알림', async () => {
    modal.openAdd('book');
    $('manualBtn').click();
    searchBooks.mockImplementation((q, signal, by) => Promise.resolve(by === 'author' ? [HAN] : []));
    typeTitle('없는 제목');
    await settle();
    typeCreator('한강');
    await settle();
    expect(searchBooks.mock.calls.slice(-2).map((c) => [c[0], c[2]])).toEqual([['없는 제목 한강', undefined], ['한강', 'author']]);
    expect($('creatorList').querySelector('.ac-head').textContent).toBe("'없는 제목'까지 넣으면 결과가 없어 이름만으로 찾았어요");
  });

  it('음악: 가수로 찾은 앨범을 고르면 가수·커버만, 제목 칸은 그대로 비워 둠', async () => {
    searchMusic.mockResolvedValue([{ ...ALBUM, album: 'TEAM BABY', creator: '검정치마' }]);
    typeCreator('검정치마');
    await settle();
    expect(searchMusic).toHaveBeenCalledWith('검정치마', expect.anything(), 'artist'); // 가수 칸만이면 그 가수의 앨범·싱글 목록
    $('creatorList').querySelector('.ac-item.rich').click();
    expect($('fCreator').value).toBe('검정치마');
    expect($('fTitle').value).toBe('');
    expect($('photoPreview').getAttribute('src')).toBe(ALBUM.cover);
  });

});

describe('영화·애니 탭', () => {
  const SHINSEKAI = { id: 30991, media: 'tv', title: '신세계에서', original_title: '新世界より', year: '2012', cover: 'https://image.tmdb.org/t/p/w342/a.jpg' };

  it('애니: 제목으로 TMDB를 찾고 원제·연도·TV판 여부를 보여줌', async () => {
    modal.openAdd('anime');
    $('manualBtn').click();
    searchScreen.mockResolvedValue([SHINSEKAI]);
    typeTitle('신세계');
    await settle();
    expect(searchScreen).toHaveBeenCalledWith('신세계', 'anime');
    const item = $('titleList').querySelector('.ac-item.rich');
    expect(item.querySelector('.ac-meta').textContent).toBe('新世界より · 2012 · TV');
    expect($('titleList').querySelector('.ac-foot').textContent).toContain('정보 제공: TMDB');
  });

  it('고르면 포스터를 채우고, 감독은 따로 물어봐서 빈 칸에 채움', async () => {
    modal.openAdd('anime');
    $('manualBtn').click();
    searchScreen.mockResolvedValue([SHINSEKAI]);
    fetchScreenCreator.mockResolvedValue('이시하마 마사시');
    typeTitle('신세계');
    await settle();
    $('titleList').querySelector('.ac-item.rich').click();
    expect($('fTitle').value).toBe('신세계에서');
    expect($('photoPreview').getAttribute('src')).toBe(SHINSEKAI.cover);
    await settle();
    expect(fetchScreenCreator).toHaveBeenCalledWith('tv', 30991);
    expect($('fCreator').value).toBe('이시하마 마사시');
  });

  it('고르기 전에 쓴 감독은 고른 작품의 감독으로 바뀜', async () => {
    modal.openAdd('movie');
    $('manualBtn').click();
    searchScreen.mockResolvedValue([{ ...SHINSEKAI, media: 'movie', title: '기생충', original_title: '' }]);
    fetchScreenCreator.mockResolvedValue('봉준호');
    typeTitle('기생충');
    await settle();
    $('fCreator').value = '틀린 감독';
    $('titleList').querySelector('.ac-item.rich').click();
    await settle();
    expect($('fCreator').value).toBe('봉준호');
  });

  it('고른 뒤 감독 답이 오기 전에 감독 칸을 고치면 늦게 온 답으로 안 덮음', async () => {
    modal.openAdd('movie');
    $('manualBtn').click();
    searchScreen.mockResolvedValue([{ ...SHINSEKAI, media: 'movie', title: '기생충', original_title: '' }]);
    let answer;
    fetchScreenCreator.mockReturnValue(new Promise((r) => { answer = r; }));
    typeTitle('기생충');
    await settle();
    $('titleList').querySelector('.ac-item.rich').click();
    $('fCreator').value = '내가 고친 감독';
    $('fCreator').dispatchEvent(new Event('input'));
    answer('봉준호');
    await settle();
    expect($('fCreator').value).toBe('내가 고친 감독');
  });

  it('직접 올린 사진은 안 바꾸고, 검색으로 가져온 표지는 새 선택으로 바꿈', async () => {
    modal.openEdit({ id: 1, cat: 'movie', title: '기생충', creator: '', memo: '', rating: 0,
      photo_url: 'https://mysite-photos-ddonni.s3.ap-northeast-2.amazonaws.com/records/mine.jpg' });
    searchScreen.mockResolvedValue([{ ...SHINSEKAI, media: 'movie', title: '기생충', original_title: '' }]);
    fetchScreenCreator.mockResolvedValue('봉준호');
    typeTitle('기생충');
    await settle();
    $('titleList').querySelector('.ac-item.rich').click();
    expect($('photoPreview').getAttribute('src')).toContain('records/mine.jpg');

    modal.openEdit({ id: 2, cat: 'movie', title: '옥자', creator: '', memo: '', rating: 0,
      photo_url: 'https://image.tmdb.org/t/p/w342/old.jpg' });
    typeTitle('기생충');
    await settle();
    $('titleList').querySelector('.ac-item.rich').click();
    expect($('photoPreview').getAttribute('src')).toBe(SHINSEKAI.cover);
  });

  const PARASITE = { id: 496243, media: 'movie', title: '기생충', original_title: '', year: '2019', cover: 'https://image.tmdb.org/t/p/w342/p.jpg', creator: '봉준호' };
  const OKJA = { ...PARASITE, id: 387426, title: '옥자', year: '2017' };

  it('감독 칸: 감독의 연출작을 찾고, 고르면 제목·포스터(감독은 따로 안 물음)', async () => {
    modal.openAdd('movie');
    $('manualBtn').click();
    searchScreen.mockResolvedValue([PARASITE, OKJA]);
    $('fCreator').value = '봉준호';
    $('fCreator').dispatchEvent(new Event('input'));
    await settle();
    expect(searchScreen).toHaveBeenCalledWith('봉준호', 'movie', expect.anything(), 'director');
    $('creatorList').querySelectorAll('.ac-item.rich')[1].click();
    expect($('fTitle').value).toBe('옥자');
    expect($('fCreator').value).toBe('봉준호');
    await settle();
    expect(fetchScreenCreator).not.toHaveBeenCalled();
  });

  it('제목 칸은 감독 칸 값을 안 붙이고, 감독으로 찾은 작품은 감독을 따로 안 물음', async () => {
    modal.openAdd('movie');
    $('manualBtn').click();
    searchScreen.mockImplementation((q, kind, signal, by) => Promise.resolve(by === 'director' ? [] : [{ ...PARASITE, creator: '' }]));
    fetchScreenCreator.mockResolvedValue('봉준호');
    $('fCreator').value = '틀린 감독';
    typeTitle('기생');
    await settle();
    expect(searchScreen.mock.calls.map((c) => [c[0], c[3]])).toEqual([['기생', 'director'], ['기생', undefined]]);
    $('titleList').querySelector('.ac-item.rich').click();
    await settle();
    expect($('fCreator').value).toBe('봉준호');
  });
});

describe('책 탭', () => {
  it('결과 없음 문구에 가수 요령은 안 붙음', async () => {
    modal.openAdd('book');
    $('manualBtn').click();
    searchBooks.mockResolvedValue([]);
    typeTitle('없는책');
    await settle();
    expect($('titleList').querySelector('.ac-message').textContent).toBe("'없는책' 검색 결과가 없어요.");
  });
});

describe('카테고리 탭 바꾸기', () => {
  const BOOK = { title: '괴물', full_title: '괴물', creator: '책작가', publisher: '', year: '', cover: 'https://t1.daumcdn.net/lbook/x' };
  const tab = (key) => $('catTabs').querySelector(`[data-key="${key}"]`).click();

  async function pickBook() {
    modal.openAdd('book');
    $('manualBtn').click();
    searchBooks.mockResolvedValue([BOOK]);
    typeTitle('괴물');
    await settle();
    $('titleList').querySelector('.ac-item').click();
    expect($('fCreator').value).toBe('책작가');
    expect($('photoPreview').style.display).toBe('block');
  }

  it('검색 결과로 채운 작가·표지는 지우고, 제목은 남겨서 새 탭에서 다시 찾음', async () => {
    await pickBook();
    searchScreen.mockResolvedValue([]);
    tab('movie');
    expect($('fTitle').value).toBe('괴물');
    expect($('fCreator').value).toBe('');
    expect($('photoPreview').style.display).toBe('none');
    await settle();
    expect(searchScreen).toHaveBeenCalledWith('괴물', 'movie');
  });

  it('채운 뒤 직접 고친 작가는 남김', async () => {
    await pickBook();
    $('fCreator').value = '봉준호';
    $('fCreator').dispatchEvent(new Event('input'));
    searchScreen.mockResolvedValue([]);
    tab('movie');
    expect($('fCreator').value).toBe('봉준호');
  });

  it('직접 쓴 제목·작가는 그대로', () => {
    modal.openAdd('book');
    $('manualBtn').click();
    $('fTitle').value = '괴물';
    $('fCreator').value = '봉준호';
    tab('movie');
    expect($('fTitle').value).toBe('괴물');
    expect($('fCreator').value).toBe('봉준호');
  });
});

describe('카테고리 탭 바꾸기 — 제목', () => {
  it('작가 칸 검색 결과를 골라 채운 제목은 지움', async () => {
    modal.openAdd('book');
    $('manualBtn').click();
    searchBooks.mockResolvedValue([{ title: '책제목', full_title: '책제목', creator: '봉준호', publisher: '', year: '', cover: '' }]);
    $('fCreator').value = '봉준호';
    $('fCreator').dispatchEvent(new Event('input'));
    await settle();
    $('creatorList').querySelector('.ac-item').click();
    expect($('fTitle').value).toBe('책제목');
    searchScreen.mockResolvedValue([]);
    $('catTabs').querySelector('[data-key="movie"]').click();
    expect($('fTitle').value).toBe('');
    expect($('fCreator').value).toBe('봉준호'); // 작가 칸은 직접 쓴 값
  });
});

describe('검색 화면(새 기록)', () => {
  const PARASITE = { id: 9, media: 'movie', title: '기생충', cover: 'https://image.tmdb.org/p.jpg' };
  function searchFor(q) {
    $('sQuery').value = q;
    $('sQuery').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  }

  beforeEach(() => {
    modal.openAdd('movie');
    searchScreen.mockImplementation((q, cat, signal, by) => Promise.resolve(by === 'director' ? [] : [PARASITE]));
    fetchScreenCreator.mockResolvedValue('봉준호');
  });

  it('치는 것만으로는 안 찾고 검색 버튼(Enter)을 눌러야 — 한 글자 제목도 찾음', async () => {
    $('sQuery').value = '괴';
    $('sQuery').dispatchEvent(new Event('input'));
    await settle();
    expect(searchScreen).not.toHaveBeenCalled();
    $('sBtn').click();
    await settle();
    expect(searchScreen).toHaveBeenCalledWith('괴', 'movie');
  });

  it('새 기록은 검색 화면부터, 입력 칸은 숨김', () => {
    expect($('searchView').hidden).toBe(false);
    expect($('formView').hidden).toBe(true);
  });

  it('결과를 누르면 값이 채워진 입력 칸 — 저장하면 검색 화면으로 돌아오고 결과는 그대로', async () => {
    saveRecord.mockResolvedValue({ id: 41 });
    searchFor('기생충');
    await settle();
    $('sResults').querySelector('.si-main').click();
    await settle();
    expect($('formView').hidden).toBe(false);
    expect($('fTitle').value).toBe('기생충');
    expect($('fCreator').value).toBe('봉준호');
    $('fMemo').value = '계단';
    $('saveBtn').click();
    await settle();
    expect(saveRecord).toHaveBeenCalledWith(expect.objectContaining({ cat: 'movie', title: '기생충', creator: '봉준호', memo: '계단' }), null);
    expect(onSaved).toHaveBeenCalled();
    expect($('searchView').hidden).toBe(false);
    expect($('sNotice').textContent).toContain('기생충');
    expect($('sResults').querySelector('.si-add').textContent).toBe('✓ 넣음');
  });

  it('+ 넣기도 값이 채워진 입력 칸 — 별점·감상까지 쓰고 저장, ✓ 넣음을 다시 누르면 지움', async () => {
    saveRecord.mockResolvedValue({ id: 42, cat: 'movie', title: '기생충' });
    searchFor('기생충');
    await settle();
    $('sResults').querySelector('.si-add').click();
    await settle();
    expect($('formView').hidden).toBe(false);
    expect($('fTitle').value).toBe('기생충');
    expect($('fCreator').value).toBe('봉준호');
    expect($('photoPreview').style.display).toBe('block');
    $('fMemo').value = '계단';
    $('saveBtn').click();
    await settle();
    expect(saveRecord).toHaveBeenCalledWith(expect.objectContaining({ title: '기생충', memo: '계단' }), null);
    const btn = $('sResults').querySelector('.si-add');
    expect(btn.textContent).toBe('✓ 넣음');
    btn.click();
    await settle();
    expect(deleteRecord).toHaveBeenCalledWith(42);
    expect($('sResults').querySelector('.si-add').textContent).toBe('+ 넣기');
  });

  it('직접 쓰기는 검색어를 제목으로 채운 입력 칸, 취소하면 검색 화면으로', async () => {
    $('sQuery').value = '우리 동네 독립영화';
    $('manualBtn').click();
    expect($('formView').hidden).toBe(false);
    expect($('fTitle').value).toBe('우리 동네 독립영화');
    $('cancelBtn').click();
    expect($('searchView').hidden).toBe(false);
    expect($('overlay').classList.contains('open')).toBe(true);
  });

  it('음악 노래 목록에서 고르면 유튜브 링크가 채워지고 같이 저장됨', async () => {
    const LINK = 'https://www.youtube.com/playlist?list=OLAK5uy_x&index=2';
    modal.openAdd('music');
    expect($('listenField').hidden).toBe(false);
    searchMusic.mockImplementation((q, signal, by) => Promise.resolve(by === 'songs'
      ? [{ album: 'TEAM BABY', song: '나랑 아니면', creator: '검정치마', kind: '노래', year: '', cover: null, listen: LINK, album_id: 'A1' }]
      : [{ album: 'TEAM BABY', song: null, creator: '검정치마', kind: '앨범', year: '', cover: null, album_id: 'A1' }]));
    searchFor('검정치마');
    await settle();
    $('sResults').querySelector('.si-main').click();
    expect($('fListen').value).toBe(LINK);
    $('listenTry').click();
    expect(play).toHaveBeenCalledWith(expect.objectContaining({ title: '나랑 아니면', listen_url: LINK }));
    $('saveBtn').click();
    await settle();
    expect(saveRecord).toHaveBeenCalledWith(expect.objectContaining({ cat: 'music', title: '나랑 아니면', listen_url: LINK }), null);
  });

  it('음악 앨범 줄을 고르면 그 앨범에서 노래 링크를 물어봄', async () => {
    modal.openAdd('music');
    searchMusic.mockImplementation((q, signal, by) => Promise.resolve(by === 'songs'
      ? []
      : [{ album: '넋두리', song: null, creator: '닐로', kind: '싱글', year: '', cover: null, album_id: 'MPREb_n' }]));
    fetchMusicListen.mockResolvedValue('https://www.youtube.com/playlist?list=OLAK_n&index=1');
    searchFor('넋두리');
    await settle();
    $('sResults').querySelector('.si-main').click();
    await settle();
    expect(fetchMusicListen).toHaveBeenCalledWith('MPREb_n', '넋두리');
    expect($('fListen').value).toBe('https://www.youtube.com/playlist?list=OLAK_n&index=1');
  });

  it('유튜브가 아닌 링크는 저장하지 않고 알려줌, https 없이 쓴 건 붙여서 저장', async () => {
    modal.openAdd('music');
    $('manualBtn').click();
    $('fTitle').value = '넋두리';
    $('fListen').value = 'https://evil.example/x';
    $('saveBtn').click();
    await settle();
    expect(saveRecord).not.toHaveBeenCalled();
    expect($('listenError').style.display).toBe('block');
    $('fListen').value = 'youtu.be/6Evs8LO4TeA';
    $('saveBtn').click();
    await settle();
    expect(saveRecord).toHaveBeenCalledWith(expect.objectContaining({ listen_url: 'https://youtu.be/6Evs8LO4TeA' }), null);
  });

  it('음악이 아니면 링크 칸이 숨고 링크는 없음으로 저장', async () => {
    expect($('listenField').hidden).toBe(true);
    $('manualBtn').click();
    $('fTitle').value = '괴물';
    $('saveBtn').click();
    await settle();
    expect(saveRecord).toHaveBeenCalledWith(expect.objectContaining({ cat: 'movie', listen_url: null }), null);
  });

  it('수정하면 저장된 링크가 칸에 들어 있음', () => {
    modal.openEdit({ id: 5, cat: 'music', title: '넋두리', creator: '닐로', memo: '', rating: 0, photo_url: null,
      listen_url: 'https://youtu.be/6Evs8LO4TeA' });
    expect($('listenField').hidden).toBe(false);
    expect($('fListen').value).toBe('https://youtu.be/6Evs8LO4TeA');
  });

  it('수정은 입력 칸만, 취소하면 창을 닫음', () => {
    modal.openEdit({ id: 3, cat: 'book', title: '데미안', creator: '헤세', memo: '', rating: 4, photo_url: null });
    expect($('formView').hidden).toBe(false);
    expect($('searchView').hidden).toBe(true);
    $('cancelBtn').click();
    expect($('overlay').classList.contains('open')).toBe(false);
  });
});

describe('옷장 탭', () => {
  const chip = (group, key) => $('wardrobeField').querySelector(`[data-group="${group}"] [data-key="${key}"]`);

  it('검색 화면 없이 바로 입력 칸 — 별점 대신 종류·색·계절, 칸 이름도 바뀜', () => {
    modal.openAdd('wardrobe');
    expect($('formView').hidden).toBe(false);
    expect($('searchView').hidden).toBe(true);
    expect($('starField').hidden).toBe(true);
    expect($('wardrobeField').hidden).toBe(false);
    expect($('titleLabel').textContent).toBe('옷 이름');
    expect($('creatorLabel').textContent).toBe('브랜드 (선택)');
    expect($('memoLabel').textContent).toBe('메모 (선택)');
  });

  it('고른 칸을 attrs로 저장하고 별점은 0 — 종류·색은 다시 누르면 해제', async () => {
    saveRecord.mockResolvedValue({ id: 9 });
    modal.openAdd('wardrobe');
    $('fTitle').value = '흰 셔츠';
    $('fCreator').value = '유니클로';
    chip('kind', 'outer').click();
    chip('kind', 'top').click();
    chip('color', 'navy').click();
    chip('color', 'navy').click();
    chip('color', 'white').click();
    chip('seasons', 'spring').click();
    chip('seasons', 'fall').click();
    $('saveBtn').click();
    await settle();
    expect(saveRecord).toHaveBeenCalledWith(expect.objectContaining({
      cat: 'wardrobe', title: '흰 셔츠', creator: '유니클로', rating: 0,
      attrs: { kind: 'top', color: 'white', seasons: ['spring', 'fall'] },
    }), null);
  });

  it('수정하면 저장된 칸이 켜져 있음, 다른 카테고리는 attrs 없이', async () => {
    modal.openEdit({ id: 3, cat: 'wardrobe', title: '코트', attrs: { kind: 'outer', color: 'black', seasons: ['winter'] } });
    expect(chip('kind', 'outer').getAttribute('aria-pressed')).toBe('true');
    expect(chip('seasons', 'winter').getAttribute('aria-pressed')).toBe('true');
    expect(chip('seasons', 'summer').getAttribute('aria-pressed')).toBe('false');
    saveRecord.mockResolvedValue({ id: 4 });
    modal.openEdit({ id: 4, cat: 'book', title: '데미안' });
    $('saveBtn').click();
    await settle();
    expect(saveRecord).toHaveBeenLastCalledWith(expect.objectContaining({ cat: 'book', attrs: null }), 4);
  });
});
