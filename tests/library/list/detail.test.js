// 상세 창의 "턴테이블에 올리기/내리기" 버튼 — 음악에만, 그리고 상황에 맞는
// 글자로 뜨는지, 누르면 onPlay가 올바른 값으로 불리는지.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDetail } from '../../../js/library/list/detail.js';

let onPlay;
let detail;

beforeEach(() => {
  document.body.innerHTML = '<div id="d" hidden><div class="detail-card"></div></div>';
  onPlay = vi.fn();
  detail = createDetail(document.getElementById('d'), {
    onEdit: () => {}, onDelete: () => {}, onFeature: () => {}, onPlay, readOnly: false,
  });
});

const playBtn = () => document.querySelector('[data-act="play"]');
const song = (extra) => ({ id: 1, cat: 'music', title: '노래', rating: 0, ...extra });

describe('턴테이블 버튼', () => {
  it('턴테이블에 없는 곡엔 "올리기" — 누르면 onPlay(곡, true)', () => {
    const it_ = song();
    detail.open(it_, { playing: false });
    expect(playBtn().textContent).toBe('턴테이블에 올리기');
    playBtn().click();
    expect(onPlay).toHaveBeenCalledWith(it_, true);
  });

  it('직접 올린 곡엔 "내리기" — 누르면 onPlay(곡, false)', () => {
    const it_ = song({ playing: true });
    detail.open(it_, { playing: true });
    expect(playBtn().textContent).toBe('턴테이블에서 내리기');
    playBtn().click();
    expect(onPlay).toHaveBeenCalledWith(it_, false);
  });

  it('기본 규칙으로 이미 돌고 있는 곡엔 버튼 없음', () => {
    detail.open(song(), { playing: true });
    expect(playBtn()).toBeNull();
  });

  it('음악이 아니면 버튼 없음', () => {
    detail.open({ id: 2, cat: 'book', title: '책', rating: 0 }, { playing: false });
    expect(playBtn()).toBeNull();
  });
});
