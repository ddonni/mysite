// 화면 아래쪽에 잠깐 떴다 사라지는 작은 알림("토스트") 하나를 관리하는
// 모듈. alert()는 확인을 눌러야 사라지고 그림 그리던 흐름을 끊어버리기
// 때문에, 대신 이 조용한 알림을 씀 (삭제 확인, 저장 실패 안내 등).
//
// createToast()를 한 번 호출하면 토스트를 "울리는" 함수 하나를 돌려줌.
// 그 함수를 여러 군데(dock.js, pager.js …)에서 나눠 쓰면 됨.
//
// ms를 0으로 주면 자동으로 안 사라짐 — 서버를 깨우는 동안처럼 "언제
// 끝날지 모르는 대기"를 알릴 때 씀. 이렇게 띄워둔 메시지는 다음 toast()
// 호출(정상적으로 자연스럽게 덮어씀)이나 toast.hide()로 직접 치움.
export function createToast() {
  const el = document.getElementById('toast');
  let hideTimer = null;

  function toast(message, ms = 1800) {
    el.textContent = message;
    el.classList.add('show');
    // 메시지가 연달아 뜨면 이전 타이머를 취소하고 다시 재는 식으로,
    // 항상 "마지막 메시지 기준으로 ms 후 사라짐"이 되게 함.
    clearTimeout(hideTimer);
    hideTimer = ms ? setTimeout(() => el.classList.remove('show'), ms) : null;
  }
  toast.hide = () => {
    clearTimeout(hideTimer);
    el.classList.remove('show');
  };
  return toast;
}
