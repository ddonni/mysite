# 개인 사이트 (프론트엔드)

여러 "방"으로 구성된 개인 사이트. `index.html`이 각 방으로 들어가는 3D
로비이고, 방 두 개(스케치북/기록 보관소)는 백엔드 API 서버
([mysite-backend](https://github.com/<사용자명>/mysite-backend))를 씀.

- `index.html` — Three.js로 만든 로비. 둥근(다각형) 방의 벽 세 면에
  왼쪽부터 애니 진열장(아크릴 스탠드), 책장, 영화 포스터 벽이 하나씩 있고,
  가운데 러그 위에 캔버스 이젤, 오른쪽 앞에 음악 코너(턴테이블을 얹은
  레코드 콘솔 — LP 보관함)가 있음. 마우스 휠은 커서가 가리키는 곳을 향해 확대됨. 가구를
  클릭하면 카메라가 다가가며 카드가 뜨고, "입장하기"를 누르면 해당
  페이지(기록 보관소는 그 카테고리 탭)로 이동함. 책/애니/영화는 별표로 고른
  인생작 3개가 가구 위에 액자/큰 스탠드/큰 포스터로 걸리고(애니/영화는 별표
  고른 것만 — 나머지는 진열장 칸/포스터 벽에 작게 쌓임), 음악은 첫 번째
  최애음악이 턴테이블에서 돌아감. ("인생작"은 화면에서 카테고리마다
  인생책/인생애니/인생영화/최애음악으로 불리고, 코드·API에선 `featured`.) WebGL을
  못 쓰는 환경이면 자동으로 텍스트 링크 폴백으로 전환됨. (예전 네모난 방
  로비는 git 브랜치 `rect-room`에 남아 있음.)
- `sketchbook.html` — 고정된 한 페이지에 자유롭게 그리는 캔버스. 그림
  저장/실시간 동기화를 백엔드가 담당하지만, 서버가 꺼져 있으면 자동으로
  이 기기 로컬 저장 모드로 폴백함.
- `library.html` — 읽고 보고 들은 책/애니/영화/음악을 표지 카드로 모아두는
  기록 보관소. 카테고리 탭을 고르면 맨 위에 인생작이 크게 나옴. 완전히
  백엔드 API에 의존함(로컬 폴백 없음) — 서버가 꺼져 있으면 목록이
  안 뜸.

세 페이지 모두 왼쪽 위에 방/캔버스/기록 보관소로 이동하는 같은 메뉴가
붙어 있음(`.site-nav` — 모양은 `css/nav.css`, 방 코드·방문 칸은
`js/shared/roomNav.js`).

## 파일 구조

```
index.html          # 3D 로비 마크업
sketchbook.html      # 스케치북 마크업
library.html         # 기록 보관소 마크업
css/lobby.css        # 로비 스타일
css/style.css        # 스케치북 스타일
css/library.css      # 기록 보관소 스타일
css/nav.css          # 세 페이지가 같이 쓰는 왼쪽 위 메뉴

js/shared/config.js  # API_BASE 등, 여러 방이 공통으로 쓰는 값

js/sketchbook/
  main.js            # 시작점 — 아래 모듈들을 만들고 서로 연결함
  store.js           # 저장소: 백엔드 API / 이 기기 로컬 저장, 둘 중 하나
  canvas.js          # 포인터 입력을 받아 실시간으로 선을 그림(접착부)
  canvas/            #   strokeBuffer.js(획 저장/병합), renderer.js(레이아웃/전체 다시 그리기)
  pager.js           # 페이지 넘기기/삭제/점프 + canvas의 변경사항을 저장소에 반영
  dock.js            # 색상·굵기·지우개·되돌리기 등 도구 서랍 UI
  toast.js           # 화면 아래 잠깐 뜨는 알림

js/library/
  main.js            # 시작점 — list/modal을 만들고 연결함
  records.js         # 백엔드와 통신 (목록 조회, 저장, 삭제, 사진 업로드)
  list.js            # 카테고리 탭 + 인생작 줄 + 표지 카드 격자 — 실제 그리기는 list/*.js에 위임
  list/              #   itemFormat.js(표지/별점), cardsView.js(카드), detail.js(카드를 누르면 뜨는 상세 창)
  modal.js           # 추가/수정 모달 오케스트레이션
  modal/             #   categoryFields.js, starPicker.js, photoPicker.js, presetAutocomplete.js

js/lobby/
  main.js            # 시작점 — 부팅 순서만 담당
  roomContext.js      # "지금 보는 방이 어디인지" 계산 + URL 헬퍼
  roomChrome.js        # 헤더/카드 주변 UI(방 코드, 구글 연동, 이름, 테마)
  roomNameEditor.js, themePicker.js, webgl.js
  loadRoomIntoScene.js # 씬에 실제 데이터(그림/기록)를 채워넣는 fetch들
  scene.js            # 3D 씬 조립 지점
  scene/              #   roomShell.js, lighting.js, dustMotes.js, aoBlob.js, canvasTexture.js, labelSprite.js, roomDimensions.js
  scene/roomLayout.js #   가구를 어느 벽/자리에 둘지 + 조명 위치 + 카메라 프리셋(가구 모듈은 "자기 벽 기준" 좌표로만 지어짐)
  helpDialog.js       # 처음 온 사람에게 한 번 뜨는 도움말(오른쪽 위 ? 버튼으로 다시 열기)
  scene/furniture/    #   easel.js, bookshelf.js, frame.js, posterWall.js, displayCase.js, recordConsole.js(LP 보관함), turntable.js, lamps.js, ball.js, teddyBear.js
  scene/wallLabel.js  #   가구 위 벽의 BOOK / MOVIE / ANIMATION 글씨
  scene/coverImage.js #   기록 사진(없으면 제목 카드)을 액자/포스터/스탠드/LP 텍스처에 그리는 공용 로직
  scene/stick.js      #   두 점을 잇는 막대(이젤 다리, 턴테이블 톤암)
  showcase.js         # 카테고리별 인생작 3개(별표 우선, 책/음악은 모자라면 최신으로 채움) + 나머지를 고르는 순수 함수
  controls.js         # 카메라 조작 + 가구 클릭 시 카드 UI
```

각 페이지의 `main.js`가 그 페이지의 "시작점"이자 목차 역할을 함 — 전체
흐름이 궁금하면 거기부터 열어보면 됨. 백엔드 서버 주소가 바뀌면
`js/shared/config.js` 한 곳만 고치면 스케치북/기록 보관소 양쪽에 다
반영됨(예전엔 두 파일에 따로 적혀 있어서 둘 다 고쳐야 했음).

## 테스트

이 사이트 자체는 빌드 없이 `<script type="module">`로 바로 서비스되는
정적 파일이라, `package.json`은 순전히 [Vitest](https://vitest.dev/)를
돌리기 위한 용도로만 있음(사이트 배포에는 안 씀).

```bash
npm install
npm test
```

`tests/`는 `js/`와 같은 구조로 나눠져 있고, DOM을 직접 그리는 코드
(`modal.js`, `scene.js` 등)보다는 fetch 응답을 다루는 로직처럼 DOM 없이
독립적으로 부를 수 있는 함수 위주로 커버함 — 예를 들어
`records.js`/`store.js`가 서버 에러 응답(`res.ok`가 false인 경우)을
제대로 걸러내는지, `room.js`가 `localStorage`/URL 쿼리를 올바르게
읽고 쓰는지 같은 것들.
