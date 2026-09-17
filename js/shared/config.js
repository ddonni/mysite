// 이 사이트의 모든 "방"(스케치북, 기록 보관소)이 같은 백엔드 서버를 씀.
// 서버 주소가 바뀌면(재배포 등) 이 한 줄만 고치면 모든 페이지에 반영됨 —
// 예전엔 js/app.js, js/library.js 두 군데에 똑같은 값이 따로 적혀 있어서
// 매번 둘 다 고쳐야 했음. 이제는 이 파일 하나만 import해서 씀.
export const API_BASE = 'https://sketchbook-api.onrender.com';
