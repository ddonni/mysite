// presetAutocomplete.js — 검색 결과 후보(card)가 표지·설명과 함께 그려지고, 고르면
// onPick으로 그 후보를 넘기는지. footer가 후보에 따라 붙는지.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../js/shared/config.js', () => ({
  API_BASE: 'http://api.test',
  GOOGLE_CLIENT_ID: '',
  DEVELOPER_ROOM_CODE: '',
}));

const { createPresetAutocomplete } = await import('../../../js/library/modal/presetAutocomplete.js');

const KAKAO_COVER = 'https://t1.daumcdn.net/lbook/image/540810';
const DEMIAN = {
  value: '데미안',
  mine: false,
  card: { title: '데미안(양장본)', meta: '헤르만 헤세 · 민음사 · 2009', cover: KAKAO_COVER },
  pick: { creator: '헤르만 헤세', cover: KAKAO_COVER },
  source: 'book',
};
const YTM_COVER = 'https://yt3.googleusercontent.com/abc=w544-h544';
const BAMYANGGANG = {
  value: '밤양갱',
  card: { title: '밤양갱', meta: '비비 (BIBI) · 싱글', cover: YTM_COVER, square: true },
  pick: { creator: '비비 (BIBI)', cover: YTM_COVER },
  source: 'music',
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
    footer: (items) => (items.some((s) => s.source === 'book') ? '책 정보 제공: Kakao' : ''),
    ...opts,
  });
}

function type(value) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('검색 결과 후보(card)', () => {
  it('표지(카카오는 중계 주소)·제목·설명 한 줄을 그림', async () => {
    setup([DEMIAN]);
    type('데미');
    await settle();
    const item = listEl.querySelector('.preset-item.rich');
    expect(item.querySelector('.preset-title').textContent).toBe('데미안(양장본)');
    expect(item.querySelector('.preset-meta').textContent).toBe('헤르만 헤세 · 민음사 · 2009');
    expect(item.querySelector('img.preset-cover').getAttribute('src'))
      .toBe('http://api.test/api/cover?url=' + encodeURIComponent(KAKAO_COVER));
    expect(listEl.querySelector('.preset-foot').textContent).toBe('책 정보 제공: Kakao');
  });

  it('앨범 커버는 정사각형, 유튜브 커버 주소는 그대로', async () => {
    setup([BAMYANGGANG]);
    type('밤양');
    await settle();
    const img = listEl.querySelector('img.preset-cover');
    expect(img.classList.contains('square')).toBe(true);
    expect(img.getAttribute('src')).toBe(YTM_COVER);
  });

  it('고르면 입력칸엔 후보의 value, onPick엔 후보 전체', async () => {
    const onPick = vi.fn();
    setup([DEMIAN], { onPick });
    type('데미');
    await settle();
    listEl.querySelector('.preset-item.rich').click();
    expect(input.value).toBe('데미안');
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ pick: DEMIAN.pick }));
    expect(listEl.style.display).toBe('none');
  });

  it('제목에 HTML이 섞여 있어도 글자 그대로 보여줌', async () => {
    setup([{ ...DEMIAN, card: { ...DEMIAN.card, title: '<img src=x onerror=alert(1)>' } }]);
    type('xx');
    await settle();
    expect(listEl.querySelector('.preset-title').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(listEl.querySelectorAll('img').length).toBe(1); // 표지 하나뿐
  });

  it('검색 결과가 없으면 footer도 없음', async () => {
    setup([{ value: '데미안', mine: true }]);
    type('데미');
    await settle();
    expect(listEl.querySelector('.preset-item.rich')).toBeNull();
    expect(listEl.querySelector('.preset-mine').textContent).toBe('이미 기록함');
    expect(listEl.querySelector('.preset-foot')).toBeNull();
  });
});
