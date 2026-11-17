// 방(기록) 프로필을 서버에 저장하는 요청들 — 이름·한 줄 소개·프로필 사진. 첫 화면 위 프로필 줄
// (js/library/profileHeader.js)이 씀. 전부 방 주인 토큰(X-Room-Token)이 필요함.
import { API_BASE } from './config.js';
import { shrinkImage } from '../library/modal/shrinkImage.js';

export const NAME_MAX = 20; // 백엔드 schemas.RoomNameIn
export const BIO_MAX = 40; // 백엔드 schemas.RoomBioIn

function put(mine, path, body) {
  return fetch(`${API_BASE}/api/rooms/${encodeURIComponent(mine.code)}/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Room-Token': mine.token },
    body: JSON.stringify(body),
  }).then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${path} failed`))));
}

// 빈 문자열이면 지움. 저장된 값(앞뒤 공백을 자른 것, 없으면 null)을 돌려줌.
export const saveName = (mine, name) => put(mine, 'name', { name }).then((r) => r.name || null);
export const saveBio = (mine, bio) => put(mine, 'bio', { bio }).then((r) => r.bio || null);
// null이면 기본 사진(실루엣)으로.
export const saveAvatar = (mine, url) => put(mine, 'avatar', { avatar_url: url }).then((r) => r.avatar_url || null);

// 사진 파일을 줄여서(긴 변 512px — 작게만 보이고, 크게 봐도 이 정도면 충분) 기록 사진과 같은 곳에
// 올리고(POST .../uploads) 프로필 사진으로 저장. 저장된 주소를 돌려줌.
export async function uploadAvatar(mine, file) {
  const form = new FormData();
  form.append('file', await shrinkImage(file, 512));
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(mine.code)}/uploads`, {
    method: 'POST',
    headers: { 'X-Room-Token': mine.token },
    body: form,
  });
  if (!res.ok) throw new Error('upload failed');
  return saveAvatar(mine, (await res.json()).url);
}
