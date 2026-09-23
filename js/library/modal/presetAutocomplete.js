// 제목 입력창에 뭘 타이핑하면 "혹시 이거 아니에요?" 하고 보여주는
// 추천 목록. getCat()으로 지금 선택된 카테고리를 물어봐서 그 카테고리의
// PRESETS만 걸러 보여줌(카테고리 탭이 바뀔 수 있어서 매번 다시 물어봄).
export function createPresetAutocomplete({ input, listEl }, PRESETS, getCat) {
  function render(filter) {
    listEl.innerHTML = '';
    if (!filter) { listEl.style.display = 'none'; return; }
    const list = (PRESETS[getCat()] || []).filter((t) => t.toLowerCase().includes(filter.toLowerCase()));
    if (list.length === 0) { listEl.style.display = 'none'; return; }
    listEl.style.display = 'block';
    list.forEach((title) => {
      const el = document.createElement('div');
      el.className = 'preset-item';
      el.textContent = title;
      el.addEventListener('click', () => { input.value = title; listEl.style.display = 'none'; });
      listEl.appendChild(el);
    });
  }

  input.addEventListener('input', () => render(input.value.trim()));
  input.addEventListener('focus', () => { if (input.value.trim()) render(input.value.trim()); });
  document.addEventListener('click', (e) => {
    if (e.target !== input && !listEl.contains(e.target)) listEl.style.display = 'none';
  });

  return {
    // 카테고리 탭을 바꿨을 때 등, 지금 입력값 기준으로 목록을 다시 그림.
    refresh() { render(input.value.trim()); },
    hide() { listEl.style.display = 'none'; },
  };
}
