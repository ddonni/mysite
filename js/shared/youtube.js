// 음악 기록의 유튜브 주소(listen_url) 다루기 — 주소 읽기·검사와 화면 구석의 작은 플레이어.
//
// 주소는 두 가지:
//   - 영상 주소(watch?v=…, youtu.be/…, shorts/…) — 사용자가 직접 붙여 넣은 것.
//   - 앨범 재생목록 + 몇 번째 곡(playlist?list=OLAK5uy_…&index=3) — 검색 결과에서 고르면 백엔드가
//     만들어 줌(music_search.listen_url). 로그인 없는 유튜브 뮤직은 노래마다의 영상 번호를 안
//     줘서 앨범 재생목록으로 틂 — 그 곡부터 틀고, 다음 곡으로 넘어가면 멈춤.
// 플레이어는 유튜브 공식 임베드(IFrame Player API). 약관상 화면을 숨기고 소리만 틀 수는 없어서
// 영상이 보이는 작은 창으로 띄움(최소 200×200). 광고는 영상 주인이 켰으면 나옴.
//
// 백엔드 schemas.is_youtube_url과 같은 규칙.
const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
const ID = /^[A-Za-z0-9_-]{6,64}$/;

function parse(url) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  if (u.protocol !== 'https:') return null;
  let videoId = null;
  if (u.hostname === 'youtu.be') videoId = u.pathname.slice(1);
  else if (HOSTS.includes(u.hostname)) {
    videoId = u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.slice(8) : null);
  } else return null;
  if (videoId && ID.test(videoId)) return { videoId };
  const list = HOSTS.includes(u.hostname) ? u.searchParams.get('list') : null;
  if (list && ID.test(list)) {
    const n = parseInt(u.searchParams.get('index'), 10);
    return { list, index: n > 0 ? n - 1 : 0 }; // 주소의 index는 1부터, 플레이어는 0부터
  }
  return null;
}

// 저장된 주소 → { videoId } 또는 { list, index(0부터) }. 유튜브 주소가 아니면 null.
export function parseYouTube(url) {
  return url ? parse(String(url).trim()) : null;
}

// 사용자가 칸에 쓴 값 → 저장할 주소. "youtu.be/…"처럼 https://를 빼고 써도, http여도 받아 줌.
// 유튜브 주소가 아니면 null.
export function normalizeYouTube(input) {
  let v = String(input || '').trim();
  if (!v) return null;
  if (/^http:\/\//i.test(v)) v = 'https://' + v.slice(7);
  else if (!/^[a-z]+:\/\//i.test(v)) v = 'https://' + v;
  return parse(v) ? v : null;
}

// ---- 플레이어 ----
let apiReady = null;
function loadApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!apiReady) {
    apiReady = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiReady = null; reject(new Error('youtube api failed')); };
      document.head.appendChild(s);
    });
  }
  return apiReady;
}

// 퍼가기를 막은 영상(101·150), 없어진 영상(100) — 유튜브에서 직접 열라고 안내.
const BLOCKED = new Set([100, 101, 150]);

let shared = null;

// 페이지마다 하나. play({ title, creator, listen_url })로 띄우고, 다른 곡을 누르면 바꿔 틂.
// onChange(fn): 트는 곡이 바뀔 때마다 fn(곡 또는 null) — 끝까지 들었거나 닫으면 null.
// 로비 턴테이블의 ▶/■ 버튼이 이걸로 모양을 바꿈.
// where: 'bottom'(기본) 또는 'top'(로비 — 아래쪽엔 카테고리 버튼·카드가 있어서).
export function getPlayer({ where = 'bottom' } = {}) {
  if (shared) return shared;
  const box = document.createElement('div');
  box.className = `mini-player mini-player-${where}`;
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', '음악 플레이어');
  box.hidden = true;
  box.innerHTML = `
    <div class="mp-head">
      <div class="mp-text"><b class="mp-title"></b><span class="mp-creator"></span></div>
      <button type="button" class="mp-close" aria-label="플레이어 닫기">×</button>
    </div>
    <div class="mp-frame"><div class="mp-slot"></div></div>
    <p class="mp-msg" hidden></p>
    <a class="mp-out" target="_blank" rel="noopener noreferrer">유튜브에서 열기 ↗</a>`;
  document.body.appendChild(box);
  const titleEl = box.querySelector('.mp-title');
  const creatorEl = box.querySelector('.mp-creator');
  const frame = box.querySelector('.mp-frame');
  const msg = box.querySelector('.mp-msg');
  const out = box.querySelector('.mp-out');
  let player = null;
  let session = 0;
  let current = null;
  const listeners = [];
  function setCurrent(record) {
    current = record;
    listeners.forEach((fn) => fn(record));
  }

  function say(text) {
    msg.textContent = text || '';
    msg.hidden = !text;
  }

  function stop() {
    session++;
    if (player) { try { player.destroy(); } catch (e) { /* 이미 없어짐 */ } }
    player = null;
    frame.innerHTML = '<div class="mp-slot"></div>';
  }

  function close() {
    stop();
    box.hidden = true;
    if (current) setCurrent(null);
  }
  box.querySelector('.mp-close').addEventListener('click', close);

  function play(record) {
    const target = parseYouTube(record && record.listen_url);
    if (!target) return false;
    stop();
    const mine = session;
    titleEl.textContent = record.title || '';
    creatorEl.textContent = record.creator || '';
    out.href = record.listen_url;
    say('');
    box.hidden = false;
    setCurrent(record);
    loadApi().then((YT) => {
      if (mine !== session) return;
      let started = false;
      player = new YT.Player(frame.querySelector('.mp-slot'), {
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (e) => {
            if (target.videoId) e.target.loadVideoById(target.videoId);
            else e.target.loadPlaylist({ list: target.list, listType: 'playlist', index: target.index });
          },
          // 앨범 재생목록은 그 곡이 끝나면 다음 곡으로 넘어감 — 한 곡만 틀고 멈춤.
          onStateChange: (e) => {
            const done = () => {
              say('다 들었어요.');
              if (mine === session && current) setCurrent(null);
            };
            if (!target.list || typeof e.target.getPlaylistIndex !== 'function') {
              if (e.data === 0) done(); // 0 = 끝남
              return;
            }
            const at = e.target.getPlaylistIndex();
            if (at === target.index) started = true;
            else if (started && at > target.index) {
              e.target.stopVideo();
              done();
            }
          },
          onError: (e) => {
            say(BLOCKED.has(e.data)
              ? '이 곡은 여기서 못 틀어요 — 아래 "유튜브에서 열기"로 들어 주세요.'
              : '재생이 안 돼요 — 아래 "유튜브에서 열기"로 들어 주세요.');
          },
        },
      });
    }).catch(() => {
      if (mine === session) say('유튜브 플레이어를 못 불러왔어요 — 아래 "유튜브에서 열기"로 들어 주세요.');
    });
    return true;
  }

  shared = {
    play,
    close,
    el: box,
    current: () => current,
    onChange(fn) { listeners.push(fn); },
  };
  return shared;
}

// 테스트용 — 페이지마다 하나인 플레이어를 지움.
export function resetPlayerForTest() {
  if (shared) shared.el.remove();
  shared = null;
  apiReady = null;
}
