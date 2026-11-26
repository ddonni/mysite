// ?!(cat="note") 한 개를 글 ↔ 저장 값으로 바꾸는 순수 함수들 — DOM을 안 건드림.
//
// 입력 칸은 하나뿐: 아무 글이나 쓰고, 유튜브 주소를 붙여 넣으면 그 주소는 listen_url(유튜브 칸)로,
// 나머지 글은 memo로 저장함(백엔드 schemas.RecordIn — 둘 중 하나는 꼭 있어야 함).
import { normalizeYouTube, parseYouTube } from '../shared/youtube.js';

export const NOTE_MAX = 2000; // 백엔드 schemas.NOTE_MAX와 같아야 함

// 글 속 유튜브 주소 후보 — https:// 없이 "youtu.be/…"만 붙여 넣어도 잡음.
const YT_IN_TEXT = /(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/[^\s<>"']+/i;

// 쓴 글 → { memo, listen_url }. 첫 번째 유튜브 주소만 링크로 떼고(나머지는 글에 그대로), 떼어 낸
// 자리의 앞뒤 공백·빈 줄을 정리함. 유튜브 주소가 아니면(예: 채널 주소) 글에 그대로 남김.
export function splitNote(text) {
  const raw = String(text || '');
  const m = YT_IN_TEXT.exec(raw);
  const url = m ? normalizeYouTube(m[0]) : null;
  const rest = url ? raw.slice(0, m.index) + raw.slice(m.index + m[0].length) : raw;
  const memo = rest.split('\n').map((l) => l.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { memo, listen_url: url };
}

// 저장된 ?! → 입력 칸에 다시 넣을 글(수정할 때).
export function joinNote(it) {
  return [it.memo || '', it.listen_url || ''].filter(Boolean).join('\n');
}

// 카드·목록에 보일 이름 — 글의 첫 줄(길면 줄임), 글 없이 링크만이면 "유튜브 영상", 사진만이면 "사진".
export function noteTitle(it) {
  const first = (it.memo || '').split('\n').map((l) => l.trim()).find(Boolean);
  if (first) return first.length > 40 ? first.slice(0, 39) + '…' : first;
  if (it.listen_url) return '유튜브 영상';
  return it.photo_url ? '사진' : '';
}

// 영상 주소면 유튜브 썸네일 주소, 재생목록이거나 아니면 null.
export function youtubeThumb(url) {
  const p = parseYouTube(url);
  return p && p.videoId ? `https://i.ytimg.com/vi/${p.videoId}/hqdefault.jpg` : null;
}

// 쓴 글(붙여 넣은 글) + 올린 사진 주소 → 저장할 { memo, listen_url, photo_url }, 셋 다 없으면 null. 글이 너무
// 길면 NOTE_MAX에서 자름(붙여넣기는 길이를 미리 못 막아서 — 서버는 넘으면 422).
export function notePartsFrom(text, photoUrl = null) {
  const { memo, listen_url } = splitNote(text);
  if (!memo && !listen_url && !photoUrl) return null;
  return { memo: memo.slice(0, NOTE_MAX), listen_url, photo_url: photoUrl || null };
}
