// presetAutocomplete.js — 책 검색 결과 후보가 표지·정보와 함께 그려지고, 고르면
// onPick으로 그 후보를 넘기는지. 출처 표기(footer)가 책 결과가 있을 때만 붙는지.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../js/shared/config.js', () => ({
  API_BASE: 'http://api.test',
  GOOGLE_CLIENT_ID: '',
  DEVELOPER_ROOM_CODE: '',
}));

const { createPresetAutocomplete } = await import('../../../js/library/modal/presetAutocomplete.js');

const DEMIAN = {
  title: '데미안',
  full_title: '데미안(양장본)',
  creator: '헤르만 헤세',
  publisher: '민음사',
  year: '2009',
  cover: 'https://t1.daumcdn.net/lbook/image/540810',
};

let input;
let listEl;

beforeEach(() => {
  document.body.innerHTML = '<input id="t"><div id="l" style="display:none"></div>';
  input = document.getElementById('t');
  listEl = document.getElementById('l');
});

// 디바운스(180ms) 뒤 서버 후보가 그려질 때까지 기다림.
const settle = () => new Promise((r) => setTimeout(r, 250));

function setup(server, opts = {}) {
  return createPresetAutocomplete({ input, listEl }, {
    getCat: () => 'book',
    fetchSuggestions: () => Promise.resolve(server),
    markMine: true,
    footer: (items) => (items.some((s) => s.book) ? '책 정보 제공: Kakao' : ''),
    ...opts,
  });
}

function type(value) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('책 검색 결과 후보', () => {
  it('표지(중계 주소)·원래 제목·작가 · 출판사 · 연도를 그림', async () => {
    setup([{ value: '데미안', mine: false, book: DEMIAN }]);
    type('데미');
    await settle();
    const item = listEl.querySelector('.preset-item.book');
    expect(item.querySelector('.preset-title').textContent).toBe('데미안(양장본)');
    expect(item.querySelector('.preset-meta').textContent).toBe('헤르만 헤세 · 민음사 · 2009');
    expect(item.querySelector('img.preset-cover').getAttribute('src'))
      .toBe('http://api.test/api/cover?url=' + encodeURIComponent(DEMIAN.cover));
    expect(listEl.querySelector('.preset-foot').textContent).toBe('책 정보 제공: Kakao');
  });

  it('고르면 입력칸엔 다듬은 제목, onPick엔 후보 전체', async () => {
    const onPick = vi.fn();
    setup([{ value: '데미안', mine: false, book: DEMIAN }], { onPick });
    type('데미');
    await settle();
    listEl.querySelector('.preset-item.book').click();
    expect(input.value).toBe('데미안');
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ book: DEMIAN }));
    expect(listEl.style.display).toBe('none');
  });

  it('제목에 HTML이 섞여 있어도 글자 그대로 보여줌', async () => {
    setup([{ value: 'x', book: { ...DEMIAN, full_title: '<img src=x onerror=alert(1)>' } }]);
    type('xx');
    await settle();
    expect(listEl.querySelector('.preset-title').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(listEl.querySelectorAll('img').length).toBe(1); // 표지 하나뿐
  });

  it('책 결과가 없으면 출처 표기도 없음', async () => {
    setup([{ value: '데미안', mine: true }]);
    type('데미');
    await settle();
    expect(listEl.querySelector('.preset-item.book')).toBeNull();
    expect(listEl.querySelector('.preset-mine').textContent).toBe('이미 기록함');
    expect(listEl.querySelector('.preset-foot')).toBeNull();
  });
});
