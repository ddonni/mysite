// Render 무료 플랜은 한동안 안 쓰면 서버가 잠들고, 첫 요청에 깨어나는 데
// 최대 1분 가까이 걸릴 수 있음. "그냥 느린 것"과 "서버가 깨는 중"을
// 구분해서 알려주기 위해, 요청을 시작한 지 SLOW_AFTER_MS가 지나도 안
// 끝났을 때만 onSlow()를 불러줌 (로비/스케치북/기록보관소가 같이 씀).
const SLOW_AFTER_MS = 3000;

export const WAKE_MESSAGE = '서버를 깨우는 중이에요. 처음 접속이면 1분 가까이 걸릴 수 있어요…';

// 반환값은 "그만 기다려도 됨"을 알리는 함수 — 요청이 끝나면(성공/실패
// 상관없이) 반드시 불러서 타이머를 정리해야 함. 이미 SLOW_AFTER_MS가
// 지나 onSlow가 불린 뒤에 불러도 안전함(clearTimeout은 중복 호출해도 됨).
export function watchForSlowWake(onSlow) {
  const timer = setTimeout(onSlow, SLOW_AFTER_MS);
  return () => clearTimeout(timer);
}
