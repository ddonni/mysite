# 개인 사이트 (프론트엔드)

여러 "방"으로 구성된 개인 사이트. `index.html`이 각 방으로 들어가는 3D
로비이고, 방 두 개(스케치북/기록 보관소)는 백엔드 API 서버
([mysite-backend](https://github.com/<사용자명>/mysite-backend))를 씀.

- `index.html` — Three.js로 만든 로비. 이젤(스케치북)과 책장(기록
  보관소)을 클릭하면 카메라가 다가가며 카드가 뜨고, "입장하기"를 누르면
  해당 페이지로 이동함. WebGL을 못 쓰는 환경이면 자동으로 텍스트 링크
  폴백으로 전환됨.
- `sketchbook.html` — 번호가 매겨진 페이지를 스케치북처럼 넘기며 자유롭게
  그리는 캔버스. 그림 저장/실시간 동기화를 백엔드가 담당하지만, 서버가
  꺼져 있으면 자동으로 이 기기 로컬 저장 모드로 폴백함.
- `library.html` — 읽거나 본 책/애니/영화를 기록하는 목록. 완전히
  백엔드 API에 의존함(로컬 폴백 없음) — 서버가 꺼져 있으면 목록이
  안 뜸.

두 방 모두 상단에 로비/스케치북/기록 보관소로 이동하는 네비게이션이
붙어 있음(`.site-nav`, 각자의 CSS 파일에 정의).

## 파일 구조

```
index.html        # 3D 로비 마크업
sketchbook.html    # 스케치북 마크업
library.html       # 기록 보관소 마크업
css/lobby.css      # 로비 스타일
css/style.css      # 스케치북 스타일
css/library.css    # 기록 보관소 스타일
js/lobby.js        # 로비 로직 (Three.js)
js/app.js          # 스케치북 로직
js/library.js      # 기록 보관소 로직
```

`js/app.js`, `js/library.js` 맨 위 `API_BASE` 상수가 둘 다 같은 백엔드
서버 주소를 가리킴. 백엔드를 재배포해서 주소가 바뀌면 두 파일 모두
고쳐야 함.
