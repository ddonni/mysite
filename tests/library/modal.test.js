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
vi.mock('../../js/library/records.js', () => ({
  CATS: [
    { key: 'book', label: '책' }, { key: 'anime', label: '애니' },
    { key: 'movie', label: '영화' }, { key: 'music', label: '음악' },
  ],
  PRESETS: {},
  uploadPhoto: vi.fn(),
  saveRecord: vi.fn(),
  fetchSuggestions: () => Promise.resolve([]),
  searchBooks: (...a) => searchBooks(...a),
  searchMusic: (...a) => searchMusic(...a),
}));

const { createModal } = await import('../../js/library/modal.js');

const ALBUM = { album: 'LEGEND(전설)', song: null, creator: 'JANNABI', kind: '앨범', year: '', cover: 'https://yt3.googleusercontent.com/x' };

function mountDom() {
  document.body.innerHTML = `
    <div id="overlay"><h2 id="modalTitle"></h2><div id="catTabs"></div>
      <input id="fTitle"><input id="fCreator"><label id="creatorLabel"></label>
      <div id="presetList" style="display:none"></div><div id="creatorList" style="display:none"></div>
      <div id="titleError"></div><div id="starPicker"></div>
      <div id="photoDrop"><span id="photoDropText"></span><input type="file" id="fPhoto"></div>
      <img id="photoPreview"><span id="removePhoto"></span>
      <textarea id="fMemo"></textarea><button id="cancelBtn"></button><button id="saveBtn"></button>
    </div>`;
}

const settle = () => new Promise((r) => setTimeout(r, 250));
const $ = (id) => document.getElementById(id);

function typeTitle(v) {
  $('fTitle').value = v;
  $('fTitle').dispatchEvent(new Event('input'));
}

let modal;
beforeEach(() => {
  searchMusic.mockReset();
  searchBooks.mockReset();
  mountDom();
  modal = createModal({ onSaved: () => {} });
  modal.openAdd('music');
});

describe('음악 탭 제목 검색', () => {
  it('직접 쓴 가수는 "가수 제목"으로 검색', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    $('fCreator').value = '잔나비';
    typeTitle('주저하는 연인들을 위해');
    await settle();
    expect(searchMusic).toHaveBeenCalledWith('잔나비 주저하는 연인들을 위해', expect.anything());
    expect($('presetList').querySelector('.preset-title').textContent).toBe('LEGEND(전설)');
  });

  it('가수를 붙여서 0건이면 제목만으로 다시 찾고 맨 위에 알려줌', async () => {
    searchMusic.mockImplementation((q) => Promise.resolve(q.startsWith('엉뚱 ') ? [] : [ALBUM]));
    $('fCreator').value = '엉뚱';
    typeTitle('주저하는 연인들을 위해');
    await settle();
    expect(searchMusic.mock.calls.map((c) => c[0])).toEqual(['엉뚱 주저하는 연인들을 위해', '주저하는 연인들을 위해']);
    expect($('presetList').querySelector('.preset-head').textContent).toBe("'엉뚱'까지 넣으면 결과가 없어 제목만으로 찾았어요");
  });

  it('앞서 고른 결과로 자동으로 채워진 가수는 다음 검색에 안 씀', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    typeTitle('주저하는 연인들을 위해');
    await settle();
    $('presetList').querySelector('.preset-item.rich').click();
    expect($('fCreator').value).toBe('JANNABI');
    expect($('fTitle').value).toBe('주저하는 연인들을 위해'); // 제목은 입력한 그대로

    typeTitle('밤양갱');
    await settle();
    expect(searchMusic).toHaveBeenLastCalledWith('밤양갱', expect.anything());
  });

  it('자동으로 채워진 가수도 한 번 손대면 직접 쓴 것 — 같은 글자로 되돌려도', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    typeTitle('주저하는 연인들을 위해');
    await settle();
    $('presetList').querySelector('.preset-item.rich').click();
    expect($('fCreator').value).toBe('JANNABI');

    // 한 글자 지웠다가 다시 써서 원래 값으로 되돌림
    $('fCreator').value = 'JANNAB';
    $('fCreator').dispatchEvent(new Event('input'));
    $('fCreator').value = 'JANNABI';
    $('fCreator').dispatchEvent(new Event('input'));

    typeTitle('뜨거운 여름밤은 가고 남은 건 볼품없지만');
    await settle();
    expect(searchMusic).toHaveBeenLastCalledWith('JANNABI 뜨거운 여름밤은 가고 남은 건 볼품없지만', expect.anything());

    // 다른 결과를 골라도 직접 손댄 가수는 그대로
    searchMusic.mockResolvedValue([{ ...ALBUM, creator: '다른 가수' }]);
    typeTitle('밤양갱');
    await settle();
    $('presetList').querySelector('.preset-item.rich').click();
    expect($('fCreator').value).toBe('JANNABI');
  });

  it('결과가 없으면 검색어와 함께 알려줌', async () => {
    searchMusic.mockResolvedValue([]);
    typeTitle('없는노래');
    await settle();
    expect($('presetList').querySelector('.preset-message').textContent).toBe("'없는노래' 검색 결과가 없어요. 가수를 함께 써 보세요.");
  });

  it('검색이 실패하면 결과 없음과 다르게 알려줌', async () => {
    searchMusic.mockRejectedValue(new Error('music search failed'));
    typeTitle('밤양갱');
    await settle();
    expect($('presetList').querySelector('.preset-message').textContent).toBe('지금은 검색할 수 없어요. 직접 입력해 주세요.');
  });
});

