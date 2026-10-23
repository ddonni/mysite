// "SNS에 공유" — 로비 헤더의 공유 버튼과 공유 창.
// 버튼을 누르면 지금 카메라에 보이는 3D 방을 사진 한 장으로 찍고(아래쪽에 방
// 이름과 사이트 주소를 얹음), 그 사진 + 방 링크(?room=코드)를 공유함.
// 공유처는 인스타그램 하나 — 인스타그램은 X/페이스북처럼 "글쓰기 페이지를 주소로
// 여는" 방법이 없어서 기기에 따라 다르게 보냄:
//   - 휴대폰(Web Share API가 파일까지 지원): OS 공유 시트를 띄움 — 거기서
//     인스타그램(스토리/피드/DM)을 고르면 사진이 그대로 넘어감.
//   - PC: 사진 저장 + 링크 복사 + instagram.com 새 탭 — 사용자가 사진만 올리면 됨.
//
// 사이트가 정적 파일(GitHub Pages)이라 링크 미리보기 카드(og:image)를 방마다
// 다르게 만들 수는 없음 — SNS 크롤러는 JS를 실행하지 않고 HTML만 읽음. 그래서
// "어떤 방인지"는 링크 미리보기 대신 함께 보내는 사진이 보여줌.
import { copyToClipboard } from '../shared/dom.js';

const IMAGE_MAX_WIDTH = 1600;

// 방 링크 — 내 방이든 남의 방이든 항상 ?room=을 붙임(받는 사람에겐 "내 방"이
// 아니라 이 방이어야 하니까). 지금 페이지 주소 기준이라 로컬/배포 어디서든 맞음.
export function shareUrl(code, base = location.href) {
  return new URL('./?room=' + encodeURIComponent(code), base).href;
}

export function shareText(title, readOnly) {
  return readOnly ? `${title} 구경하러 오세요` : `${title}에 놀러 오세요`;
}

// 3D 캔버스를 줄여서 2D 캔버스에 옮기고 아래쪽에 방 이름/주소 띠를 그림.
// WebGL 캔버스는 기본 설정(preserveDrawingBuffer: false)에선 화면에 내보낸 뒤
// 내용이 지워질 수 있어서, render()가 같은 함수 안에서 그린 직후에 복사해야 함.
function composeImage(glCanvas, title, url) {
  const scale = Math.min(1, IMAGE_MAX_WIDTH / glCanvas.width);
  const w = Math.round(glCanvas.width * scale);
  const h = Math.round(glCanvas.height * scale);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d');
  g.drawImage(glCanvas, 0, 0, w, h);

  const band = Math.round(Math.max(56, h * 0.1));
  const grad = g.createLinearGradient(0, h - band * 1.6, 0, h);
  grad.addColorStop(0, 'rgba(18,15,12,0)');
  grad.addColorStop(1, 'rgba(18,15,12,0.85)');
  g.fillStyle = grad;
  g.fillRect(0, h - band * 1.6, w, band * 1.6);

  const pad = Math.round(band * 0.45);
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#f3ece0';
  g.font = `600 ${Math.round(band * 0.4)}px Fraunces, Georgia, 'Malgun Gothic', serif`;
  g.fillText(title, pad, h - pad - Math.round(band * 0.32));
  g.fillStyle = '#b7ac98';
  g.font = `500 ${Math.round(band * 0.22)}px Manrope, 'Malgun Gothic', sans-serif`;
  // 주소는 ?room=까지 다 쓰면 길어서 사이트 주소만(방 링크는 글로 같이 감).
  g.fillText(url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''), pad, h - pad);
  return out;
}

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

// capture(): 씬을 한 번 그리고 그 WebGL 캔버스를 돌려주는 함수(main.js가 넘김).
export function initShare({ ctx, capture }) {
  const btn = document.getElementById('shareBtn');
  const dialog = document.getElementById('shareDialog');
  if (!btn || !dialog) return;
  btn.hidden = false;

  const img = dialog.querySelector('.share-preview');
  const hint = dialog.querySelector('.share-hint');
  const instaBtn = dialog.querySelector('[data-share="instagram"]');
  const saveBtn = dialog.querySelector('[data-share="save"]');
  const copyBtn = dialog.querySelector('[data-share="copy"]');
  const closeBtn = dialog.querySelector('.share-close');

  const url = shareUrl(ctx.viewingCode);
  let file = null;
  let objectUrl = null;
  let returnFocus = null;
  let text = '';
  let canShareFile = false;

  // 방 이름은 열 때마다 헤더에서 읽음 — 이름을 고친 직후에도 맞게.
  const currentTitle = () => (document.querySelector('#header h1') || {}).textContent || '내 방';

  function open() {
    const title = currentTitle();
    text = shareText(title, ctx.readOnly);
    // 내 방인데 둘러보기 비공개여도 링크를 받은 사람은 들어올 수 있음 — 알려줌.
    hint.textContent = ctx.readOnly
      ? '받은 사람도 이 방을 구경만 할 수 있어요.'
      : '링크를 받은 사람은 둘러보기 공개 여부와 상관없이 내 방을 구경할 수 있어요(구경만 가능).';

    returnFocus = document.activeElement;
    dialog.hidden = false;
    closeBtn.focus();

    file = null;
    img.removeAttribute('src');
    instaBtn.disabled = true;
    saveBtn.disabled = true;
    toBlob(composeImage(capture(), title, url)).then((blob) => {
      if (!blob || dialog.hidden) return;
      file = new File([blob], `${title}.jpg`, { type: 'image/jpeg' });
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      instaBtn.disabled = false;
      saveBtn.disabled = false;
      // Windows의 Chrome/Edge도 파일 공유를 지원해서 PC에서도 Windows 공유 창이 떠버림
      // (인스타그램이 없음) — 터치가 주 입력인 기기(휴대폰/태블릿)에서만 씀.
      const touchDevice = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      canShareFile = touchDevice && !!(navigator.canShare && navigator.canShare({ files: [file] }));
    });
  }

  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }

  function saveImage() {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = file.name;
    a.click();
  }

  instaBtn.addEventListener('click', () => {
    if (!file) return;
    if (canShareFile) {
      // 사용자가 공유 시트를 닫으면 AbortError로 끝남 — 실패가 아니라 무시.
      navigator.share({ files: [file], title: text, text: `${text}\n${url}` }).catch(() => {});
      return;
    }
    // 새 탭은 클릭 직후(동기)에 열어야 팝업 차단에 안 걸림.
    window.open('https://www.instagram.com/', '_blank', 'noopener');
    saveImage();
    copyToClipboard(url).catch(() => {});
    // 인스타그램 글(캡션)의 링크는 눌리지 않음 — 스토리 링크 스티커나 프로필 링크로 안내.
    hint.textContent = '사진을 저장하고 링크를 복사했어요. 인스타그램에서 사진을 올리고, 링크는 스토리의 링크 스티커나 프로필에 붙여 넣으세요.';
  });
  saveBtn.addEventListener('click', () => { if (file) saveImage(); });
  copyBtn.addEventListener('click', () => {
    copyToClipboard(url)
      .then(() => { copyBtn.textContent = '복사됨'; setTimeout(() => { copyBtn.textContent = '링크 복사'; }, 1500); })
      .catch(() => { window.prompt('아래 링크를 복사하세요.', url); });
  });

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
