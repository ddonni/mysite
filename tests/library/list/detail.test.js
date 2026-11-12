// 상세 창(카드 뒷면의 "자세히") — 내 방이면 수정하기·인생작·삭제 버튼이 뜨고 삭제는 한 번
// 더 묻는지, 유튜브 링크가 있는 음악엔 "▶ 듣기"가 뜨는지.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDetail } from '../../../js/library/list/detail.js';

let onDelete;
let detail;

beforeEach(() => {
  document.body.innerHTML = '<div id="d" hidden><div class="detail-card"></div></div>';
  onDelete = vi.fn();
  detail = createDetail(document.getElementById('d'), {
    onEdit: () => {}, onDelete, onFeature: () => {}, readOnly: false,
  });
});

const song = (extra) => ({ id: 1, cat: 'music', title: '노래', rating: 0, ...extra });

describe('내 방 버튼', () => {
  it('수정하기·인생작·삭제만 — 턴테이블 버튼은 없음(3D 방이 없어짐)', () => {
    detail.open(song());
    const acts = [...document.querySelectorAll('.detail-actions [data-act]')].map((b) => b.dataset.act);
    expect(acts).toEqual(['edit', 'feature', 'delete']);
  });

  it('삭제는 한 번 더 묻고, "예, 삭제"를 눌러야 onDelete(id)', () => {
    detail.open(song());
    document.querySelector('[data-act="delete"]').click();
    expect(onDelete).not.toHaveBeenCalled();
    document.querySelector('[data-act="confirm-delete"]').click();
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});

describe('듣기 버튼', () => {
  const listenBtn = () => document.querySelector('[data-act="listen"]');

  it('유튜브 링크가 있는 음악엔 "▶ 듣기" — 누르면 창을 닫고 onListen(곡)', () => {
    const onListen = vi.fn();
    const d = createDetail(document.getElementById('d'), { onListen, readOnly: true });
    const it_ = song({ listen_url: 'https://youtu.be/6Evs8LO4TeA' });
    d.open(it_);
    listenBtn().click();
    expect(onListen).toHaveBeenCalledWith(it_);
    expect(document.getElementById('d').hidden).toBe(true);
  });

  it('링크가 없으면 버튼 없음', () => {
    const d = createDetail(document.getElementById('d'), { onListen: vi.fn(), readOnly: true });
    d.open(song());
    expect(listenBtn()).toBeNull();
  });
});
