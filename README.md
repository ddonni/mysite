# 개인 사이트 (프론트엔드)

여러 "방"으로 구성된 개인 사이트. `index.html`이 각 방으로 들어가는 3D
로비이고, 방 두 개(스케치북/기록 보관소)는 백엔드 API 서버
([mysite-backend](https://github.com/<사용자명>/mysite-backend))를 씀.

- `index.html` — Three.js로 만든 로비. 이젤(스케치북)과 책장(기록
  보관소)을 클릭하면 카메라가 다가가며 카드가 뜨고, "입장하기"를 누르면
  해당 페이지로 이동함. WebGL을 못 쓰는 환경이면 자동으로 텍스트 링크
  폴백으로 전환됨.
- `sketchbook.html` — 고정된 한 페이지에 자유롭게 그리는 캔버스. 그림
  저장/실시간 동기화를 백엔드가 담당하지만, 서버가 꺼져 있으면 자동으로
  이 기기 로컬 저장 모드로 폴백함.
- `library.html` — 읽거나 본 책/애니/영화를 기록하는 목록. 완전히
  백엔드 API에 의존함(로컬 폴백 없음) — 서버가 꺼져 있으면 목록이
  안 뜸.

두 방 모두 상단에 로비/스케치북/기록 보관소로 이동하는 네비게이션이
붙어 있음(`.site-nav`, 각자의 CSS 파일에 정의).

## 파일 구조

```
index.html          # 3D 로비 마크업
sketchbook.html      # 스케치북 마크업
library.html         # 기록 보관소 마크업
css/lobby.css        # 로비 스타일
css/style.css        # 스케치북 스타일
css/library.css      # 기록 보관소 스타일

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
  list.js            # 탭/보기모드 상태 — 실제 그리기는 list/*.js에 위임
  list/              #   itemFormat.js, detailRow.js, gridView.js, rowsView.js, lightbox.js
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
  scene/furniture/    #   easel.js, bookshelf.js, frame.js, turntable.js, ball.js, teddyBear.js
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
