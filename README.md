# 개인 사이트 (프론트엔드)

읽고 보고 들은 책/애니/영화/음악을 카드로 모아두는 개인 사이트. 기록은 백엔드 API 서버([mysite-backend](https://github.com/<사용자명>/mysite-backend))를 씀.

- `index.html` — 첫 화면 = 기록 카드. 맨 위는 프로필 줄(사진 · 이름 · 한 줄 소개 · 공개 스위치 —
  내 기록이면 누르면 바로 고침), 그 아래 붙어 다니는 메뉴 줄(☰ · 카테고리 칩 · 티어리스트 · 3D 방 ·
  보기 전환 [카드 · 촘촘히 · 목록] · "+ 기록"),
  흰 바탕에 카드 격자(폰은 3열). 카드를 누르면 뒤집혀서 한 줄 감상·세부 기록이 보이고, 뒷면에서 바로
  수정·삭제·인생작(음악은 "▶ 듣기"). 오른쪽 아래엔 좋아요(♥)·방명록 버튼(구글 연동한 사람만 쓰기). 인생작(카테고리마다 최대 3개 — 화면에선 인생책/인생애니/인생영화/
  최애음악, 코드·API에선 `featured`)은 맨 앞에 황금 카드(마우스를 따라 기울고 홀로그램 빛)로
  나옴. 처음 열 때·칩을 바꿀 때 카드가 화면 아래 덱에서 날아옴(움직임 줄이기면 안 함). 완전히
  백엔드 API에 의존함(로컬 폴백 없음). "촘촘히"는 표지만 빽빽이, "목록"은 한 줄에 한 작품 —
  둘 다 작품을 누르면 그 카드가 가운데에 크게(뒷면부터) 뜸. 고른 보기는 localStorage(`mysite:view`).
- `lobby.html` — 3D 방 = 기억 보관소(Three.js, 2026-11-18). 끝없는 통로 양옆 서가에 기록이 한 칸씩 꽂힘
  (책은 책, 영화·애니는 포스터, 음악은 앨범 — 기록한 날짜 순). 처음엔 위에서 내려다보고, 지도처럼 돌리고·옮기고·
  다가가며 둘러봄. 누르면 눈앞으로 꺼내 표지·감상을 봄. 가운데는 늘 내 서가, 바깥엔 공개된 다른 방들의 이웃 서가
  (인생작 + 이름표). `lobby?room=코드`로 오면 그 사람 서가를 맨 앞에 비춤.
  입구 옆 이젤은 캔버스로. 메뉴 줄의 "3D 방" 버튼으로 옴. 옛 가구 방은 브랜치 `3d-room`.
- `library.html` — 예전 "기록 보관소" 주소. 쿼리(`?cat=`·`?room=`·`&new=1`)를 들고 첫 화면으로
  넘기기만 함(공유된 링크·즐겨찾기용).
- `sketchbook.html` — 캔버스(그림판, 실시간 WebSocket). **3D 방의 이젤에서만** 들어감(카드 화면엔
  길이 없음 — 2026-11-18 사용자 결정).
- `rooms.html` — 기록 둘러보기. 방 주인이 "둘러보기에 공개"를 켠 방들(기록이 있는 방만)을
  최근 활동순 또는 인기순(좋아요)으로 카드(프로필·인생작 12개)로 보여주고, 누르면 그 방에 읽기
  전용으로 놀러 감. 공개 스위치(`js/shared/visibilityToggle.js`)는 이 페이지 위쪽과 첫 화면 프로필
  줄에 있고, 기본은 비공개. 비공개여도 방 코드를 아는 사람은 들어올 수 있음.
- `tier.html` — 티어리스트. 기록 하나에 보드 하나(SS~F + 미배치), 칩은 카테고리 거르기만. 직접
  옮기지 않은 작품은 별점으로 자동 배치.

두 페이지 모두 왼쪽 위에 전체/책/애니/영화·시리즈/음악으로 이동하는 같은 메뉴가
붙어 있음(`.site-nav` — 모양은 `css/nav.css`, ☰ 서랍(방 코드·링크 복사·방문 칸·둘러보기·
개발자의 방·의견 보내기)은 `js/shared/roomNav.js`). 첫 화면의 서랍엔 방 설정(방 이름·둘러보기
공개·구글 계정 연결 — `js/shared/roomSettings.js`)도 있음. `js/shared/config.js`의
`DEVELOPER_ROOM_CODE`를 채우면 서랍에 "개발자의 방 구경하기" 링크가 떠서, 누구나 그 방을
읽기 전용으로 둘러볼 수 있음(방 주인 본인과 그 방을 보는 중엔 안 보임).

## 파일 구조

```
index.html          # 첫 화면(기록 카드) 마크업
library.html         # 예전 주소 → 첫 화면으로 넘김
lobby.html           # 3D 방 = 기억 보관소(js/lobby/, 장면은 js/lobby/archive/, css/lobby.css)
sketchbook.html      # 캔버스 — 3D 방의 이젤에서만(js/sketchbook/, css/style.css)
rooms.html           # 방 둘러보기 마크업
css/library.css      # 기록 창·상세 창 등 기본 스타일(둘러보기도 같이 씀)
css/cards.css        # 첫 화면의 카드 디자인 — library.css 위에 덮어씀(body.cards 아래만)
css/nav.css          # 모든 페이지가 같이 쓰는 왼쪽 위 메뉴 + ☰ 서랍
css/visibility.css   # 둘러보기 공개 스위치(서랍의 방 설정, 둘러보기 페이지)
css/rooms.css        # 방 둘러보기 카드(바탕은 library.css를 같이 씀)
css/tier.css         # 티어리스트 보드

js/shared/config.js  # API_BASE 등, 여러 방이 공통으로 쓰는 값

js/rooms/
  main.js            # 방 둘러보기 — 공개 방 목록(GET /api/rooms)을 카드로 + 내 방 공개 스위치 + 정렬

js/tier/
  main.js            # 티어리스트 화면 — 칩 거르기, 끌기·누르기로 옮기기, 줄 접기, 저장
  board.js           # 줄 배치 규칙(별점 → 줄, 줄 안 순서, 옮기기) — DOM 없는 순수 함수

js/library/           # 첫 화면(index.html)
  main.js            # 시작점 — list/modal/welcome을 만들고 연결함
  records.js         # 백엔드와 통신 (목록 조회, 저장, 삭제, 사진 업로드)
  list.js            # 카테고리 칩 + 카드 격자(인생작 먼저 → 최신순) — 실제 그리기는 list/*.js에 위임
  list/              #   itemFormat.js(표지/별점/카테고리 아이콘/보는 중 표시), cardsView.js(뒤집는 카드·황금 카드·공감 하트·덱에서 나눠주기), compactViews.js(촘촘히·목록 보기 + 카드 크게 보기 창)
  welcome.js         # 처음 온 사람 환영 카드(빈 내 방: "첫 기록 남기기", 남의 방: "○○에 놀러 왔어요") + ? 도움말
  profileHeader.js   # 맨 위 프로필 줄 — 이름·소개 바로 고치기, 사진 크게 보기(연필·휴지통), 공개 스위치
  social.js          # 오른쪽 아래 좋아요·방명록 + 구글 로그인 안내 창
  modal.js           # 추가/수정 모달 오케스트레이션(탭·열기/닫기·저장)
  modal/             #   detailFields.js(세부 기록 — 요소별 별점·장르), categoryFields.js, starPicker.js, photoPicker.js, autocomplete.js(자동 완성 목록 위젯), recordSearch.js(제목·만든 사람 칸의 후보 — 내 방 + 공개 방 기록 + 책·음악·영화·애니 검색 규칙, 고르면 다른 칸·표지 채우기)

js/shared/
  roomNav.js         # 상단 메뉴 + ☰ 서랍(두 페이지 공통)
  roomSettings.js    # 서랍의 계정 칸(첫 화면만) — 구글 계정 연결
  avatar.js          # 프로필 사진(없으면 얼굴 없는 실루엣) — 첫 화면·둘러보기가 같이 씀
  profileApi.js      # 이름·소개·프로필 사진 저장 요청
```

각 페이지의 `main.js`가 그 페이지의 "시작점"이자 목차 역할을 함 — 전체
흐름이 궁금하면 거기부터 열어보면 됨. 백엔드 서버 주소가 바뀌면
`js/shared/config.js` 한 곳만 고치면 됨.

## 테스트

이 사이트 자체는 빌드 없이 `<script type="module">`로 바로 서비스되는
정적 파일이라, `package.json`은 순전히 [Vitest](https://vitest.dev/)를
돌리기 위한 용도로만 있음(사이트 배포에는 안 씀).

```bash
npm install
npm test
```

`tests/`는 `js/`와 같은 구조로 나눠져 있고, DOM을 직접 그리는 코드
(`modal.js` 등)보다는 fetch 응답을 다루는 로직처럼 DOM 없이
독립적으로 부를 수 있는 함수 위주로 커버함 — 예를 들어
`records.js`/`store.js`가 서버 에러 응답(`res.ok`가 false인 경우)을
제대로 걸러내는지, `room.js`가 `localStorage`/URL 쿼리를 올바르게
읽고 쓰는지 같은 것들.
