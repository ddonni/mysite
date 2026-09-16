(function () {
  "use strict";

  var PAGES = { sketchbook: 'sketchbook.html', library: 'library.html' };

  function webglAvailable() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  if (typeof THREE === 'undefined' || !webglAvailable()) {
    document.body.classList.add('no-3d');
    return;
  }

  try {
    initLobby();
  } catch (e) {
    document.body.classList.add('no-3d');
    console.error('lobby init failed', e);
  }

  function initLobby() {
    var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

    var canvas = document.getElementById('canvas3d');
    var stage = document.getElementById('stage');
    var ui = document.getElementById('ui');
    var loading = document.getElementById('loading');
    var hint = document.getElementById('hint');
    var card = document.getElementById('card');
    var cardTitle = document.getElementById('cardTitle');
    var cardBody = document.getElementById('cardBody');
    var cardBack = document.getElementById('cardBack');
    var cardEnter = document.getElementById('cardEnter');
    var ctaBtns = Array.prototype.slice.call(document.querySelectorAll('.room-btn'));

    var ROOM_INFO = {
      sketchbook: {
        title: '스케치북',
        body: '번호 매긴 페이지를 넘기며 자유롭게 그리는 캔버스 방이에요.'
      },
      library: {
        title: '기록 보관소',
        body: '읽고 본 책·애니·영화를 기록하는 방이에요.'
      }
    };

    // ---------- renderer / scene / camera ----------
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var VOID = 0x120f0c;
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(VOID);
    scene.fog = new THREE.Fog(VOID, 7, 17);

    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    // ---------- helpers ----------
    function makeCanvasTexture(draw, w, h) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      draw(ctx, w, h);
      var tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }

    function aoBlob(radius) {
      var tex = makeCanvasTexture(function (ctx, w, h) {
        var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(0,0,0,0.55)');
        g.addColorStop(0.7, 'rgba(0,0,0,0.25)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }, 256, 256);
      var geo = new THREE.CircleGeometry(radius, 32);
      var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.012;
      return mesh;
    }

    function labelSprite(text, colorHex) {
      var tex = makeCanvasTexture(function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);
        var r = 26;
        ctx.fillStyle = 'rgba(18,15,12,0.62)';
        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r, h * 0.5 - 32);
        ctx.arcTo(w - 8, h * 0.5 - 32, w - 8, h * 0.5 + 32, r);
        ctx.arcTo(w - 8, h * 0.5 + 32, 8, h * 0.5 + 32, r);
        ctx.arcTo(8, h * 0.5 + 32, 8, h * 0.5 - 32, r);
        ctx.arcTo(8, h * 0.5 - 32, w - 8, h * 0.5 - 32, r);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f3ece0';
        ctx.font = '600 40px Manrope, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h * 0.5 + 2);
      }, 512, 160);
      var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      var sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.9, 0.6, 1);
      return sprite;
    }

    // ---------- room shell ----------
    var room = new THREE.Group();
    scene.add(room);

    var FLOOR_W = 9, FLOOR_D = 6.6, WALL_H = 4.1;
    var floorGroup = new THREE.Group();
    var plankCount = 16, plankW = FLOOR_W / plankCount;
    for (var i = 0; i < plankCount; i++) {
      var shade = (i % 2 === 0) ? 0x2a2016 : 0x251c13;
      var plank = new THREE.Mesh(
        new THREE.BoxGeometry(plankW * 0.96, 0.05, FLOOR_D),
        new THREE.MeshStandardMaterial({ color: shade, roughness: 0.9, metalness: 0.02 })
      );
      plank.position.set(-FLOOR_W / 2 + plankW * (i + 0.5), -0.025, 0);
      plank.receiveShadow = true;
      floorGroup.add(plank);
    }
    room.add(floorGroup);

    var wallMat = new THREE.MeshStandardMaterial({ color: 0xcdbfa4, roughness: 0.95 });
    var backWall = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, WALL_H, 0.12), wallMat);
    backWall.position.set(0, WALL_H / 2, -FLOOR_D / 2);
    backWall.receiveShadow = true;
    room.add(backWall);

    var leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, WALL_H, FLOOR_D), wallMat);
    leftWall.position.set(-FLOOR_W / 2, WALL_H / 2, 0);
    leftWall.receiveShadow = true;
    room.add(leftWall);

    var baseMat = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.8 });
    var baseBack = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 0.16, 0.14), baseMat);
    baseBack.position.set(0, 0.08, -FLOOR_D / 2 + 0.05);
    room.add(baseBack);
    var baseLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, FLOOR_D), baseMat);
    baseLeft.position.set(-FLOOR_W / 2 + 0.05, 0.08, 0);
    room.add(baseLeft);

    var rug = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.7, 0.03, 40),
      new THREE.MeshStandardMaterial({ color: 0x5a2e22, roughness: 0.95 })
    );
    rug.position.set(-0.4, 0.015, 1.3);
    rug.receiveShadow = true;
    room.add(rug);

    // ---------- sketchbook room: easel + stool ----------
    var easel = new THREE.Group();
    easel.userData.room = 'sketchbook';
    var legMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.7 });

    function easelLeg(x, z, tiltZ, tiltX) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 8), legMat);
      leg.position.set(x, 0.95, z);
      leg.rotation.z = tiltZ || 0;
      leg.rotation.x = tiltX || 0;
      leg.castShadow = true;
      return leg;
    }
    easel.add(easelLeg(-0.34, 0.18, 0.16, 0));
    easel.add(easelLeg(0.34, 0.18, -0.16, 0));
    easel.add(easelLeg(0, -0.32, 0, -0.22));

    var boardTex = makeCanvasTexture(function (ctx, w, h) {
      ctx.fillStyle = '#efe6d4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#d9793a';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(20, h * 0.7); ctx.quadraticCurveTo(w * 0.35, h * 0.25, w * 0.55, h * 0.5); ctx.quadraticCurveTo(w * 0.7, h * 0.68, w - 20, h * 0.3); ctx.stroke();
      ctx.strokeStyle = '#c79a4b';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(30, h * 0.85); ctx.quadraticCurveTo(w * 0.5, h * 0.95, w - 30, h * 0.8); ctx.stroke();
    }, 200, 260);
    var boardSideMat = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.8 });
    var board = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.3, 0.04),
      [boardSideMat, boardSideMat, boardSideMat, boardSideMat,
        new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), boardSideMat]
    );
    board.position.set(0, 1.35, 0.05);
    board.rotation.x = -0.12;
    board.castShadow = true;
    easel.add(board);

    var stool = new THREE.Group();
    var seat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.07, 16), legMat);
    seat.position.y = 0.5; seat.castShadow = true;
    stool.add(seat);
    [[-0.18, -0.18], [0.18, -0.18], [0, 0.2]].forEach(function (p) {
      var l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), legMat);
      l.position.set(p[0], 0.25, p[1]);
      l.castShadow = true;
      stool.add(l);
    });
    stool.position.set(0.75, 0, 0.55);
    easel.add(stool);

    easel.add(aoBlob(1.15));
    var emberLabel = labelSprite('스케치북', '#d9793a');
    emberLabel.position.set(0, 2.35, 0);
    easel.add(emberLabel);

    easel.position.set(-2.9, 0, -0.5);
    easel.rotation.y = 0.5;
    room.add(easel);

    var emberLight = new THREE.PointLight(0xd9793a, 1.1, 5.5, 2);
    emberLight.position.set(-2.6, 1.9, 0.2);
    room.add(emberLight);

    // ---------- library room: bookshelf ----------
    var shelf = new THREE.Group();
    shelf.userData.room = 'library';
    var caseMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.75 });
    var SW = 2.15, SH = 2.5, SD = 0.36;

    var back = new THREE.Mesh(new THREE.BoxGeometry(SW, SH, 0.04), caseMat);
    back.position.set(0, SH / 2, -SD / 2);
    shelf.add(back);
    [-SW / 2, SW / 2].forEach(function (x) {
      var side = new THREE.Mesh(new THREE.BoxGeometry(0.05, SH, SD), caseMat);
      side.position.set(x, SH / 2, 0);
      side.castShadow = true;
      shelf.add(side);
    });
    [0, SH * 0.34, SH * 0.67, SH].forEach(function (y) {
      var board2 = new THREE.Mesh(new THREE.BoxGeometry(SW, 0.05, SD), caseMat);
      board2.position.set(0, y, 0);
      board2.castShadow = true; board2.receiveShadow = true;
      shelf.add(board2);
    });

    var bookColors = [0x8a3a2e, 0xc79a4b, 0x2f4a45, 0x5a3d24, 0x9c5b3c, 0x38343a, 0xb0673f];
    var shelfYs = [0.09, SH * 0.34 + 0.09, SH * 0.67 + 0.09];
    shelfYs.forEach(function (y) {
      var x = -SW / 2 + 0.14;
      var guard = 0;
      while (x < SW / 2 - 0.14 && guard < 40) {
        guard++;
        var bw = 0.07 + Math.random() * 0.05;
        var bh = 0.32 + Math.random() * 0.16;
        var bd = SD - 0.1;
        var col = bookColors[Math.floor(Math.random() * bookColors.length)];
        var book = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, bd),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })
        );
        book.position.set(x + bw / 2, y + bh / 2, 0);
        book.rotation.y = (Math.random() - 0.5) * 0.05;
        book.castShadow = true; book.receiveShadow = true;
        shelf.add(book);
        x += bw + 0.012;
      }
    });

    shelf.add(aoBlob(1.4));
    var goldLabel = labelSprite('기록 보관소', '#c79a4b');
    goldLabel.position.set(0, SH + 0.5, 0);
    shelf.add(goldLabel);

    shelf.position.set(1.9, 0, -FLOOR_D / 2 + SD / 2 + 0.06);
    room.add(shelf);

    var goldLight = new THREE.PointLight(0xc79a4b, 1.0, 6, 2);
    goldLight.position.set(1.9, 2.4, -1.9);
    room.add(goldLight);

    // ---------- lighting ----------
    var hemi = new THREE.HemisphereLight(0x3a2c1e, 0x0a0806, 0.55);
    scene.add(hemi);

    var spot = new THREE.SpotLight(0xfff1de, 3.2, 18, 0.62, 0.55, 1.4);
    spot.position.set(0.5, 6.4, 3.2);
    spot.target.position.set(-0.4, 0.3, -0.8);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 2;
    spot.shadow.camera.far = 14;
    scene.add(spot, spot.target);

    // dust motes in the light beam
    var moteCount = 46;
    var motePos = new Float32Array(moteCount * 3);
    for (var m = 0; m < moteCount; m++) {
      motePos[m * 3] = -3 + Math.random() * 6;
      motePos[m * 3 + 1] = 0.3 + Math.random() * 3.4;
      motePos[m * 3 + 2] = -3 + Math.random() * 5.5;
    }
    var moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    var motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
      color: 0xf3ece0, size: 0.02, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(motes);

    // ---------- camera orbit (custom) ----------
    var target = new THREE.Vector3(-0.3, 1.0, -0.9);
    var spherical = { radius: 9.2, theta: 0.62, phi: 1.12 };
    var wantSpherical = { radius: spherical.radius, theta: spherical.theta, phi: spherical.phi };
    var MIN_R = 4.5, MAX_R = 13, MIN_PHI = 0.55, MAX_PHI = 1.5;

    var dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0, moved = false;
    var idleT = 0, AUTOROTATE_DELAY = 3.2;
    var entered = null; // 'sketchbook' | 'library' | null

    function updateCameraFromSpherical() {
      var s = spherical;
      camera.position.set(
        target.x + s.radius * Math.sin(s.phi) * Math.sin(s.theta),
        target.y + s.radius * Math.cos(s.phi),
        target.z + s.radius * Math.sin(s.phi) * Math.cos(s.theta)
      );
      camera.lookAt(target);
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (entered) return;
      dragging = true; moved = false;
      lastX = downX = e.clientX; lastY = downY = e.clientY; downT = performance.now();
      canvas.classList.add('dragging');
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (dragging) {
        var dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) moved = true;
        wantSpherical.theta -= dx * 0.0055;
        wantSpherical.phi = Math.min(MAX_PHI, Math.max(MIN_PHI, wantSpherical.phi - dy * 0.004));
        idleT = 0;
        hideHint();
      } else if (!entered) {
        checkHover(e);
      }
    });
    window.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove('dragging');
      if (!moved && performance.now() - downT < 450) {
        handleClick(e);
      }
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      wantSpherical.radius = Math.min(MAX_R, Math.max(MIN_R, wantSpherical.radius + e.deltaY * 0.012));
      idleT = 0;
    }, { passive: false });

    var raycaster = new THREE.Raycaster();
    var mouseNDC = new THREE.Vector2();
    function setNDC(e) {
      var r = canvas.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    }
    function roomOf(obj) {
      var o = obj;
      while (o) { if (o.userData && o.userData.room) return o.userData.room; o = o.parent; }
      return null;
    }
    function checkHover(e) {
      setNDC(e);
      raycaster.setFromCamera(mouseNDC, camera);
      var hits = raycaster.intersectObjects([easel, shelf], true);
      canvas.classList.toggle('hover', hits.length > 0);
    }
    function handleClick(e) {
      setNDC(e);
      raycaster.setFromCamera(mouseNDC, camera);
      var hits = raycaster.intersectObjects([easel, shelf], true);
      if (hits.length) {
        var r = roomOf(hits[0].object);
        if (r) enterRoom(r);
      }
    }

    var FOCUS = {
      sketchbook: { theta: 0.95, phi: 1.05, radius: 4.6, target: new THREE.Vector3(-2.9, 1.1, -0.5) },
      library: { theta: 0.25, phi: 1.0, radius: 4.8, target: new THREE.Vector3(1.9, 1.1, -2.6) }
    };
    var HOME = { theta: 0.62, phi: 1.12, radius: 9.2, target: new THREE.Vector3(-0.3, 1.0, -0.9) };

    function setCTAState(r) {
      ctaBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.room === r)); });
    }

    function enterRoom(r) {
      entered = r;
      var f = FOCUS[r];
      wantSpherical.theta = f.theta; wantSpherical.phi = f.phi; wantSpherical.radius = f.radius;
      target.copy(f.target);
      var info = ROOM_INFO[r];
      card.setAttribute('data-room', r);
      cardTitle.textContent = info.title;
      cardBody.textContent = info.body;
      card.classList.add('show');
      setCTAState(r);
      hideHint();
    }
    function leaveRoom() {
      entered = null;
      wantSpherical.theta = HOME.theta; wantSpherical.phi = HOME.phi; wantSpherical.radius = HOME.radius;
      target.copy(HOME.target);
      card.classList.remove('show');
      setCTAState(null);
    }
    function goToRoom(r) {
      stage.style.opacity = '0';
      ui.style.opacity = '0';
      setTimeout(function () { window.location.href = PAGES[r]; }, 320);
    }

    cardBack.addEventListener('click', leaveRoom);
    cardEnter.addEventListener('click', function () {
      goToRoom(card.getAttribute('data-room'));
    });
    ctaBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (entered === b.dataset.room) leaveRoom();
        else enterRoom(b.dataset.room);
      });
    });

    var hintHidden = false;
    function hideHint() {
      if (hintHidden) return;
      hintHidden = true;
      hint.classList.add('gone');
    }

    // ---------- render loop ----------
    var lastFrame = performance.now();
    function tick(now) {
      var dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      requestAnimationFrame(tick);

      if (!dragging && !entered && !REDUCED) {
        idleT += dt;
        if (idleT > AUTOROTATE_DELAY) wantSpherical.theta += dt * 0.06;
      }

      var damp = REDUCED ? 1 : 0.09;
      spherical.theta += (wantSpherical.theta - spherical.theta) * damp;
      spherical.phi += (wantSpherical.phi - spherical.phi) * damp;
      spherical.radius += (wantSpherical.radius - spherical.radius) * damp;
      updateCameraFromSpherical();

      var mp = motes.geometry.attributes.position.array;
      for (var i = 0; i < moteCount; i++) {
        mp[i * 3 + 1] += dt * 0.05;
        if (mp[i * 3 + 1] > 3.8) mp[i * 3 + 1] = 0.3;
      }
      motes.geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    }

    resize();
    updateCameraFromSpherical();
    requestAnimationFrame(tick);
    requestAnimationFrame(function () { loading.classList.add('hide'); });
  }
})();
