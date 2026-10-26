// fitViewport.js — 창을 보이는 부분(visualViewport)에 맞추고, 검색 목록이 저장 줄
// 위까지만 펼쳐지게 남은 높이를 알려 주는지.
import { describe, expect, it } from 'vitest';
import { fitToViewport } from '../../../js/library/modal/fitViewport.js';

function fakeViewport() {
  const handlers = {};
  return {
    offsetTop: 0,
    height: 800,
    addEventListener: (type, fn) => { handlers[type] = fn; },
    fire: (type) => handlers[type](),
  };
}

function el(rect, cls) {
  const node = document.createElement('div');
  if (cls) node.className = cls;
  node.getBoundingClientRect = () => rect;
  return node;
}

function setup() {
  const vv = fakeViewport();
  const overlay = el({ bottom: 800 }, 'overlay open');
  const group = el({ bottom: 200 });
  const actions = el({ top: 740 });
  const fit = fitToViewport({ overlay, group, actions, win: { visualViewport: vv } });
  return { vv, overlay, group, actions, fit };
}

describe('fitToViewport', () => {
  it('창을 보이는 부분 위치·높이에 맞추고, 목록 남은 높이를 저장 줄 위까지로 알려 줌', () => {
    const { overlay, group, fit } = setup();
    fit.update();
    expect(overlay.style.top).toBe('0px');
    expect(overlay.style.height).toBe('800px');
    expect(group.style.getPropertyValue('--ac-room')).toBe('528px'); // 740 - (200 + 4) - 8
  });

  it('키보드가 올라오면(보이는 높이가 줄면) 창과 목록 높이를 다시 맞춤', () => {
    const { vv, overlay, group, actions } = setup();
    vv.offsetTop = 120;
    vv.height = 400;
    overlay.getBoundingClientRect = () => ({ bottom: 520 });
    actions.getBoundingClientRect = () => ({ top: 460 });
    vv.fire('resize');
    expect(overlay.style.top).toBe('120px');
    expect(overlay.style.height).toBe('400px');
    expect(group.style.getPropertyValue('--ac-room')).toBe('248px'); // 460 - 204 - 8
  });

  it('창이 닫혀 있으면 아무것도 안 바꿈', () => {
    const { overlay, fit } = setup();
    overlay.classList.remove('open');
    fit.update();
    expect(overlay.style.height).toBe('');
  });

  it('visualViewport가 없는 브라우저에선 아무것도 안 함', () => {
    const overlay = el({}, 'overlay open');
    fitToViewport({ overlay, group: el({}), actions: el({}), win: {} }).update();
    expect(overlay.style.height).toBe('');
  });
});
