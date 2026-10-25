// 요청이 오래 걸릴 때 "멈춘 게 아니라 기다리는 중"이라고 알려주기 위한 타이머 —
// 요청을 시작한 지 SLOW_AFTER_MS가 지나도 안 끝났을 때만 onSlow()를 불러줌
// (로비/스케치북/기록보관소/둘러보기가 같이 씀). 예전 Render 무료 서버는 잠들었다
// 깨는 데 1분 가까이 걸려서 "서버를 깨우는 중"이라고 안내했는데, 지금 서버(EC2)는
// 잠들지 않아서 그냥 연결이 느린 경우만 남음.
const SLOW_AFTER_MS = 3000;

export const SLOW_MESSAGE = '연결이 느려요. 잠시만 기다려 주세요…';

// 반환값은 "그만 기다려도 됨"을 알리는 함수 — 요청이 끝나면(성공/실패
// 상관없이) 반드시 불러서 타이머를 정리해야 함. 이미 SLOW_AFTER_MS가
// 지나 onSlow가 불린 뒤에 불러도 안전함(clearTimeout은 중복 호출해도 됨).
export function watchForSlow(onSlow) {
  const timer = setTimeout(onSlow, SLOW_AFTER_MS);
  return () => clearTimeout(timer);
}
