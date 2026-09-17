// "지금 몇 페이지째이고, 그 페이지를 저장소와 어떻게 주고받는가" 를
// 담당하는 모듈. 종이를 넘기는 애니메이션, 페이지 삭제, 페이지 번호
// 직접 입력(점프)도 여기서 다룸.
//
// canvas.js는 "페이지"라는 개념을 모르기 때문에, "지금 페이지에 뭔가
// 그려졌다"는 소식을 받아서 실제로 store.setPage(현재_페이지_번호, …)를
// 불러주는 것도 이 모듈의 역할임 (persistChange).

export function createPager({ store, canvas, toast }) {
  let count = 1;      // 전체 페이지 수
  let currentN = 1;   // 지금 보고 있는 페이지 번호
  let pageUnsub = null; // 실시간 구독을 끊는 함수 (페이지를 옮길 때마다 이전 구독은 정리해야 함)

  const pageLabelEl = document.getElementById('pageLabel');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const deletePageBtn = document.getElementById('deletePageBtn');
  const pageWrap = document.getElementById('pageWrap');
  const pageJump = document.getElementById('pageJump');

  function updatePagerUI() {
    pageLabelEl.textContent = currentN + ' / ' + count;
    prevBtn.disabled = currentN <= 1;
    deletePageBtn.disabled = count <= 1;
  }

  // 페이지를 넘길 때 "휙" 넘어가는 종이 애니메이션. 이전 페이지를 찍은
  // 스냅샷 이미지를 화면 위에 얹어두고, CSS 애니메이션이 끝나면
  // 스스로 없어지게 함.
  function playFlip(oldSnapDataUrl, dir) {
    const el = document.createElement('div');
    el.className = 'flip-page ' + (dir > 0 ? 'forward' : 'backward');
    const img = document.createElement('img');
    img.src = oldSnapDataUrl;
    el.appendChild(img);
    pageWrap.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function attachPageSubscription(n) {
    if (pageUnsub) { pageUnsub(); pageUnsub = null; }
    if (!store.shared) return; // 로컬 저장소는 실시간 동기화가 없음
    pageUnsub = store.subscribePage(n, (strokes) => {
      if (n !== currentN) return; // 그 사이에 이미 다른 페이지로 넘어갔으면 무시
      canvas.applyRemote(strokes);
    });
  }

  function goToPage(n, opts) {
    opts = opts || {};
    n = Math.max(1, Math.min(n, count));
    if (n === currentN && !opts.force) return;
    const dir = n > currentN ? 1 : -1;

    // 넘어가기 "전" 화면을 스냅샷으로 찍어둠 (애니메이션에 씀).
    let oldSnap = null;
    if (opts.animate !== false) oldSnap = canvas.getDataUrl();

    currentN = n;
    canvas.loadPage([]); // 실제 내용이 도착하기 전까지 일단 빈 페이지를 보여줌
    updatePagerUI();
    try { history.replaceState(null, '', '#' + currentN); } catch (e) {}

    store.getPage(n).then((strokes) => {
      if (n !== currentN) return; // 응답이 오기 전에 또 페이지를 옮겼으면 무시
      canvas.loadPage(strokes);
    });
    attachPageSubscription(n);
    if (oldSnap) playFlip(oldSnap, dir);
  }

  function nextPage() {
    if (currentN < count) { goToPage(currentN + 1); return; }
    // 마지막 페이지에서 한 번 더 넘기면 = 새 빈 페이지를 만드는 것.
    store.addPage().then((newCount) => {
      count = newCount;
      goToPage(count);
    });
  }

  function prevPage() {
    if (currentN > 1) goToPage(currentN - 1);
  }

  nextBtn.addEventListener('click', nextPage);
  prevBtn.addEventListener('click', prevPage);

  // ---- 현재 페이지 삭제: 뒤쪽 페이지들이 한 칸씩 당겨짐 (종이를 한
  // 장 뜯어내는 것과 같음). 실수로 누르는 걸 막기 위해 "한 번 더
  // 누르면 삭제" 방식(arm)을 씀 — 3초 안에 다시 안 누르면 무장 해제.
  const deleteState = { armed: false, timer: null, busy: false };

  function deleteCurrentPage() {
    if (count <= 1) { toast('마지막 남은 페이지는 지울 수 없어요'); return; }
    if (deleteState.busy) return;
    deleteState.busy = true;
    const delN = currentN;
    store.deletePage(delN)
      .then((newCount) => {
        count = newCount;
        const target = Math.min(delN, count);
        goToPage(target, { force: true, animate: false });
        updatePagerUI();
        toast('페이지를 삭제했어요');
      })
      .catch((err) => {
        if (err && err.code === 'last_page') toast('마지막 남은 페이지는 지울 수 없어요');
        else toast('삭제하는 중 문제가 생겼어요');
      })
      .then(() => { deleteState.busy = false; });
  }

  deletePageBtn.addEventListener('click', () => {
    if (!deleteState.armed) {
      deleteState.armed = true;
      deletePageBtn.classList.add('armed');
      toast('한 번 더 누르면 이 페이지를 삭제해요');
      clearTimeout(deleteState.timer);
      deleteState.timer = setTimeout(() => {
        deleteState.armed = false;
        deletePageBtn.classList.remove('armed');
      }, 3000);
      return;
    }
    clearTimeout(deleteState.timer);
    deleteState.armed = false;
    deletePageBtn.classList.remove('armed');
    deleteCurrentPage();
  });

  // ---- 페이지 번호를 직접 입력해서 이동(점프) ----
  pageLabelEl.addEventListener('click', () => {
    pageJump.value = currentN;
    pageJump.min = 1;
    pageLabelEl.classList.add('hidden');
    pageJump.classList.add('open');
    pageJump.focus();
    pageJump.select();
  });
  function closeJump() {
    pageJump.classList.remove('open');
    pageLabelEl.classList.remove('hidden');
  }
  pageJump.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const n = parseInt(pageJump.value, 10);
      closeJump();
      if (!isNaN(n) && n >= 1) {
        if (n > count) {
          // 지금 있는 페이지 수보다 큰 번호로 점프하면, 그 번호가 될
          // 때까지 빈 페이지를 계속 추가하면서 늘려나감.
          (function grow() {
            if (count >= n) { goToPage(n); return; }
            store.addPage().then((c) => { count = c; grow(); });
          })();
        } else {
          goToPage(n);
        }
      }
    } else if (e.key === 'Escape') {
      closeJump();
    }
  });
  pageJump.addEventListener('blur', closeJump);

  return {
    // canvas.js가 "그려진 내용이 바뀌었다"고 알려줄 때 실제로 저장하는
    // 함수. canvas.setOnChange(pager.persistChange) 형태로 main.js에서
    // 연결해줌 — canvas.js는 이 함수가 존재한다는 것만 알 뿐, 안에서
    // 무슨 일이 일어나는지는 모름.
    persistChange(combined, gen, savedIds) {
      store.setPage(currentN, combined)
        .then(() => canvas.reconcileSaved(gen, combined, savedIds))
        .catch((err) => canvas.saveFailed(err));
    },

    // 페이지 수를 서버(혹은 로컬)에서 읽어오고, 주소창의 #해시로 지정된
    // 페이지가 있으면 그 페이지부터, 없으면 1페이지부터 보여줌.
    boot(initialHashN) {
      return store.getMeta().then((c) => {
        count = c;
        let initial = 1;
        if (!isNaN(initialHashN) && initialHashN >= 1) initial = Math.min(initialHashN, count);
        updatePagerUI();
        goToPage(initial, { animate: false, force: true });
        store.subscribeMeta((c2) => { count = Math.max(count, c2); updatePagerUI(); });
      });
    },
  };
}
