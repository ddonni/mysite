// controls.js의 핀치 줌 — 두 손가락을 벌리면 카메라가 다가가고 오므리면 물러나는지,
// 핀치하는 동안 회전·가구 탭으로 오해하지 않는지. three.js(전역 THREE)는 이 모듈이 쓰는
// 만큼만 가짜로 둠(레이캐스트는 아무것도 안 맞힘).
import { beforeEach, describe, expect, it } from 'vitest';

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  copy(v) { return this.set(v.x, v.y, v.z); }
  lerp(v, t) { return this.set(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t, this.z + (v.z - this.z) * t); }
}
globalThis.THREE = {
  Vector3,
  Vector2: class { constructor() { this.x = 0; this.y = 0; } },
  Plane: class {},
  Raycaster: class {
    constructor() { this.ray = { intersectPlane: () => null, direction: new Vector3() }; }
    setFromCamera() {}
    intersectObjects() { return []; }
  },
};
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false }));

const { createRoomInteraction } = await import('../../js/lobby/controls.js');

let canvas;
let camera;
let interaction;

function pointer(type, id, x, y, pointerType = 'touch') {
  const e = new Event(type, { bubbles: true });
  Object.assign(e, { pointerId: id, clientX: x, clientY: y, pointerType });
  (type === 'pointerup' || type === 'pointercancel' ? window : canvas).dispatchEvent(e);
}

// 카메라가 목표 지점(0,0,0 근처)에서 얼마나 떨어져 있는지 — 감쇠가 끝나게 여러 번 update.
function distance() {
  for (let i = 0; i < 200; i++) interaction.update(0.016);
  const p = camera.position;
  return Math.hypot(p.x, p.y, p.z);
}

beforeEach(() => {
  document.body.innerHTML = `
    <canvas id="c"></canvas>
    <div id="card"><span id="tag"></span><h2 id="t"></h2><p id="b"></p><button id="back"></button><button id="enter"></button></div>`;
  canvas = document.getElementById('c');
  canvas.setPointerCapture = () => {};
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 800 });
  camera = { position: new Vector3(), lookAt() {} };
  const home = { target: new Vector3(0, 0, 0), radius: 10, theta: 0.5, phi: 1.1 };
  interaction = createRoomInteraction({
    canvas,
    camera,
    interactiveGroups: [],
    roomInfo: {},
    onConfirm: () => {},
    kickBall: () => {},
    cameraPresets: { home, focus: {}, targetLimit: { radius: 5, minY: -1, maxY: 3 } },
    dom: {
      card: document.getElementById('card'),
      cardTag: document.getElementById('tag'),
      cardTitle: document.getElementById('t'),
      cardBody: document.getElementById('b'),
      cardBack: document.getElementById('back'),
      cardEnter: document.getElementById('enter'),
      ctaBtns: [],
    },
  });
});

describe('핀치 줌', () => {
  it('두 손가락을 벌리면 가까이, 오므리면 멀리', () => {
    const start = distance();
    pointer('pointerdown', 1, 150, 400);
    pointer('pointerdown', 2, 250, 400);
    pointer('pointermove', 2, 350, 400); // 100px → 200px로 벌림
    const closer = distance();
    expect(closer).toBeLessThan(start * 0.7);

    pointer('pointermove', 2, 175, 400); // 200px → 25px로 오므림
    expect(distance()).toBeGreaterThan(closer);
    pointer('pointerup', 2, 175, 400);
    pointer('pointerup', 1, 150, 400);
  });

  it('핀치하는 동안엔 회전하지 않고, 남은 손가락으로 다시 회전함', () => {
    distance();
    pointer('pointerdown', 1, 150, 400);
    pointer('pointerdown', 2, 250, 400);
    expect(canvas.classList.contains('dragging')).toBe(false);
    pointer('pointerup', 2, 250, 400);
    expect(canvas.classList.contains('dragging')).toBe(true);

    const before = camera.position.clone();
    pointer('pointermove', 1, 250, 400); // 남은 손가락으로 가로로 밈 → 돌아감
    distance();
    expect(camera.position.x).not.toBeCloseTo(before.x, 3);
    pointer('pointerup', 1, 250, 400);
  });

  it('마우스는 지금처럼 드래그만(핀치로 안 셈)', () => {
    pointer('pointerdown', 7, 100, 100, 'mouse');
    expect(canvas.classList.contains('dragging')).toBe(true);
    pointer('pointerup', 7, 100, 100, 'mouse');
    expect(canvas.classList.contains('dragging')).toBe(false);
  });
});
