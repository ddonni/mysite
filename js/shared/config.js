// 이 사이트의 모든 "방"(스케치북, 기록 보관소)이 같은 백엔드 서버를 씀.
// 서버 주소가 바뀌면(재배포 등) 이 한 줄만 고치면 모든 페이지에 반영됨 —
// 예전엔 js/app.js, js/library.js 두 군데에 똑같은 값이 따로 적혀 있어서
// 매번 둘 다 고쳐야 했음. 이제는 이 파일 하나만 import해서 씀.
// export const API_BASE = 'https://sketchbook-api.onrender.com';
export const API_BASE = 'http://localhost:8000';

// "구글 계정으로 내 방 복구" 버튼(js/shared/googleAuth.js)용 OAuth
// client id. 비밀은 아니지만(브라우저에 그대로 노출됨) 아무 값이나
// 쓸 순 없음 — Google Cloud Console에서 프로젝트를 만들고 APIs &
// Services > Credentials > OAuth client ID > Web application으로
// 발급받은 뒤, "Authorized JavaScript origins"에 이 사이트가 실제로
// 뜨는 주소(로컬 개발이면 http://localhost:5500, 배포본이면 그
// GitHub Pages 주소)를 등록해야 함. 백엔드의 GOOGLE_CLIENT_ID
// 환경변수와 반드시 같은 값이어야 함. 빈 문자열로 두면 버튼이 아예
// 안 뜨고, 나머지 기능은 평소대로 동작함.
export const GOOGLE_CLIENT_ID = '227700659322-u4dcqs0hi59a1lpamaose4ks07su3a88.apps.googleusercontent.com';
