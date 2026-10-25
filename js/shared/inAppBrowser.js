// 카톡·인스타 등에 링크를 올렸을 때 열리는 "앱 안 브라우저(웹뷰)" 대응.
// 웹뷰에선 구글이 로그인을 막고(403 disallowed_useragent), localStorage도
// 크롬·사파리와 따로라서 여기서 만든 방은 나중에 브라우저로 열면 안 보임.
//   - 카톡: 카톡이 제공하는 주소(kakaotalk://web/openExternal)로 바로 바깥
//     브라우저를 염.
//   - 그 밖의 앱: 화면 아래에 안내 띠를 띄움. 안드로이드는 크롬으로 여는 버튼,
//     아이폰은 앱 메뉴에서 여는 방법 + 링크 복사.
//
// feedback.js처럼 각 html이 <script type="module">로 따로 불러옴 — 페이지
// 본체(main.js)보다 앞에 둬서 방을 만들기 전에 카톡 이동부터 시도함.
import { copyToClipboard } from './dom.js';

const DISMISS_KEY = 'untitled-canvas.inapp-dismissed';
const AUTO_KEY = 'untitled-canvas.inapp-auto-opened';

// 'kakao' | 'other' | null. UA 문자열만 보고 판단함(앱마다 붙이는 표식).
export function detectInApp(ua) {
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|; wv\)/i.test(ua)) return 'other';
  return null;
}

export function isInAppBrowser() {
  return detectInApp(navigator.userAgent) !== null;
}

export function isAndroid(ua) {
  return /Android/i.test(ua);
}

export function kakaoExternalUrl(href) {
  return 'kakaotalk://web/openExternal?url=' + encodeURIComponent(href);
}

// 안드로이드 크롬을 직접 여는 intent 주소. 크롬이 없으면 S.browser_fallback_url로
// 원래 주소가 다시 열림(그땐 결국 같은 웹뷰지만 깨진 화면은 안 뜸). 주소의
// #은 intent의 #Intent와 겹쳐서 뺌(이 사이트 주소엔 원래 안 씀).
export function androidChromeUrl(href) {
  const url = new URL(href);
  const rest = url.host + url.pathname + url.search;
  return `intent://${rest}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}

function dismissed() {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
}

// 처음 부르면 false를 돌려주고 "시도함"으로 적어둠.
function autoTried() {
  try {
    if (sessionStorage.getItem(AUTO_KEY) === '1') return true;
    sessionStorage.setItem(AUTO_KEY, '1');
  } catch (e) {}
  return false;
}

function renderBanner(kind, ua, href, go) {
  const bar = document.createElement('div');
  bar.className = 'inapp-banner';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', '브라우저 안내');
  const android = isAndroid(ua);
  let action;
  if (kind === 'kakao') action = '<button type="button" class="inapp-open">브라우저로 열기</button>';
  else if (android) action = '<button type="button" class="inapp-open">크롬으로 열기</button>';
  else action = '<button type="button" class="inapp-copy">링크 복사</button>';
  const how = kind !== 'kakao' && !android
    ? '<p class="inapp-how">오른쪽 위(또는 아래) <b>⋯</b> 메뉴에서 <b>"외부 브라우저로 열기"</b>나 <b>"Safari로 열기"</b>를 눌러주세요.</p>'
    : '';
  bar.innerHTML = `
    <div class="inapp-text">
      <p><b>앱 안 브라우저에서 열렸어요.</b> 여기서는 구글 계정 연결이 안 되고, 만든 방도 이 앱 안에만 남아요. 크롬·사파리로 열어주세요.</p>
      ${how}
    </div>
    <div class="inapp-actions">
      ${action}
      <button type="button" class="inapp-close" aria-label="안내 닫기">여기서 볼게요</button>
    </div>`;

  const openBtn = bar.querySelector('.inapp-open');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      go(kind === 'kakao' ? kakaoExternalUrl(href) : androidChromeUrl(href));
    });
  }
  const copyBtn = bar.querySelector('.inapp-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      copyToClipboard(href)
        .then(() => { copyBtn.textContent = '복사됨 — 사파리에 붙여넣기'; })
        .catch(() => {});
    });
  }
  bar.querySelector('.inapp-close').addEventListener('click', () => {
    bar.remove();
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
  });
  document.body.prepend(bar);
}

// 인자는 테스트용(jsdom에선 location을 바꿔 끼울 수 없어서) — 페이지에선
// 아래에서 기본값 그대로 한 번 부름.
export function initInAppBrowser({
  ua = navigator.userAgent,
  href = location.href,
  go = (url) => { location.href = url; },
} = {}) {
  const kind = detectInApp(ua);
  if (!kind) return;
  // 카톡은 바로 바깥 브라우저로 넘김. 카톡 웹뷰는 이 페이지에 그대로 남으니,
  // 넘어가지 않았을 때(구버전 카톡 등)를 위해 안내 띠도 같이 띄움. 자동
  // 이동은 세션당 한 번만 — 웹뷰에서 계속 보기로 한 사람이 페이지를 옮길
  // 때마다 브라우저가 또 열리면 곤란함.
  if (kind === 'kakao' && !autoTried()) go(kakaoExternalUrl(href));
  if (!dismissed()) renderBanner(kind, ua, href, go);
}

initInAppBrowser();
