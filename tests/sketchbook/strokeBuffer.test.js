// strokeBuffer.js는 canvas.js에서 갓 분리해낸 순수 데이터 로직(DOM
// 없음)이라, 분리하면서 동작이 안 바뀌었는지 확인하기 좋은 대상.
import { describe, expect, it } from 'vitest';
import { createStrokeBuffer } from '../../js/sketchbook/canvas/strokeBuffer.js';

function stroke(id, author) {
  return { id, author, points: [[0, 0]] };
}

describe('merged', () => {
  it('server와 pending을 합치되, 같은 id는 pending 쪽(최신)을 우선함', () => {
    const buf = createStrokeBuffer();
    buf.loadPage([stroke('a', 'x'), stroke('b', 'x')]);
    buf.addPending({ id: 'b', author: 'x', points: [[1, 1]] }); // b를 덮어씀
    buf.addPending(stroke('c', 'x'));

    const merged = buf.merged();
    expect(merged.map((s) => s.id)).toEqual(['a', 'b', 'c']); // 처음 등장한 순서 유지
    expect(merged[1].points).toEqual([[1, 1]]); // pending 쪽 내용으로 덮어써짐
  });
});

describe('snapshotForSave', () => {
  it('지금 세대와 합쳐진 목록, id 목록을 돌려줌', () => {
    const buf = createStrokeBuffer();
    buf.loadPage([stroke('a', 'x')]);
    buf.addPending(stroke('b', 'x'));

    const snap = buf.snapshotForSave();
    expect(snap.gen).toBe(buf.generation);
    expect(snap.ids).toEqual(['a', 'b']);
    expect(snap.strokes.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('300개를 넘으면 오래된 것부터 잘라냄', () => {
    const buf = createStrokeBuffer();
    const many = Array.from({ length: 305 }, (_, i) => stroke(`s${i}`, 'x'));
    buf.loadPage(many);

    const snap = buf.snapshotForSave();
    expect(snap.strokes.length).toBe(300);
    expect(snap.strokes[0].id).toBe('s5'); // 앞의 5개(가장 오래된)가 잘려나감
    expect(snap.strokes[299].id).toBe('s304');
  });
});

describe('reconcile', () => {
  it('세대가 같으면 server를 갱신하고, 이미 저장된 pending은 걷어냄', () => {
    const buf = createStrokeBuffer();
    buf.loadPage([]);
    buf.addPending(stroke('a', 'x'));
    const gen = buf.generation;

    buf.reconcile(gen, [stroke('a', 'x')], ['a']);

    expect(buf.merged().map((s) => s.id)).toEqual(['a']);
  });

  it('그사이 페이지가 넘어가 세대가 달라졌으면(더 이상 유효하지 않은 응답) 무시함', () => {
    const buf = createStrokeBuffer();
    buf.loadPage([stroke('old', 'x')]);
    const staleGen = buf.generation;
    buf.loadPage([stroke('new', 'x')]); // 세대가 하나 늘어남

    buf.reconcile(staleGen, [stroke('old', 'x')], ['old']);

    expect(buf.merged().map((s) => s.id)).toEqual(['new']); // 옛 응답에 안 덮어써짐
  });
});

describe('loadPage / applyRemote / clear', () => {
  it('loadPage는 세대를 올리고 pending을 비움', () => {
    const buf = createStrokeBuffer();
    const before = buf.generation;
    buf.addPending(stroke('a', 'x'));

    buf.loadPage([stroke('b', 'x')]);

    expect(buf.generation).toBe(before + 1);
    expect(buf.merged().map((s) => s.id)).toEqual(['b']); // pending 'a'는 사라짐
  });

  it('applyRemote는 server만 바꾸고 pending은 그대로 둠', () => {
    const buf = createStrokeBuffer();
    buf.loadPage([]);
    buf.addPending(stroke('mine', 'x'));

    buf.applyRemote([stroke('theirs', 'y')]);

    expect(buf.merged().map((s) => s.id).sort()).toEqual(['mine', 'theirs']);
  });

  it('clear는 둘 다 비움', () => {
    const buf = createStrokeBuffer();
    buf.loadPage([stroke('a', 'x')]);
    buf.addPending(stroke('b', 'x'));

    buf.clear();

    expect(buf.merged()).toEqual([]);
  });
});

describe('removeLastByAuthor', () => {
  it('pending 쪽에서 그 작성자의 가장 최근 획을 먼저 지움', () => {
    const buf = createStrokeBuffer();
    buf.loadPage([stroke('server1', 'me')]);
    buf.addPending(stroke('p1', 'me'));
    buf.addPending(stroke('p2', 'me'));

    const removed = buf.removeLastByAuthor('me');

    expect(removed).toBe(true);
    expect(buf.merged().map((s) => s.id)).toEqual(['server1', 'p1']);
  });

  it('pending에 없으면 server 쪽에서 찾아 지움', () => {
    const buf = createStrokeBuffer();
    buf.loadPage([stroke('a', 'other'), stroke('b', 'me')]);

    const removed = buf.removeLastByAuthor('me');

    expect(removed).toBe(true);
    expect(buf.merged().map((s) => s.id)).toEqual(['a']);
  });

  it('그 작성자 획이 하나도 없으면 false를 돌려주고 아무것도 안 지움', () => {
    const buf = createStrokeBuffer();
    buf.loadPage([stroke('a', 'other')]);

    const removed = buf.removeLastByAuthor('me');

    expect(removed).toBe(false);
    expect(buf.merged().map((s) => s.id)).toEqual(['a']);
  });
});
