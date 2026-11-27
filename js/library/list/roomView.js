// "내 방" 보기(2026-11-27 사용자 요청) — 카드 보기 대신 3D 방 하나. 네모난 방을 대각선 위에서 내려다봐서
// 바닥과 안쪽 벽 두 면만 보임(CSS 3D, 원근 없이). 사용자가 정한 것만: 전부 흰색, 가구는 침대·옷장(문 닫힘)뿐,
// 두 벽에 작품 사진(카드 보기처럼 격자 — 작품 수에 맞춰 크기). 처음엔 음악·?!를 뺐다가 사용자가 "그냥 벽에 넣자"
// 해서 모두 걸림(?!는 원래대로 주인한테만 옴).
// 방 전체가 화면 안에 들어오게 — 폭을 채우되 세로가 모자라면 방을 줄임(roomSize).
//
// 좌표: 바닥 div(L×L)의 왼쪽 위 = 안쪽 구석. 위 변 = 오른쪽 벽, 왼쪽 변 = 왼쪽 벽(옷장·침대가 붙어 있음).
// 바닥을 rotateZ(45deg) → rotateX(60deg)로 눕히면 왼쪽 위 꼭짓점이 화면 맨 위(안쪽)로 감.
import { escapeHtml, escapeAttr } from '../../shared/dom.js';
import { photoSrc } from '../../shared/photoSrc.js';
import { displayTitle } from './itemFormat.js';
import { youtubeThumb } from '../noteText.js';

const TILT = 60; // 내려다보는 각도(도)
const COS = Math.cos((TILT * Math.PI) / 180); // 바닥이 세로로 줄어드는 비율
const SIN = Math.sin((TILT * Math.PI) / 180); // 벽 높이가 화면에 보이는 비율
const ROOT2 = Math.SQRT2;
const COVER = 7 / 5; // 작품 사진 세로/가로(카드와 같은 5:7)

// 방에 거는 것 — 작품 넷 + ?!(2026-11-27 사용자 "?!랑 음악도 걍 벽에 넣자").
export const ROOM_CATS = ['book', 'anime', 'movie', 'music', 'note'];
export const roomItems = (list) => list.filter((it) => ROOM_CATS.includes(it.cat));

// 화면(폭 W, 높이 availH)에 맞는 방 크기 — 방 전체(앞쪽 바닥 끝까지)가 화면 안에 들어오게(사용자: "밑에 절반이
// 잘린다"). 먼저 폭을 꽉 채워 보고, 남는 세로만큼 벽을 높이되(폰처럼 세로로 긴 화면) 너무 낮거나 높지 않게.
// 벽을 가장 낮춰도 세로가 모자라면(넓은 화면) 방 전체를 줄임 — 그땐 양옆이 조금 빔. viewH = 방 전체 높이.
const RATIO_MIN = 0.4;
const RATIO_MAX = 2.2;
export function roomSize(W, availH) {
  const fit = Math.max(300, availH);
  let L = Math.max(160, (W * 0.98) / ROOT2);
  const floorK = ROOT2 * COS; // 바닥 마름모 높이 = floorK * L
  let ratio = Math.min(RATIO_MAX, Math.max(RATIO_MIN, (fit / L - floorK) / SIN));
  if ((floorK + SIN * ratio) * L > fit) { ratio = RATIO_MIN; L = fit / (floorK + SIN * RATIO_MIN); }
  const H = ratio * L;
  return { L, H, viewH: floorK * L + SIN * H };
}

// 두 벽에 n장을 5:7로 — 두 벽은 높이가 같아서 같은 크기·같은 줄 수로. 다 들어가면 가장 크게(양쪽 벽에 열 수
// 비율대로 나눠서, 작품이 적어도 두 벽 다 보이게). 사진이 minW보다 작아져야 다 들어가면 minW로 두고 왼쪽 벽은 꽉,
// 나머지는 오른쪽 벽에 이어서 옆으로 스크롤(scroll). 위에서 아래로 채우고 다음 열로.
// leftW·rightW = 사진을 걸 수 있는 폭(왼쪽 벽은 옷장 앞을 뺀 부분).
export function layoutWalls(n, { leftW, rightW, h, minW = 8 }) {
  const pad = h * 0.06;
  const usableH = h - 2 * pad;
  const span = (count, size, gap) => (count > 0 ? count * size + (count - 1) * gap : 0);
  const make = (tw, rows, colsL, colsR, scroll) => {
    const gap = Math.max(2, tw * 0.1);
    const th = tw * COVER;
    const capL = rows * colsL;
    let leftCount = scroll ? capL : Math.min(capL, Math.round((n * colsL) / (colsL + colsR)));
    if (!scroll && n - leftCount > rows * colsR) leftCount = n - rows * colsR;
    const rightCount = n - leftCount;
    const wall = (count) => {
      const used = Math.min(rows, count); // 작품이 줄 수보다 적으면 그만큼만
      const cols = count ? Math.ceil(count / rows) : 0;
      return { count, rows: used, cols, w: span(cols, tw, gap), h: span(used, th, gap) };
    };
    return { tw, th, gap, pad, rows, scroll, left: wall(leftCount), right: wall(rightCount) };
  };
  if (n <= 0) return make(minW, 1, 0, 1, false);
  for (let tw = Math.floor(Math.min(usableH / COVER, rightW)); tw >= minW; tw -= 1) {
    const gap = Math.max(2, tw * 0.1);
    const rows = Math.floor((usableH + gap) / (tw * COVER + gap));
    const colsL = Math.max(0, Math.floor((leftW + gap) / (tw + gap)));
    const colsR = Math.floor((rightW + gap) / (tw + gap));
    if (rows < 1 || colsR < 1) continue;
    if (rows * (colsL + colsR) >= n) return make(tw, rows, colsL, colsR, false);
  }
  const gap = Math.max(2, minW * 0.1);
  const rows = Math.max(1, Math.floor((usableH + gap) / (minW * COVER + gap)));
  const colsL = Math.max(0, Math.floor((leftW + gap) / (minW + gap)));
  const colsR = Math.max(1, Math.floor((rightW + gap) / (minW + gap)));
  return make(minW, rows, colsL, colsR, n - rows * colsL > rows * colsR);
}

