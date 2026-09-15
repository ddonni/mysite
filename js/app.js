(function () {
  // Change this once the backend is deployed somewhere real (e.g. a
  // Render/Fly.io URL, or your own domain) — this is the only line that
  // needs to change to point the page at a different server.
  var API_BASE = 'https://sketchbook-api.onrender.com';
  var WS_BASE = API_BASE.replace(/^http/, 'ws');

  var PAGE_W = 1000, PAGE_H = 1414; // A4 proportions — a real sketchbook sheet
  var MAX_STROKES = 300;
  var MIN_POINT_DIST = 0.004; // normalized distance between stored points
  var sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  var stage = document.getElementById('stage');
  var pageWrap = document.getElementById('pageWrap');
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var dpr = Math.max(1, window.devicePixelRatio || 1);
  var dispW = 0, dispH = 0;

  var pageUnsub = null;
  var count = 1;
  var currentN = 1;
  var serverStrokes = [];
  var pendingLocal = [];

  var tool = {
    color: '#2b2b2e',
    size: 4,
    erasing: false,
    drawing: false,
    curStroke: null,
    lastPt: null,
    clearArmed: false,
    clearTimer: null
  };

  var PALETTE = ['#2b2b2e', '#33456b', '#365c3f', '#9c3f34', '#c1712f'];
  var SIZES = [2, 5, 10];

  function pad(n) { return String(n).padStart(6, '0'); }

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  // ---------------------------------------------------------------
  // storage: the FastAPI + PostgreSQL backend when it's reachable, a
  // per-device localStorage fallback otherwise — same interface either
  // way, so the rest of the app never has to care which one is active.
  //
  // Interface: getMeta()->Promise<count>, addPage()->Promise<newCount>,
  // deletePage(n)->Promise<newCount> (rejects {code:'last_page'} on the
  // last page), getPage(n)->Promise<strokes[]>, setPage(n, strokes),
  // subscribePage(n, cb)->unsubscribe fn.
  // ---------------------------------------------------------------
  function apiFetch(path, opts) {
    return fetch(API_BASE + path, opts).then(function (res) {
      if (res.ok) return res.json().catch(function () { return {}; });
      return res.json().catch(function () { return {}; }).then(function (body) {
        var err = new Error('api_error');
        err.code = (body && body.detail) || ('http_' + res.status);
        throw err;
      });
    });
  }

  function makeApiStore() {
    return {
      shared: true,
      getMeta: function () { return apiFetch('/api/meta').then(function (d) { return d.count; }); },
      subscribeMeta: function () { return function () {}; },
      addPage: function () {
        return apiFetch('/api/pages', { method: 'POST' }).then(function (d) { return d.count; });
      },
      deletePage: function (n) {
        return apiFetch('/api/pages/' + n, { method: 'DELETE' }).then(function (d) { return d.count; });
      },
      getPage: function (n) {
        return apiFetch('/api/pages/' + n).then(function (d) { return d.strokes || []; })
          .catch(function (err) { if (err.code === 'page not found') return []; throw err; });
      },
      setPage: function (n, strokes) {
        return apiFetch('/api/pages/' + n, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strokes: strokes })
        });
      },
      subscribePage: function (n, cb) {
        var ws = null;
        try {
          ws = new WebSocket(WS_BASE + '/ws/pages/' + n);
          ws.addEventListener('message', function (ev) {
            try {
              var msg = JSON.parse(ev.data);
              if (msg.type === 'strokes') cb(msg.strokes);
            } catch (e) {}
          });
        } catch (e) { ws = null; }
        return function () { if (ws) { try { ws.close(); } catch (e) {} } };
      }
    };
  }

  function makeLocalStore() {
    var META_KEY = 'untitled-canvas.local.meta';
    function pageKey(n) { return 'untitled-canvas.local.page.' + pad(n); }
    return {
      shared: false,
      getMeta: function () {
        var v = 1;
        try { v = JSON.parse(localStorage.getItem(META_KEY) || '{"count":1}').count || 1; } catch (e) {}
        return Promise.resolve(v);
      },
      subscribeMeta: function () { return function () {}; },
      addPage: function () {
        var next = count + 1;
        try { localStorage.setItem(META_KEY, JSON.stringify({ count: next })); } catch (e) {}
        return Promise.resolve(next);
      },
      deletePage: function (n) {
        if (count <= 1) return Promise.reject({ code: 'last_page' });
        for (var i = n; i < count; i++) {
          var next = [];
          try { next = JSON.parse(localStorage.getItem(pageKey(i + 1)) || '[]'); } catch (e) {}
          try { localStorage.setItem(pageKey(i), JSON.stringify(next)); } catch (e) {}
        }
        try { localStorage.removeItem(pageKey(count)); } catch (e) {}
        var newCount = count - 1;
        try { localStorage.setItem(META_KEY, JSON.stringify({ count: newCount })); } catch (e) {}
        return Promise.resolve(newCount);
      },
      getPage: function (n) {
        var v = [];
        try { v = JSON.parse(localStorage.getItem(pageKey(n)) || '[]'); } catch (e) {}
        return Promise.resolve(v);
      },
      subscribePage: function () { return function () {}; },
      setPage: function (n, strokes) {
        try { localStorage.setItem(pageKey(n), JSON.stringify(strokes)); } catch (e) {}
        return Promise.resolve();
      }
    };
  }

  var store = null;

  // ---------------------------------------------------------------
  // rendering
  // ---------------------------------------------------------------
  function mergedStrokes() {
    var byId = {};
    var order = [];
    serverStrokes.forEach(function (s) { if (!byId[s.id]) order.push(s.id); byId[s.id] = s; });
    pendingLocal.forEach(function (s) { if (!byId[s.id]) order.push(s.id); byId[s.id] = s; });
    return order.map(function (id) { return byId[id]; });
  }

  function drawFullStroke(st) {
    if (!st.points || !st.points.length) return;
    ctx.globalCompositeOperation = st.eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = st.color || 'rgba(0,0,0,1)';
    ctx.fillStyle = st.color || 'rgba(0,0,0,1)';
    ctx.lineWidth = st.width;
    if (st.points.length === 1) {
      var pt = st.points[0];
      ctx.beginPath();
      ctx.arc(pt[0] * dispW, pt[1] * dispH, st.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    ctx.beginPath();
    ctx.moveTo(st.points[0][0] * dispW, st.points[0][1] * dispH);
    for (var i = 1; i < st.points.length; i++) {
      ctx.lineTo(st.points[i][0] * dispW, st.points[i][1] * dispH);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  function renderAll() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fffdfa';
    ctx.fillRect(0, 0, dispW, dispH);
    mergedStrokes().forEach(drawFullStroke);
  }

  // ---------------------------------------------------------------
  // layout — the page keeps A4 proportions and fits the viewport
  // ---------------------------------------------------------------
  function layout() {
    var padding = 30;
    var availW = window.innerWidth - padding * 2;
    var availH = window.innerHeight - padding * 2;
    var ratio = PAGE_W / PAGE_H;
    var w = availW, h = w / ratio;
    if (h > availH) { h = availH; w = h * ratio; }
    pageWrap.style.width = w + 'px';
    pageWrap.style.height = h + 'px';
    dispW = w; dispH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    renderAll();
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });

  // ---------------------------------------------------------------
  // drawing
  // ---------------------------------------------------------------
  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function widthForPressure(p) {
    var base = tool.size;
    if (!p || p <= 0) return base;
    return Math.max(1, base * (0.5 + p * 1.1));
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    tool.drawing = true;
    canvas.setPointerCapture(e.pointerId);
    var pos = pointerPos(e);
    tool.lastPt = pos;
    tool.curStroke = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      color: tool.erasing ? null : tool.color,
      eraser: tool.erasing,
      width: tool.size,
      author: sessionId,
      points: [[+(pos.x / dispW).toFixed(4), +(pos.y / dispH).toFixed(4)]]
    };
    ctx.globalCompositeOperation = tool.erasing ? 'destination-out' : 'source-over';
    ctx.fillStyle = tool.erasing ? 'rgba(0,0,0,1)' : tool.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, widthForPressure(e.pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function onPointerMove(e) {
    if (!tool.drawing || !tool.curStroke) return;
    var pos = pointerPos(e);
    ctx.globalCompositeOperation = tool.erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = tool.erasing ? 'rgba(0,0,0,1)' : tool.color;
    ctx.lineWidth = widthForPressure(e.pressure);
    ctx.beginPath();
    ctx.moveTo(tool.lastPt.x, tool.lastPt.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    tool.lastPt = pos;

    var fx = pos.x / dispW, fy = pos.y / dispH;
    var last = tool.curStroke.points[tool.curStroke.points.length - 1];
    var dx = fx - last[0], dy = fy - last[1];
    if (dx * dx + dy * dy >= MIN_POINT_DIST * MIN_POINT_DIST) {
      tool.curStroke.points.push([+fx.toFixed(4), +fy.toFixed(4)]);
    }
  }

  function onPointerUp() {
    if (!tool.drawing) return;
    tool.drawing = false;
    var st = tool.curStroke;
    tool.curStroke = null;
    if (!st) return;
    pendingLocal.push(st);
    save();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  function save() {
    var combined = mergedStrokes();
    if (combined.length > MAX_STROKES) combined = combined.slice(combined.length - MAX_STROKES);
    var savingN = currentN;
    var savedIds = combined.map(function (s) { return s.id; });
    store.setPage(savingN, combined).then(function () {
      if (savingN !== currentN) return;
      serverStrokes = combined;
      pendingLocal = pendingLocal.filter(function (s) { return savedIds.indexOf(s.id) === -1; });
    }).catch(function (err) {
      if (err && err.code === 'page not found') {
        toast('저장에 실패했어요 — 페이지를 새로고침해 보세요');
      }
      // network hiccups: the next stroke's save carries the same merged
      // state forward, so nothing is lost, just briefly unsynced
    });
  }

  function undo() {
    for (var i = pendingLocal.length - 1; i >= 0; i--) {
      if (pendingLocal[i].author === sessionId) { pendingLocal.splice(i, 1); renderAll(); save(); return; }
    }
    for (var j = serverStrokes.length - 1; j >= 0; j--) {
      if (serverStrokes[j].author === sessionId) { serverStrokes.splice(j, 1); renderAll(); save(); return; }
    }
    toast('되돌릴 내 획이 없어요');
  }

  // ---------------------------------------------------------------
  // page navigation + flip animation
  // ---------------------------------------------------------------
  function updatePagerUI() {
    document.getElementById('pageLabel').textContent = currentN + ' / ' + count;
    document.getElementById('prevBtn').disabled = currentN <= 1;
    document.getElementById('deletePageBtn').disabled = count <= 1;
  }

  function playFlip(oldSnapDataUrl, dir) {
    var el = document.createElement('div');
    el.className = 'flip-page ' + (dir > 0 ? 'forward' : 'backward');
    var img = document.createElement('img');
    img.src = oldSnapDataUrl;
    el.appendChild(img);
    pageWrap.appendChild(el);
    el.addEventListener('animationend', function () { el.remove(); });
  }

  function attachPageSubscription(n) {
    if (pageUnsub) { pageUnsub(); pageUnsub = null; }
    if (!store.shared) return;
    pageUnsub = store.subscribePage(n, function (strokes) {
      if (n !== currentN) return;
      serverStrokes = strokes;
      if (!tool.drawing) renderAll();
    });
  }

  function goToPage(n, opts) {
    opts = opts || {};
    n = Math.max(1, Math.min(n, count));
    if (n === currentN && !opts.force) return;
    var dir = n > currentN ? 1 : -1;
    var oldSnap = null;
    if (opts.animate !== false) {
      try { oldSnap = canvas.toDataURL('image/png'); } catch (e) {}
    }
    currentN = n;
    pendingLocal = [];
    serverStrokes = [];
    updatePagerUI();
    try { history.replaceState(null, '', '#' + currentN); } catch (e) {}
    ctx.fillStyle = '#fffdfa';
    ctx.fillRect(0, 0, dispW, dispH);
    store.getPage(n).then(function (strokes) {
      if (n !== currentN) return;
      serverStrokes = strokes;
      renderAll();
    });
    attachPageSubscription(n);
    if (oldSnap) playFlip(oldSnap, dir);
  }

  function nextPage() {
    if (currentN < count) { goToPage(currentN + 1); return; }
    // turning past the last drawn sheet reveals a fresh page
    store.addPage().then(function (newCount) {
      count = newCount;
      goToPage(count);
    });
  }

  function prevPage() { if (currentN > 1) goToPage(currentN - 1); }

  document.getElementById('nextBtn').addEventListener('click', nextPage);
  document.getElementById('prevBtn').addEventListener('click', prevPage);

  // ---- delete the current page: the backend shifts every later page
  // down one slot in a single transaction, like tearing a sheet out of
  // the book, and hands back the new page count ----
  var deleteState = { armed: false, timer: null, busy: false };
  var deletePageBtn = document.getElementById('deletePageBtn');

  function deleteCurrentPage() {
    if (count <= 1) { toast('마지막 남은 페이지는 지울 수 없어요'); return; }
    if (deleteState.busy) return;
    deleteState.busy = true;
    var delN = currentN;
    store.deletePage(delN).then(function (newCount) {
      count = newCount;
      var target = Math.min(delN, count);
      goToPage(target, { force: true, animate: false });
      updatePagerUI();
      toast('페이지를 삭제했어요');
    }).catch(function (err) {
      if (err && err.code === 'last_page') toast('마지막 남은 페이지는 지울 수 없어요');
      else toast('삭제하는 중 문제가 생겼어요');
    }).then(function () { deleteState.busy = false; });
  }

  deletePageBtn.addEventListener('click', function () {
    if (!deleteState.armed) {
      deleteState.armed = true;
      deletePageBtn.classList.add('armed');
      toast('한 번 더 누르면 이 페이지를 삭제해요');
      clearTimeout(deleteState.timer);
      deleteState.timer = setTimeout(function () { deleteState.armed = false; deletePageBtn.classList.remove('armed'); }, 3000);
      return;
    }
    clearTimeout(deleteState.timer);
    deleteState.armed = false;
    deletePageBtn.classList.remove('armed');
    deleteCurrentPage();
  });

  var pageLabel = document.getElementById('pageLabel');
  var pageJump = document.getElementById('pageJump');
  pageLabel.addEventListener('click', function () {
    pageJump.value = currentN;
    pageJump.min = 1;
    pageLabel.classList.add('hidden');
    pageJump.classList.add('open');
    pageJump.focus();
    pageJump.select();
  });
  function closeJump() {
    pageJump.classList.remove('open');
    pageLabel.classList.remove('hidden');
  }
  pageJump.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var n = parseInt(pageJump.value, 10);
      closeJump();
      if (!isNaN(n) && n >= 1) {
        if (n > count) {
          // jumping past the end grows the book up to that page
          (function grow() {
            if (count >= n) { goToPage(n); return; }
            store.addPage().then(function (c) { count = c; grow(); });
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

  // ---------------------------------------------------------------
  // dock: swatches, sizes, eraser, undo, clear, open-as-image
  // ---------------------------------------------------------------
  var handle = document.getElementById('handle');
  var panel = document.getElementById('panel');
  var dock = document.getElementById('dock');

  function setOpen(open) {
    panel.classList.toggle('open', open);
    handle.classList.toggle('active', open);
    handle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  handle.addEventListener('click', function () { setOpen(!panel.classList.contains('open')); });
  document.addEventListener('pointerdown', function (e) {
    if (!panel.classList.contains('open')) return;
    if (dock.contains(e.target)) return;
    setOpen(false);
  });

  var swatchesEl = document.getElementById('swatches');
  var customColor = document.getElementById('customColor');
  function selectColor(hex, fromCustom) {
    tool.color = hex;
    tool.erasing = false;
    document.getElementById('eraserBtn').classList.remove('active');
    Array.prototype.forEach.call(swatchesEl.querySelectorAll('.swatch'), function (el) {
      el.classList.toggle('selected', !fromCustom && el.dataset.color === hex);
    });
  }
  PALETTE.forEach(function (hex) {
    var b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = hex;
    b.dataset.color = hex;
    b.title = hex;
    if (hex === tool.color) b.classList.add('selected');
    b.addEventListener('click', function () { selectColor(hex, false); });
    swatchesEl.appendChild(b);
  });
  customColor.addEventListener('input', function () { selectColor(customColor.value, true); });

  var sizesEl = document.getElementById('sizes');
  SIZES.forEach(function (px, i) {
    var b = document.createElement('button');
    b.className = 'size-btn' + (px === tool.size ? ' selected' : '');
    b.title = px + 'px';
    var dotSize = 5 + i * 4;
    b.innerHTML = '<span class="dot" style="width:' + dotSize + 'px;height:' + dotSize + 'px;"></span>';
    b.addEventListener('click', function () {
      tool.size = px;
      Array.prototype.forEach.call(sizesEl.querySelectorAll('.size-btn'), function (el) { el.classList.remove('selected'); });
      b.classList.add('selected');
    });
    sizesEl.appendChild(b);
  });

  var eraserBtn = document.getElementById('eraserBtn');
  eraserBtn.addEventListener('click', function () {
    tool.erasing = !tool.erasing;
    eraserBtn.classList.toggle('active', tool.erasing);
  });

  document.getElementById('undoBtn').addEventListener('click', undo);

  var clearBtn = document.getElementById('clearBtn');
  clearBtn.addEventListener('click', function () {
    if (!tool.clearArmed) {
      tool.clearArmed = true;
      clearBtn.classList.add('armed');
      toast('한 번 더 누르면 이 페이지가 전부 지워져요');
      clearTimeout(tool.clearTimer);
      tool.clearTimer = setTimeout(function () { tool.clearArmed = false; clearBtn.classList.remove('armed'); }, 3000);
      return;
    }
    clearTimeout(tool.clearTimer);
    tool.clearArmed = false;
    clearBtn.classList.remove('armed');
    serverStrokes = [];
    pendingLocal = [];
    renderAll();
    save();
    toast('지웠어요');
  });

  document.getElementById('openImgBtn').addEventListener('click', function () {
    try {
      var data = canvas.toDataURL('image/png');
      var win = window.open('', '_blank');
      if (win) {
        win.document.write('<title>내 그림</title><body style="margin:0;background:#1c1c1c;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="' + data + '" style="max-width:100%;max-height:100vh;" alt="내 그림" /></body>');
      } else {
        toast('팝업이 차단되었어요');
      }
    } catch (e) {
      toast('이미지를 여는 데 실패했어요');
    }
  });

  // ---------------------------------------------------------------
  // boot
  // ---------------------------------------------------------------
  function boot() {
    layout();
    var initial = 1;
    var hashN = parseInt((location.hash || '').replace('#', ''), 10);
    store.getMeta().then(function (c) {
      count = c;
      if (!isNaN(hashN) && hashN >= 1) initial = Math.min(hashN, count);
      updatePagerUI();
      goToPage(initial, { animate: false, force: true });
      store.subscribeMeta(function (c2) { count = Math.max(count, c2); updatePagerUI(); });
    });
  }

  function checkApi(ms) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(API_BASE + '/api/meta', ctrl ? { signal: ctrl.signal } : {})
      .then(function (res) { clearTimeout(timer); return res.ok; })
      .catch(function () { clearTimeout(timer); return false; });
  }

  function initApi() {
    checkApi(2500).then(function (reachable) {
      store = reachable ? makeApiStore() : makeLocalStore();
      if (!reachable) toast('서버에 연결할 수 없어 이 기기에만 저장돼요');
      boot();
    });
  }

  initApi();
})();
