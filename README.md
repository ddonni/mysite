# 개인 사이트 (프론트엔드)

읽고 보고 들은 책/애니/영화/음악을 카드로 모아두는 개인 사이트. 기록은 백엔드 API 서버([mysite-backend](https://github.com/<사용자명>/mysite-backend))를 씀.

- `index.html` — 첫 화면 = 기록 카드. 흰 바탕에 카드 격자(폰은 3열)를 깔고, 위 줄에
  누구의 방인지 · 카테고리 칩(전체/책/애니/영화·시리즈/음악) · "+ 기록" · "?"(도움말).
  카드를 누르면 뒤집혀서 한 줄 감상이 보이고, 뒷면의 "자세히"로 상세 창(수정·인생작·삭제,
  음악은 "▶ 듣기")이 뜸. 인생작(카테고리마다 최대 3개 — 화면에선 인생책/인생애니/인생영화/
  최애음악, 코드·API에선 `featured`)은 맨 앞에 황금 카드(마우스를 따라 기울고 홀로그램 빛)로
  나옴. 처음 열 때·칩을 바꿀 때 카드가 화면 아래 덱에서 날아옴(움직임 줄이기면 안 함). 완전히
  백엔드 API에 의존함(로컬 폴백 없음). 예전엔 첫 화면이 Three.js 3D 방(로비)이었는데
  2026-11-12에 지움 — 필요하면 git 기록에서 꺼냄(`js/lobby/`, 둥근 방 이전 네모난 방은 브랜치
  `rect-room`).
- `library.html` — 예전 "기록 보관소" 주소. 쿼리(`?cat=`·`?room=`·`&new=1`)를 들고 첫 화면으로
  넘기기만 함(공유된 링크·즐겨찾기용).
- `sketchbook.html` — 예전 캔버스(그림판) 주소. 캔버스는 2026-11-12에 없앴고(git 기록의
  `js/sketchbook/`), 이 주소는 `?room=`을 들고 첫 화면으로 넘기기만 함.
- `rooms.html` — 방 둘러보기. 방 주인이 "둘러보기에 공개"를 켠 방들(기록이 있는
  방만, 최근 활동순)을 카드로 보여주고, 누르면 그 방에 읽기 전용으로 놀러 감.
  공개 스위치(`js/shared/visibilityToggle.js`)는 이 페이지 위쪽과 첫 화면 ☰ 서랍의 방 설정에
  있고, 기본은 비공개. 비공개여도 방 코드를 아는 사람은 들어올 수 있음.

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
sketchbook.html      # 예전 캔버스 주소 → 첫 화면으로 넘김
rooms.html           # 방 둘러보기 마크업
css/library.css      # 기록 창·상세 창 등 기본 스타일(둘러보기도 같이 씀)
css/cards.css        # 첫 화면의 카드 디자인 — library.css 위에 덮어씀(body.cards 아래만)
css/nav.css          # 모든 페이지가 같이 쓰는 왼쪽 위 메뉴 + ☰ 서랍
css/visibility.css   # 둘러보기 공개 스위치(서랍의 방 설정, 둘러보기 페이지)
css/rooms.css        # 방 둘러보기 카드(바탕은 library.css를 같이 씀)

js/shared/config.js  # API_BASE 등, 여러 방이 공통으로 쓰는 값

js/rooms/
  main.js            # 방 둘러보기 — 공개 방 목록(GET /api/rooms)을 카드로 + 내 방 공개 스위치

js/library/           # 첫 화면(index.html)
  main.js            # 시작점 — list/modal/welcome을 만들고 연결함
  records.js         # 백엔드와 통신 (목록 조회, 저장, 삭제, 사진 업로드)
  list.js            # 카테고리 칩 + 카드 격자(인생작 먼저 → 최신순) — 실제 그리기는 list/*.js에 위임
  list/              #   itemFormat.js(표지/별점), cardsView.js(뒤집는 카드·황금 카드·덱에서 나눠주기), detail.js(뒷면 "자세히"의 상세 창)
  welcome.js         # 처음 온 사람 환영 카드(빈 내 방: "첫 기록 남기기", 남의 방: "○○에 놀러 왔어요") + ? 도움말
  modal.js           # 추가/수정 모달 오케스트레이션(탭·열기/닫기·저장)
  modal/             #   categoryFields.js, starPicker.js, photoPicker.js, autocomplete.js(자동 완성 목록 위젯), recordSearch.js(제목·만든 사람 칸의 후보 — 내 방 + 공개 방 기록 + 책·음악·영화·애니 검색 규칙, 고르면 다른 칸·표지 채우기)

js/shared/
  roomNav.js         # 상단 메뉴 + ☰ 서랍(두 페이지 공통)
  roomSettings.js    # 서랍의 방 설정(첫 화면만) — 방 이름, 둘러보기 공개, 구글 계정 연결
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
