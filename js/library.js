(function () {
  // Same server as sketchbook.html — see that file's app.js for the note
  // on changing this once deployed elsewhere.
  var API_BASE = 'https://sketchbook-api.onrender.com';

  const CATS = [
    { key: 'book', label: '책' },
    { key: 'anime', label: '애니' },
    { key: 'movie', label: '영화' },
  ];

  const PRESETS = {
    book: ["데미안","어린 왕자","1984","노르웨이의 숲","채식주의자","아몬드","82년생 김지영","위대한 개츠비","백년의 고독","죽고 싶지만 떡볶이는 먹고 싶어"],
    anime: ["신세계에서","너의 이름은","하울의 움직이는 성","이웃집 토토로","목소리의 형태","카우보이 비밥","강철의 연금술사","원펀맨","바람이 분다","마녀 배달부 키키"],
    movie: ["기생충","라라랜드","인터스텔라","이터널 선샤인","그랜드 부다페스트 호텔","500일의 썸머","리틀 포레스트","어바웃 타임","헤어질 결심","파리, 텍사스"],
  };

  let items = [];

  async function loadItems() {
    const res = await fetch(API_BASE + '/api/records');
    items = await res.json();
    renderTabs();
    renderList();
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ---------- tabs + list ---------- */
  let activeTab = 'all';
  let openId = null;

  const tabsEl = document.getElementById('tabs');
  const listEl = document.getElementById('list');

  function renderTabs() {
    const all = [{ key: 'all', label: '전체' }, ...CATS];
    tabsEl.innerHTML = '';
    all.forEach(t => {
      const count = t.key === 'all' ? items.length : items.filter(i => i.cat === t.key).length;
      const btn = document.createElement('button');
      btn.innerHTML = `${t.label}<span class="n">${count}</span>`;
      if (t.key === activeTab) btn.classList.add('active');
      btn.addEventListener('click', () => { activeTab = t.key; openId = null; renderTabs(); renderList(); });
      tabsEl.appendChild(btn);
    });
  }

  function ratingText(r) {
    r = r || 0;
    return '★' + r.toFixed(1);
  }

  function renderList() {
    document.getElementById('totalCount').textContent = items.length;
    const list = (activeTab === 'all' ? items : items.filter(i => i.cat === activeTab))
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    listEl.innerHTML = '';
    if (list.length === 0) {
      listEl.innerHTML = `<div class="empty">${activeTab === 'all' ? '아직 기록이 없어요.' : '이 항목엔 아직 기록이 없어요.'} 오른쪽 위 + 기록으로 추가해보세요.</div>`;
      return;
    }
    list.forEach(it => {
      const cat = CATS.find(c => c.key === it.cat);
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <span class="cat">${cat ? cat.label : ''}</span>
        <span class="title">${escapeHtml(it.title)}${it.creator ? `<span class="creator">${escapeHtml(it.creator)}</span>` : ''}</span>
        <span class="rating">${ratingText(it.rating)}</span>
        <span class="date">${it.date || ''}</span>
      `;
      row.addEventListener('click', () => {
        openId = (openId === it.id) ? null : it.id;
        renderList();
      });
      listEl.appendChild(row);

      if (openId === it.id) {
        const det = document.createElement('div');
        det.className = 'detail-row';
        det.innerHTML = `
          ${it.photo_url ? `<img class="thumb" src="${it.photo_url}">` : ''}
          <div class="body">
            <div class="memo ${it.memo ? '' : 'empty-memo'}">${it.memo ? escapeHtml(it.memo) : '남긴 감상이 없어요.'}</div>
            <div class="actions" id="actions-${it.id}">
              <span data-act="edit">고쳐 쓰기</span>
              <span data-act="delete">삭제</span>
            </div>
          </div>
        `;
        det.querySelector('[data-act="edit"]').addEventListener('click', (e) => { e.stopPropagation(); startEdit(it.id); });
        det.querySelector('[data-act="delete"]').addEventListener('click', (e) => {
          e.stopPropagation();
          const actionsEl = det.querySelector(`#actions-${it.id}`);
          actionsEl.innerHTML = `
            <span style="color:var(--accent);">정말 삭제할까요?</span>
            <span data-act="confirm-delete">예, 삭제</span>
            <span data-act="cancel-delete">아니오</span>
          `;
          actionsEl.querySelector('[data-act="confirm-delete"]').addEventListener('click', (ev) => {
            ev.stopPropagation();
            deleteItem(it.id);
          });
          actionsEl.querySelector('[data-act="cancel-delete"]').addEventListener('click', (ev) => {
            ev.stopPropagation();
            renderList();
          });
        });
        listEl.appendChild(det);
      }
    });
  }

  async function deleteItem(id) {
    await fetch(API_BASE + '/api/records/' + id, { method: 'DELETE' });
    openId = null;
    await loadItems();
  }

  /* ---------- modal ---------- */
  const overlay = document.getElementById('overlay');
  const catTabsEl = document.getElementById('catTabs');
  const presetListEl = document.getElementById('presetList');
  const fTitle = document.getElementById('fTitle');
  const fCreator = document.getElementById('fCreator');
  const fMemo = document.getElementById('fMemo');
  const starPicker = document.getElementById('starPicker');
  const fPhoto = document.getElementById('fPhoto');
  const photoPreview = document.getElementById('photoPreview');
  const removePhotoBtn = document.getElementById('removePhoto');
  const photoDrop = document.getElementById('photoDrop');
  const photoDropText = document.getElementById('photoDropText');
  const saveBtn = document.getElementById('saveBtn');

  let currentCat = 'book';
  let currentRating = 0;
  let editingId = null;
  // currentPhotoFile: a newly picked File waiting to be uploaded on save.
  // currentPhotoUrl: the photo_url already on the server (editing) or null.
  // Together they cover the three save-time cases: keep, replace, remove.
  let currentPhotoFile = null;
  let currentPhotoUrl = null;

  CATS.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat.label;
    btn.dataset.key = cat.key;
    if (cat.key === currentCat) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentCat = cat.key;
      [...catTabsEl.children].forEach(b => b.classList.toggle('active', b.dataset.key === cat.key));
      renderPresetList(fTitle.value.trim());
    });
    catTabsEl.appendChild(btn);
  });

  function renderPresetList(filter = '') {
    presetListEl.innerHTML = '';
    if (!filter) { presetListEl.style.display = 'none'; return; }
    const list = (PRESETS[currentCat] || []).filter(t => t.toLowerCase().includes(filter.toLowerCase()));
    if (list.length === 0) { presetListEl.style.display = 'none'; return; }
    presetListEl.style.display = 'block';
    list.forEach(title => {
      const el = document.createElement('div');
      el.className = 'preset-item';
      el.textContent = title;
      el.addEventListener('click', () => { fTitle.value = title; presetListEl.style.display = 'none'; });
      presetListEl.appendChild(el);
    });
  }
  fTitle.addEventListener('input', () => renderPresetList(fTitle.value.trim()));
  fTitle.addEventListener('focus', () => { if (fTitle.value.trim()) renderPresetList(fTitle.value.trim()); });
  document.addEventListener('click', (e) => {
    if (e.target !== fTitle && !presetListEl.contains(e.target)) presetListEl.style.display = 'none';
  });

  /* stars (0.5 unit, SVG-based) */
  const STAR_PATH = 'M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 19.771l-7.416 3.642 1.48-8.279L0 9.306l8.332-1.151z';
  function starSvg() { return `<svg viewBox="0 0 24 24"><path d="${STAR_PATH}"></path></svg>`; }
  function buildStarsMarkup() {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<div class="star" data-i="${i}"><span class="bg">${starSvg()}</span><span class="fg">${starSvg()}</span></div>`;
    }
    return html;
  }
  starPicker.innerHTML = buildStarsMarkup();
  starPicker.querySelectorAll('.star').forEach(s => {
    s.addEventListener('click', (e) => {
      const rect = s.getBoundingClientRect();
      const isHalf = (e.clientX - rect.left) < rect.width / 2;
      const i = parseInt(s.dataset.i);
      currentRating = isHalf ? i - 0.5 : i;
      updateStars();
    });
  });
  function updateStars() {
    starPicker.querySelectorAll('.star').forEach(s => {
      const i = parseInt(s.dataset.i);
      const fg = s.querySelector('.fg');
      let pct = 0;
      if (currentRating >= i) pct = 100;
      else if (currentRating >= i - 0.5) pct = 50;
      fg.style.width = pct + '%';
    });
  }

  /* photo: FileReader only drives the in-modal preview. The actual upload
     to S3 happens in saveRecord(), and only if the user picked a new
     file — editing without touching the photo field must not re-upload. */
  function handlePhotoFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    currentPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreview.src = e.target.result;
      photoPreview.style.display = 'block';
      removePhotoBtn.style.display = 'inline-block';
      photoDropText.textContent = file.name;
    };
    reader.readAsDataURL(file);
  }
  fPhoto.addEventListener('change', () => handlePhotoFile(fPhoto.files[0]));
  ['dragenter', 'dragover'].forEach(evt => {
    photoDrop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); photoDrop.classList.add('dragging'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    photoDrop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); photoDrop.classList.remove('dragging'); });
  });
  photoDrop.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handlePhotoFile(file);
  });
  removePhotoBtn.addEventListener('click', () => {
    currentPhotoFile = null;
    currentPhotoUrl = null;
    fPhoto.value = '';
    photoPreview.style.display = 'none';
    removePhotoBtn.style.display = 'none';
    photoDropText.textContent = '드래그하거나 클릭해서 선택';
  });

  function openModal() {
    editingId = null;
    document.getElementById('titleError').style.display = 'none';
    document.getElementById('modalTitle').textContent = '새로운 기록';
    currentCat = 'book';
    currentRating = 0;
    [...catTabsEl.children].forEach(b => b.classList.toggle('active', b.dataset.key === currentCat));
    fTitle.value = '';
    fCreator.value = '';
    fMemo.value = '';
    currentPhotoFile = null;
    currentPhotoUrl = null;
    fPhoto.value = '';
    photoPreview.style.display = 'none';
    removePhotoBtn.style.display = 'none';
    photoDropText.textContent = '드래그하거나 클릭해서 선택';
    updateStars();
    presetListEl.style.display = 'none';
    overlay.classList.add('open');
  }
  document.getElementById('addTabBtn').addEventListener('click', openModal);
  document.getElementById('cancelBtn').addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

  async function saveRecord() {
    const title = fTitle.value.trim();
    if (!title) { document.getElementById('titleError').style.display = 'block'; fTitle.focus(); return; }
    document.getElementById('titleError').style.display = 'none';

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중…';
    try {
      let photo_url = currentPhotoUrl;
      if (currentPhotoFile) {
        const form = new FormData();
        form.append('file', currentPhotoFile);
        const res = await fetch(API_BASE + '/api/uploads', { method: 'POST', body: form });
        if (!res.ok) throw new Error('photo upload failed');
        photo_url = (await res.json()).url;
      }

      const body = {
        cat: currentCat,
        title,
        creator: fCreator.value.trim(),
        rating: currentRating,
        memo: fMemo.value.trim(),
        photo_url,
      };

      const url = editingId ? `${API_BASE}/api/records/${editingId}` : `${API_BASE}/api/records`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');

      await loadItems();
      overlay.classList.remove('open');
    } catch (err) {
      alert('저장에 실패했어요. 잠시 후 다시 시도해주세요.');
      console.error(err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  }
  saveBtn.addEventListener('click', saveRecord);

  function startEdit(id) {
    const it = items.find(x => x.id === id);
    if (!it) return;
    document.getElementById('titleError').style.display = 'none';
    editingId = it.id;
    document.getElementById('modalTitle').textContent = '기록 고쳐 쓰기';
    currentCat = it.cat;
    currentRating = it.rating || 0;
    [...catTabsEl.children].forEach(b => b.classList.toggle('active', b.dataset.key === currentCat));
    fTitle.value = it.title;
    fCreator.value = it.creator || '';
    fMemo.value = it.memo || '';
    currentPhotoFile = null;
    currentPhotoUrl = it.photo_url || null;
    fPhoto.value = '';
    if (currentPhotoUrl) {
      photoPreview.src = currentPhotoUrl;
      photoPreview.style.display = 'block';
      removePhotoBtn.style.display = 'inline-block';
      photoDropText.textContent = '새 사진으로 바꾸려면 클릭';
    } else {
      photoPreview.style.display = 'none';
      removePhotoBtn.style.display = 'none';
      photoDropText.textContent = '드래그하거나 클릭해서 선택';
    }
    updateStars();
    presetListEl.style.display = 'none';
    overlay.classList.add('open');
  }

  loadItems();
})();
