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
    expect($('presetList').querySelector('.preset-head').textContent).toBe("'엉뚱'(으)로는 결과가 없어 제목만으로 찾았어요");
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

describe('책 탭', () => {
  it('결과 없음 문구에 가수 요령은 안 붙음', async () => {
    modal.openAdd('book');
    searchBooks.mockResolvedValue([]);
    typeTitle('없는책');
    await settle();
    expect($('presetList').querySelector('.preset-message').textContent).toBe("'없는책' 검색 결과가 없어요.");
  });
});
