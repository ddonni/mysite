// 화면 오른쪽 아래의 "도구 서랍"(색상/굵기/지우개/되돌리기/전체지우기)과, 그 서랍을 여닫는 손잡이 버튼을 담당하는 모듈.
// 실제로 선을 그리거나 지우는 동작은 canvas.js에 있고, 여긴 그
// 기능들을 누를 수 있는 버튼을 만들고 연결하는 역할만 함.

export function initDock({ canvas, toast }) {
  const handle = document.getElementById('handle');
  const panel = document.getElementById('panel');
  const dock = document.getElementById('dock');

  function setOpen(open) {
    panel.classList.toggle('open', open);
    handle.classList.toggle('active', open);
    handle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  handle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  // 서랍이 열려 있을 때 서랍 바깥(캔버스 등)을 누르면 자동으로 닫힘.
  document.addEventListener('pointerdown', (e) => {
    if (!panel.classList.contains('open')) return;
    if (dock.contains(e.target)) return;
    setOpen(false);
  });

  // ---- 색상 스와치 ----
  const swatchesEl = document.getElementById('swatches');
  const customColor = document.getElementById('customColor');
  const eraserBtn = document.getElementById('eraserBtn');

  function selectColor(hex, fromCustom) {
    canvas.setColor(hex);
    eraserBtn.classList.remove('active');
    Array.prototype.forEach.call(swatchesEl.querySelectorAll('.swatch'), (el) => {
      el.classList.toggle('selected', !fromCustom && el.dataset.color === hex);
    });
  }
  canvas.palette.forEach((hex) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = hex;
    b.dataset.color = hex;
    b.title = hex;
    if (hex === canvas.defaultColor) b.classList.add('selected');
    b.addEventListener('click', () => selectColor(hex, false));
    swatchesEl.appendChild(b);
  });
  customColor.addEventListener('input', () => selectColor(customColor.value, true));

  // ---- 굵기 선택 ----
  const sizesEl = document.getElementById('sizes');
  canvas.sizes.forEach((px, i) => {
    const b = document.createElement('button');
    b.className = 'size-btn' + (px === canvas.defaultSize ? ' selected' : '');
    b.title = px + 'px';
    const dotSize = 5 + i * 4; // 굵기가 클수록 미리보기 점도 크게
    b.innerHTML = '<span class="dot" style="width:' + dotSize + 'px;height:' + dotSize + 'px;"></span>';
    b.addEventListener('click', () => {
      canvas.setSize(px);
      Array.prototype.forEach.call(sizesEl.querySelectorAll('.size-btn'), (el) => el.classList.remove('selected'));
      b.classList.add('selected');
    });
    sizesEl.appendChild(b);
  });

  // ---- 지우개 / 되돌리기 ----
  eraserBtn.addEventListener('click', () => {
    const erasing = canvas.toggleEraser();
    eraserBtn.classList.toggle('active', erasing);
  });
  document.getElementById('undoBtn').addEventListener('click', () => canvas.undo());

  // ---- 전체 지우기: 실수 방지로 "한 번 더 누르면 지워짐" 방식 ----
  const clearBtn = document.getElementById('clearBtn');
  const clearState = { armed: false, timer: null };
  clearBtn.addEventListener('click', () => {
    if (!clearState.armed) {
      clearState.armed = true;
      clearBtn.classList.add('armed');
      toast('한 번 더 누르면 이 페이지가 전부 지워져요');
      clearTimeout(clearState.timer);
      clearState.timer = setTimeout(() => {
        clearState.armed = false;
        clearBtn.classList.remove('armed');
      }, 3000);
      return;
    }
    clearTimeout(clearState.timer);
    clearState.armed = false;
    clearBtn.classList.remove('armed');
    canvas.clearPage();
    toast('지웠어요');
  });
}
