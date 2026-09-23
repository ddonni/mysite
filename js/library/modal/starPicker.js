// 별점 선택 위젯 (0.5칸 단위, SVG 별 두 장을 겹쳐서 채워지는 비율로
// 표현). containerEl 안에 별 5개를 직접 그려 넣고 클릭을 처리함 —
// 값(별점)을 스스로 들고 있어서, 모달은 setValue/getValue로만
// 주고받고 내부적으로 어떻게 그리는지는 몰라도 됨.
const STAR_PATH = 'M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 19.771l-7.416 3.642 1.48-8.279L0 9.306l8.332-1.151z';

function starSvg() {
  return `<svg viewBox="0 0 24 24"><path d="${STAR_PATH}"></path></svg>`;
}

function buildStarsMarkup() {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<div class="star" data-i="${i}"><span class="bg">${starSvg()}</span><span class="fg">${starSvg()}</span></div>`;
  }
  return html;
}

export function createStarPicker(containerEl) {
  let value = 0;

  function render() {
    containerEl.querySelectorAll('.star').forEach((s) => {
      const i = parseInt(s.dataset.i);
      const fg = s.querySelector('.fg');
      let pct = 0;
      if (value >= i) pct = 100;
      else if (value >= i - 0.5) pct = 50;
      fg.style.width = pct + '%';
    });
  }

  containerEl.innerHTML = buildStarsMarkup();
  containerEl.querySelectorAll('.star').forEach((s) => {
    s.addEventListener('click', (e) => {
      const rect = s.getBoundingClientRect();
      const isHalf = (e.clientX - rect.left) < rect.width / 2; // 별의 왼쪽 절반을 누르면 반 개, 오른쪽이면 한 개
      const i = parseInt(s.dataset.i);
      value = isHalf ? i - 0.5 : i;
      render();
    });
  });

  return {
    getValue: () => value,
    setValue(v) { value = v || 0; render(); },
  };
}