describe('두 칸의 목록', () => {
  it('제목 결과가 뜬 채로 작가 칸을 눌러도 안 닫히고, 작가 칸에 입력하면 닫힘', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    typeTitle('주저하는 연인들을 위해');
    await settle();
    expect($('presetList').style.display).toBe('block');

    $('fCreator').click();
    expect($('presetList').style.display).toBe('block');

    $('fCreator').value = '잔';
    $('fCreator').dispatchEvent(new Event('input'));
    expect($('presetList').style.display).toBe('none');
  });

  it('작가 칸에 값이 있어도, 제목 결과가 열려 있으면 포커스만으로 덮지 않음', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    typeTitle('주저하는 연인들을 위해');
    await settle();
    $('presetList').querySelector('.preset-item.rich').click(); // 가수 JANNABI 자동 채움
    typeTitle('LEGEND');
    await settle();
    const calls = searchMusic.mock.calls.length;

    $('fCreator').dispatchEvent(new Event('focus'));
    await settle();
    expect($('presetList').style.display).toBe('block');
    expect($('creatorList').style.display).toBe('none');
    expect(searchMusic.mock.calls.length).toBe(calls); // 작가 검색이 안 나감
  });

  it('두 칸 바깥을 누르면 닫힘', async () => {
    searchMusic.mockResolvedValue([ALBUM]);
    typeTitle('주저하는 연인들을 위해');
    await settle();
    $('fMemo').click();
    expect($('presetList').style.display).toBe('none');
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
    searchBooks.mockResolvedValue([HAN]);
    typeCreator('한강');
    await settle();
    expect(searchBooks).toHaveBeenCalledWith('한강', expect.anything(), 'author');
    $('creatorList').querySelector('.preset-item.rich').click();
    expect($('fCreator').value).toBe('한강');
    expect($('fTitle').value).toBe('소년이 온다');
    expect($('photoPreview').getAttribute('src')).toContain('/api/cover?url=');
  });

  it('책: 이미 쓴 제목은 덮어쓰지 않음', async () => {
    modal.openAdd('book');
    searchBooks.mockResolvedValue([HAN]);
    typeTitle('채식주의자');
    $('fTitle').dispatchEvent(new Event('input'));
    typeCreator('한강');
    await settle();
    $('creatorList').querySelector('.preset-item.rich').click();
    expect($('fTitle').value).toBe('채식주의자');
  });

  it('책: 제목 칸에 직접 쓴 제목이 있으면 "제목 작가"로 합쳐 찾음', async () => {
    modal.openAdd('book');
    searchBooks.mockResolvedValue([HAN]);
    typeTitle('소년이 온다');
    await settle();
    typeCreator('한강');
    await settle();
    expect(searchBooks).toHaveBeenLastCalledWith('소년이 온다 한강', expect.anything());
  });

  it('책: 제목 칸 검색도 작가 칸에 직접 쓴 작가가 있으면 합쳐 찾음', async () => {
    modal.openAdd('book');
    searchBooks.mockResolvedValue([HAN]);
    typeCreator('한강');
    await settle();
    typeTitle('소년이 온다');
    await settle();
    expect(searchBooks).toHaveBeenLastCalledWith('소년이 온다 한강', expect.anything());
  });

  it('책: 합쳐서 0건이면 작가 이름만으로 다시 찾고 맨 위에 알림', async () => {
    modal.openAdd('book');
    searchBooks.mockImplementation((q, signal, by) => Promise.resolve(by === 'author' ? [HAN] : []));
    typeTitle('없는 제목');
    await settle();
    typeCreator('한강');
    await settle();
    expect(searchBooks.mock.calls.slice(-2).map((c) => [c[0], c[2]])).toEqual([['없는 제목 한강', undefined], ['한강', 'author']]);
    expect($('creatorList').querySelector('.preset-head').textContent).toBe("'없는 제목'까지 넣으면 결과가 없어 이름만으로 찾았어요");
  });

  it('음악: 가수로 찾은 앨범을 고르면 가수·커버만, 제목 칸은 그대로 비워 둠', async () => {
    searchMusic.mockResolvedValue([{ ...ALBUM, album: 'TEAM BABY', creator: '검정치마' }]);
    typeCreator('검정치마');
    await settle();
    expect(searchMusic).toHaveBeenCalledWith('검정치마', expect.anything());
    $('creatorList').querySelector('.preset-item.rich').click();
    expect($('fCreator').value).toBe('검정치마');
    expect($('fTitle').value).toBe('');
    expect($('photoPreview').getAttribute('src')).toBe(ALBUM.cover);
  });

  it('음악: 가수 칸에서 고른 이름은 직접 쓴 가수로 — 다음 제목 검색에 들어감', async () => {
    searchMusic.mockResolvedValue([{ ...ALBUM, creator: '검정치마' }]);
    typeCreator('검정');
    await settle();
    $('creatorList').querySelector('.preset-item.rich').click();
    typeTitle('Everything');
    await settle();
    expect(searchMusic).toHaveBeenLastCalledWith('검정치마 Everything', expect.anything());
  });
});

describe('책 탭', () => {
  it('결과 없음 문구에 가수 요령은 안 붙음', async () => {
    modal.openAdd('book');
    searchBooks.mockResolvedValue([]);
    typeTitle('없는책');
    await settle();
    expect($('presetList').querySelector('.preset-message').textContent).toBe("'없는책' 검색 결과가 없어요.");
  });
});
