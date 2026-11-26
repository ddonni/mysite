// 기록 카드(뒤집는 카드) — 카드를 누르면 뒤집히기만 하고, 내 기록이면 뒷면의 수정·삭제(한 번 더
// 물음)·인생작 별이 동작하는지(남의 기록엔 없음), 인생작이 황금 카드(.rare)가 되는지, 음악의 "▶ 듣기"를
// 눌러도 카드가 뒤집히지 않는지, 카드 순서(인생작 먼저 → 최신순).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderCards } from '../../../js/library/list/cardsView.js';
import { sortForGrid } from '../../../js/library/list.js';

const song = (id, extra = {}) => ({ id, cat: 'music', title: `곡${id}`, rating: 0, featured: true, ...extra });
const book = (id, extra = {}) => ({ id, cat: 'book', title: `책${id}`, rating: 4.5, ...extra });

let grid;
beforeEach(() => {
  document.body.innerHTML = '<div id="g"></div>';
  grid = document.getElementById('g');
});

const cardOf = (title) => [...grid.querySelectorAll('.card')].find((c) => c.querySelector('.card-title').textContent === title);

describe('카드 뒤집기', () => {
  it('카드를 누르면 뒤집히고(aria-pressed), 다시 누르면 앞면으로 — 수정 창은 안 뜸', () => {
    const onEdit = vi.fn();
    renderCards(grid, [book(1)], { onEdit });
    const card = cardOf('책1');
    expect(card.getAttribute('aria-pressed')).toBe('false');
    card.click();
    expect(card.getAttribute('aria-pressed')).toBe('true');
    card.click();
    expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('뒷면에 한 줄 감상 — 없으면 안내 문구', () => {
    renderCards(grid, [book(1, { memo: '좋았다' }), book(2)], {});
    expect(cardOf('책1').querySelector('.back .q').textContent).toBe('“좋았다”');
    expect(cardOf('책2').querySelector('.back .q').textContent).toBe('아직 감상을 적지 않았어요.');
  });

  it('인생작만 황금 카드(.rare + 홀로그램 빛), 뒷면 종류 옆에 인생책', () => {
    renderCards(grid, [book(1, { featured: true }), book(2)], {});
    const [rare, plain] = grid.querySelectorAll('.slot');
    expect(rare.classList.contains('rare')).toBe(true);
    expect(rare.querySelector('.cover .foil')).not.toBeNull();
    expect(rare.querySelector('.back .type').textContent).toBe('책 · 인생책');
    expect(plain.classList.contains('rare')).toBe(false);
    expect(plain.querySelector('.foil')).toBeNull();
  });

  it('비어 있으면 안내 한 줄만', () => {
    expect(renderCards(grid, [], { emptyText: '없음' })).toEqual([]);
    expect(grid.querySelector('.empty').textContent).toBe('없음');
  });
});

describe('내 기록의 뒷면 버튼', () => {
  const setup = (items, extra = {}) => {
    const cb = { onEdit: vi.fn(), onDelete: vi.fn(), onFeature: vi.fn() };
    renderCards(grid, items, { ...cb, ...extra });
    return cb;
  };

  it('"수정"은 onEdit(기록), 카드는 다시 뒤집히지 않음', () => {
    const items = [book(1)];
    const cb = setup(items);
    const card = cardOf('책1');
    card.click();
    card.querySelector('[data-act="edit"]').click();
    expect(cb.onEdit).toHaveBeenCalledWith(items[0]);
    expect(card.getAttribute('aria-pressed')).toBe('true');
  });

  it('"삭제"는 한 번 더 묻고, 확인해야 onDelete(id) — "아니요"면 버튼이 돌아옴', () => {
    const cb = setup([book(7)]);
    const card = cardOf('책7');
    card.querySelector('[data-act="delete"]').click();
    expect(cb.onDelete).not.toHaveBeenCalled();
    expect(card.querySelector('.confirm-text').textContent).toBe('삭제할까요?');
    card.querySelector('[data-act="cancel-delete"]').click();
    expect(card.querySelector('[data-act="edit"]')).not.toBeNull();
    card.querySelector('[data-act="delete"]').click();
    card.querySelector('[data-act="confirm-delete"]').click();
    expect(cb.onDelete).toHaveBeenCalledWith(7);
  });

  it('인생작 별: 채워진 별이면 인생작 — 누르면 한 번 묻고, "예"를 눌러야 onFeature(기록)', () => {
    const items = [book(1, { featured: true }), book(2)];
    const cb = setup(items);
    const [on, off] = grid.querySelectorAll('.feat-btn');
    expect(on.textContent).toBe('★');
    expect(on.getAttribute('aria-label')).toBe('인생책에서 빼기');
    expect(off.textContent).toBe('☆');
    expect(off.getAttribute('aria-label')).toBe('인생책으로');
    off.click();
    expect(cb.onFeature).not.toHaveBeenCalled();
    const card = cardOf('책2');
    expect(card.querySelector('.confirm-text').textContent).toBe('인생책으로 할까요?');
    card.querySelector('[data-act="cancel-feature"]').click();
    expect(card.querySelector('[data-act="edit"]')).not.toBeNull();
    off.click();
    card.querySelector('[data-act="confirm-feature"]').click();
    expect(cb.onFeature).toHaveBeenCalledWith(items[1]);
    on.click();
    expect(cardOf('책1').querySelector('.confirm-text').textContent).toBe('인생책에서 뺄까요?');
  });

  it('묻는 중에 카드를 다시 뒤집거나 다른 곳을 누르면 물음을 거두고 수정·삭제로 돌아감', () => {
    const cb = setup([book(1), book(2)]);
    const card = cardOf('책1');
    card.click(); // 뒤집기
    card.querySelector('[data-act="delete"]').click();
    expect(card.querySelector('.confirm-text')).not.toBeNull();
    card.click(); // 버튼이 아닌 곳 → 다시 뒤집힘
    expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(card.querySelector('.confirm-text')).toBeNull();
    expect(card.querySelector('[data-act="edit"]')).not.toBeNull();

    card.querySelector('.feat-btn').click();
    expect(card.querySelector('.confirm-text')).not.toBeNull();
    document.body.click(); // 카드 바깥
    expect(card.querySelector('.confirm-text')).toBeNull();

    card.querySelector('[data-act="delete"]').click();
    cardOf('책2').click(); // 다른 카드
    expect(card.querySelector('.confirm-text')).toBeNull();
    expect(cb.onDelete).not.toHaveBeenCalled();
  });

  it('남의 기록(readOnly)엔 수정·삭제·별이 없음', () => {
    setup([book(1)], { readOnly: true });
    expect(grid.querySelector('[data-act="edit"], [data-act="delete"], .feat-btn')).toBeNull();
  });
});

describe('음악 카드', () => {
  it('유튜브 링크가 있는 곡만 뒷면에 "▶ 듣기" → onListen', () => {
    const onListen = vi.fn();
    const items = [song(1, { listen_url: 'https://youtu.be/x' }), song(2)];
    renderCards(grid, items, { onListen });
    expect(grid.querySelectorAll('[data-act="listen"]').length).toBe(1);
    grid.querySelector('[data-act="listen"]').click();
    expect(onListen).toHaveBeenCalledWith(items[0]);
    expect(cardOf('곡1').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('카드 순서', () => {
  it('인생작이 앞에, 그다음은 최신순', () => {
    const list = [
      book(1, { date: '2026-01-01' }),
      book(2, { date: '2026-03-01' }),
      book(3, { date: '2025-12-01', featured: true }),
      book(4, { date: '2026-02-01', featured: true }),
    ];
    expect(sortForGrid(list).map((i) => i.id)).toEqual([4, 3, 2, 1]);
  });
});

describe('칩 개수 세기', () => {
  it('0에서 n까지 하나씩 올라감 — 1이 바로 보임', async () => {
    vi.useFakeTimers();
    const { countUp } = await import('../../../js/library/list.js');
    const el = document.createElement('span');
    countUp(el, 0, 3);
    expect(el.textContent).toBe('1');
    vi.advanceTimersByTime(50);
    expect(el.textContent).toBe('2');
    vi.advanceTimersByTime(50);
    expect(el.textContent).toBe('3');
    vi.advanceTimersByTime(500);
    expect(el.textContent).toBe('3');
    countUp(el, 5, 2); // 줄면 바로 최종 숫자
    expect(el.textContent).toBe('2');
    vi.useRealTimers();
  });
});

// 2026-11-26 "정보가 많으면 뒤집었을 때 잘림" — 뒷면 가운데만 스크롤, 넘치면 "크게 보기".
// jsdom은 레이아웃이 없어서 scrollHeight/clientHeight를 직접 정해 넘침을 흉내 냄.
describe('뒷면 내용이 넘칠 때', () => {
  const heavy = book(7, { memo: '아주 긴 감상', details: { scores: { ending: 4 }, genres: ['소설', '인문'] } });
  function fakeSize(card, scrollHeight, clientHeight) {
    const body = card.querySelector('.back-body');
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: clientHeight });
    return body;
  }

  it('감상·별점·세부 기록·만든 사람은 스크롤 칸 안에, 버튼 줄은 그 바깥(늘 보임)', () => {
    renderCards(grid, [{ ...heavy, creator: '헤세' }], { onEdit: () => {}, onDelete: () => {}, onFeature: () => {} });
    const body = grid.querySelector('.back-body');
    expect(body.querySelector('.q')).not.toBeNull();
    expect(body.querySelector('.back-details')).not.toBeNull();
    expect(body.querySelector('.back-creator')).not.toBeNull();
    expect(body.querySelector('.back-actions')).toBeNull();
    expect(grid.querySelector('.back > .back-actions')).not.toBeNull();
  });

  it('넘치면 뒤집을 때 "크게 보기"가 보이고 끝이 흐려짐 → 누르면 onExpand(기록), 카드는 안 뒤집힘', () => {
    const onExpand = vi.fn();
    renderCards(grid, [heavy], { onEdit: () => {}, onDelete: () => {}, onFeature: () => {}, onExpand });
    const card = grid.querySelector('.card');
    const body = fakeSize(card, 400, 120);
    const expand = card.querySelector('[data-act="expand"]');
    expect(expand.hidden).toBe(true);
    card.click();
    expect(expand.hidden).toBe(false);
    expect(body.classList.contains('more')).toBe(true);
    expand.click();
    expect(onExpand).toHaveBeenCalledWith(heavy);
    expect(card.getAttribute('aria-pressed')).toBe('true');
    // 끝까지 내리면 흐림이 사라짐
    body.scrollTop = 280;
    body.dispatchEvent(new Event('scroll'));
    expect(body.classList.contains('more')).toBe(false);
  });

  it('다 들어가면 "크게 보기" 없음, onExpand를 안 주면(큰 카드 창 안) 버튼 자체가 없음', () => {
    renderCards(grid, [heavy], { onEdit: () => {}, onDelete: () => {}, onFeature: () => {}, onExpand: () => {} });
    const card = grid.querySelector('.card');
    fakeSize(card, 100, 120);
    card.click();
    expect(card.querySelector('[data-act="expand"]').hidden).toBe(true);
    renderCards(grid, [heavy], { onEdit: () => {}, onDelete: () => {}, onFeature: () => {} });
    expect(grid.querySelector('[data-act="expand"]')).toBeNull();
  });
});