// 바닥 위의 상자(침대·옷장) — 보이는 면은 윗면·앞(+y)·오른쪽(+x) 셋뿐이라 그것만. x·y는 바닥 위 위치,
// w(x 방향)·d(y 방향)·h(높이), z = 바닥에서 띄운 높이.
function boxHtml(cls, { x, y, w, d, h, z = 0 }) {
  return `
    <div class="rv-box ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${d}px;transform:translateZ(${z}px)">
      <div class="rv-face rv-top" style="transform:translateZ(${h}px)"></div>
      <div class="rv-face rv-front" style="left:0;top:${d - h}px;width:${w}px;height:${h}px"></div>
      <div class="rv-face rv-side" style="left:${w}px;top:${d - h}px;width:${d}px;height:${h}px"></div>
    </div>`;
}

// 벽에 걸 그림 — 사진(음악은 앨범 표지), ?! 영상이면 유튜브 썸네일, 없으면 null(제목·글을 대신 씀).
function tileImg(it) {
  if (it.photo_url) return `<img src="${escapeAttr(photoSrc(it.photo_url))}" alt="" loading="lazy" crossorigin="anonymous">`;
  const thumb = it.cat === 'note' ? youtubeThumb(it.listen_url) : null;
  return thumb ? `<img src="${escapeAttr(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : null;
}

function tileHtml(it) {
  const label = escapeAttr(displayTitle(it));
  const inner = tileImg(it) || `<span class="rv-title">${escapeHtml(displayTitle(it))}</span>`;
  return `<button type="button" class="rv-work" data-id="${escapeAttr(String(it.id))}" title="${label}" aria-label="${label}">${inner}</button>`;
}

// 작품 벽 옆으로 스크롤 — 벽이 3D로 비스듬해서 브라우저 스크롤 대신 직접: 휠(세로 휠도 옆으로)·끌기. 끌었으면
// 그 클릭은 작품 열기로 안 침. **마우스가 작품 벽 위에 있을 때만**(방 바깥 빈 곳·바닥에선 페이지 그대로 — 사용자 요청).
// 크롬이 3D로 기울어진 요소에선 휠의 대상만 엉뚱하게 잡아서(마우스 이동·클릭은 맞음), 벽 위인지는 마우스 이동
// (pointerenter/leave)으로 알아 두고 휠은 방 전체(surface, 평평한 2D 요소)에서 받음.
function attachWallScroll(surface, gallery, track, maxOffset) {
  let offset = 0;
  const apply = (v) => {
    offset = Math.min(maxOffset, Math.max(0, v));
    track.style.transform = `translateX(${-offset}px)`;
  };
  let overWall = false;
  gallery.addEventListener('pointerenter', () => { overWall = true; });
  gallery.addEventListener('pointerleave', () => { overWall = false; });
  surface.addEventListener('wheel', (e) => {
    if (!overWall) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    // 벽 위에서 굴린 휠은 벽만 — 끝에 닿아도 페이지는 안 내려감(사용자 요청).
    e.preventDefault();
    apply(offset + d);
  }, { passive: false });
  let start = null;
  let dragged = false;
  surface.addEventListener('pointerdown', (e) => {
    if (!gallery.contains(e.target)) return; // 끌기도 작품 벽에서 시작할 때만
    start = { x: e.clientX, offset };
    dragged = false;
  });
  surface.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    if (!dragged && Math.abs(dx) < 5) return;
    if (!dragged) { dragged = true; if (surface.setPointerCapture) surface.setPointerCapture(e.pointerId); }
    apply(start.offset - dx * ROOT2); // 벽이 45도로 서 있어서 화면에서 움직인 것보다 벽 위에선 √2배
  });
  const end = () => { start = null; };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('click', (e) => {
    if (!dragged) return;
    e.stopPropagation();
    e.preventDefault();
    dragged = false;
  }, true);
  return { scrollTo: apply };
}

// 벽 사진 격자 하나 — 위에서 아래로 채우고 다음 열로.
function galleryHtml(cls, items, lay, part, { left, width }) {
  return `
          <div class="rv-gallery ${cls}" style="width:${width}px;height:${part.h}px;left:${left}px;top:${(lay.wallH - part.h) / 2}px">
            <div class="rv-track" style="width:${part.w}px;height:${part.h}px;
              grid-template-rows:repeat(${part.rows}, ${lay.th}px);grid-auto-columns:${lay.tw}px;gap:${lay.gap}px;
              font-size:${Math.max(4, Math.min(12, lay.tw * 0.13)).toFixed(1)}px">
              ${items.map(tileHtml).join('')}
            </div>
          </div>`;
}

// containerEl에 방을 그림. list: 기록 전부(방은 칩과 따로). onOpen(it): 벽의 작품을 누르면(큰 카드).
export function renderRoom(containerEl, list, { onOpen } = {}) {
  const works = roomItems(list);
  const W = containerEl.clientWidth || window.innerWidth;
  const top = containerEl.getBoundingClientRect().top + (window.scrollY || 0);
  const { L, H, viewH } = roomSize(W, window.innerHeight - top - 8);
  // 왼쪽 벽도 끝에서 끝까지(옷장 뒤까지 — 사용자 요청, 옷장에 가려지는 사진도 있음). 벽 안에서 왼쪽 끝 = 앞 모서리.
  const pad = H * 0.06;
  const leftStart = pad;
  const leftAreaW = L - leftStart - pad;
  // 사진은 알아볼 수 있는 크기 아래로는 안 줄이고(바닥 크기 기준), 넘치면 오른쪽 벽을 옆으로 스크롤.
  const lay = layoutWalls(works.length, { leftW: leftAreaW, rightW: L - 2 * pad, h: H, minW: Math.max(28, L * 0.07) });
  lay.wallH = H;
  const leftItems = works.slice(0, lay.left.count);
  const rightItems = works.slice(lay.left.count);
  const rightViewW = lay.scroll ? L - 2 * pad : lay.right.w; // 오른쪽 벽에서 사진이 보이는 폭

  // 바닥 마름모 가운데의 화면 위치 — 안쪽 구석 벽 꼭대기가 위에서 조금 아래에 오게.
  const cy = 8 + SIN * H + (ROOT2 * L * COS) / 2;

  containerEl.innerHTML = `
    <div class="room-view" style="height:${viewH}px">
      <div class="rv-room" style="width:${L}px;height:${L}px;left:${(W - L) / 2}px;top:${cy - L / 2}px">
        <div class="rv-floor"></div>
        <div class="rv-wall rv-wall-left" style="width:${L}px;height:${H}px;top:${L - H}px">
          ${lay.left.count ? galleryHtml('rv-gallery-left', leftItems, lay, lay.left, { left: leftStart + (leftAreaW - lay.left.w) / 2, width: lay.left.w }) : ''}
        </div>
        <div class="rv-wall rv-wall-back" style="width:${L}px;height:${H}px;top:${-H}px">
          ${lay.right.count ? galleryHtml(`rv-gallery-right${lay.scroll ? ' scroll' : ''}`, rightItems, lay, lay.right, { left: (L - rightViewW) / 2, width: rightViewW }) : ''}
        </div>
        ${/* 침대는 낮아서 안쪽 구석에(작품 벽을 안 가림), 옷장은 키가 커서 왼쪽 벽 앞쪽에. 크기는 바닥(L) 기준 —
             벽 높이는 화면 모양 따라 바뀌어도 가구는 그대로 */ ''}
        ${boxHtml('rv-bed', { x: 0, y: L * 0.06, w: L * 0.42, d: L * 0.28, h: L * 0.045 })}
        ${boxHtml('rv-pillow', { x: L * 0.025, y: L * 0.095, w: L * 0.075, d: L * 0.21, h: L * 0.016, z: L * 0.045 })}
        ${boxHtml('rv-wardrobe', { x: 0, y: L * 0.58, w: L * 0.15, d: L * 0.28, h: Math.min(H * 0.85, L * 0.36) })}
      </div>
    </div>`;

  if (onOpen) {
    const byId = new Map(works.map((it) => [String(it.id), it]));
    // 벽에 걸린 순서(왼쪽 벽 → 오른쪽 벽) — 큰 카드에서 옆 작품으로 넘길 때 씀.
    const order = [...leftItems, ...rightItems];
    containerEl.querySelectorAll('.rv-work').forEach((b) => b.addEventListener('click', () => onOpen(byId.get(b.dataset.id), order)));
  }
  if (lay.scroll) {
    const surface = containerEl.querySelector('.room-view');
    surface.classList.add('scroll');
    const gallery = containerEl.querySelector('.rv-gallery-right');
    attachWallScroll(surface, gallery, gallery.querySelector('.rv-track'), lay.right.w - rightViewW);
  }
}
