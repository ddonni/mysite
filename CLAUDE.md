# mysite — 작업 이어가기 메모

학원 다니는 동안 여러 PC(학원/집)에서 Claude Code로 이어서 작업하려고 둔
임시 메모. Claude의 메모리는 PC마다 따로라서, 필요한 맥락을 여기 적어 git으로
같이 옮김. **프로젝트가 끝나거나 학원을 그만두면 이 파일은 지울 것.**
공개 저장소라 지워도 git 기록에 남으니 토큰·이메일 같은 개인 정보는 적지 않음.

## 작업 방식 (사용자 선호)

- 대화·코드 주석·문서 전부 한국어. 주석은 "왜"를 설명하는 기존 밀도를 따름.
- 사용자는 백엔드 쪽이 더 익숙함 — 프론트/3D 동작은 HTTP·DB 개념에 빗대 설명.
- 확인 질문은 최소로. 배포(push)나 되돌리기 어려운 일만 먼저 물어보고, 나머지는 그냥 진행.
- Bash에서 `cd 경로 && 명령`을 쓰지 말 것(권한 확인 창이 자주 뜸) —
  `git -C <경로>`, `npm --prefix <경로>`, 절대 경로를 씀.
- 커밋 메시지는 영어, 주제별로 나눔. 프론트는 push하면 바로 배포됨(GitHub Pages,
  약 40초). **백엔드는 push만으로 운영에 안 올라감** — EC2에서 수동으로 받아서 재시작
  (`mysite-backend/CLAUDE.md`의 "배포" 참고).

## 폴더 구조

작업 폴더 `mysite-project/`는 git 저장소가 아니고, 안에 저장소 두 개가 따로 있음.

- `mysite/` — 이 저장소. 빌드 없는 정적 사이트(GitHub Pages `ddonni.github.io/mysite`).
  테스트는 Vitest(`npm test`). 구조는 README.md 참고.
- `mysite-backend/` — FastAPI + PostgreSQL + S3, 직접 운영하는 EC2에서 돌아감
  (2026-10-18 Render에서 전환). 규칙·에러 문자열
  계약은 그 저장소의 CLAUDE.md 참고. 테스트는 `pytest -q`(SQLite) — 반드시
  `mysite-backend` 폴더를 기준으로 돌릴 것(아니면 `test.db`가 엉뚱한 폴더에 생김).
- `mysite-infra/` — 백엔드를 EC2로 옮기고 운영하는 인프라 프로젝트(문서 저장소).
  서버 구성, 전환 절차(CUTOVER.md), 장애 기록은 거기에.
- `DATA_FLOW.md`(상위 폴더, git 밖) — 프론트↔백엔드 데이터 흐름 설명. OneDrive로만 동기화됨.

## 두 저장소가 맞물린 곳 (한쪽을 바꾸면 다른 쪽도)

- 에러 문자열(`featured_limit`, `not_music`, `page not found`, `not room owner` 등, 업로드 415/413).
- 턴테이블 곡: 백엔드 `records.playing`(방마다 한 곡, `PUT .../records/{id}/playing`) ↔
  `js/lobby/showcase.js`의 `pickMusic`(고른 곡 → 첫 최애음악 → 최신 곡 순).
- 테마 목록: 백엔드 `schemas.ROOM_THEMES` ↔ `js/lobby/scene.js`의 `THEMES`
  (색은 `js/rooms/main.js`의 `THEME_COLORS`에도 — 둘러보기 카드 띠).
- 방 둘러보기: 백엔드 `rooms.is_public` + `GET /api/rooms`(공개·기록 있는 방만) +
  `PUT .../visibility` ↔ `rooms.html`/`js/rooms/main.js`, `js/shared/visibilityToggle.js`.
- 자동 완성(제목 칸·만든 사람 칸, 서로 독립): 백엔드 `GET .../suggestions?field=title|creator`
  (`crud.suggestions`) ↔ `js/library/modal/presetAutocomplete.js`(제목 칸만 "이미 기록함"). 코드에 박아 둔 추천 제목
  (`PRESETS`)은 책·음악·영화·애니 검색이 생겨서 지움.
- 의견 보내기: 백엔드 `POST /api/feedback`(`schemas.FeedbackIn` 길이 제한, 429 제한) ↔
  `js/shared/feedback.js`(`MESSAGE_MAX`·`NAME_MAX`). 네 html 모두 메뉴의
  `data-feedback-open` 버튼 + `css/feedback.css` + 이 스크립트를 따로 불러옴.
  받은 의견은 서버에서 psql로 봄(`mysite-backend/CLAUDE.md`).
- `GOOGLE_CLIENT_ID`: `js/shared/config.js` ↔ 백엔드 환경 변수(같은 값이어야 함).
- 책 검색: 백엔드 `GET /api/search/book`(카카오, 키는 백엔드 `KAKAO_REST_KEY`) ↔
  `js/library/records.js`의 `searchBooks` + `modal/recordSearch.js`의 `titleSuggestions`/`fillFromPick`
  (책 탭·두 글자부터, 고르면 작가·표지까지 채움).
  **고르는 건 "이걸로 하겠다"는 선택**이라 결과가 가진 제목·작가는 전에 직접 쓴 값이 있어도 바꿈
  (`fillFromPick`). 고른 뒤에 고친 값은 다음에 또 고르기 전까지 그대로. 사진만 예외 — 직접 올린
  사진(새 파일, S3에 올려 둔 사진)은 안 바꾸고 검색 표지(`photoSrc.js`의 `isSearchCover`)만 바꿈.
- 음악 검색: 백엔드 `GET /api/search/music`(유튜브 뮤직, 비공식 ytmusicapi — 로그인 없이는
  **앨범만**, 일반 검색은 3개까지. 가수 칸만으로 찾을 땐 `by=artist`로 그 가수의 앨범·싱글 최대
  12개) ↔ `records.js`의 `searchMusic` + `modal/recordSearch.js`의 `titleSuggestions`
  (가수 칸에 **직접 쓴** 가수가 있으면 "가수 제목"으로 검색 — 앞서 고른 결과로 자동으로
  채워진 가수는 안 씀, 그걸로 0건이면 제목만으로 다시 찾고 목록 위에 알림, 가수 칸을
  나중에 고쳐도 다시 검색). 검색 중엔 "검색 중…", 결과가 없으면 "'검색어' 검색 결과가
  없어요", 검색 자체가 실패하면 "지금은 검색할 수 없어요"(책 탭도 같음).
  만든 사람 칸도 책·음악이면 검색함(`creatorSuggestions` — 책은 `searchBooks(q, signal,
  'author')`로 작가 이름만, 음악은 가수 이름으로 앨범). 고르면 이름·표지, 책·영화·애니는 제목까지
  (음악은 제목 안 채움 — 결과가 앨범). 칸에 손대거나 작가 칸 결과를 고른 값은 "직접 쓴 값"
  (`autoTitle`/`autoCreator`가 null)이라 두 칸을 합친 검색에 씀.
  **두 칸이 다 차 있으면 어느 칸에서 치든 합쳐 검색**(`modal/recordSearch.js`의 `webSearch` — 책은
  "제목 작가"를 카카오 기본 검색으로, 음악은 "가수 제목"). 다른 칸 값은 직접 쓴 것만 쓰고,
  합쳐서 0건이면 지금 칸만으로 다시 찾아 목록 위에 "'…'까지 넣으면 결과가 없어 …만으로
  찾았어요". 작가 칸을 고치고 나가면 제목 칸 목록도 합친 검색으로 다시(책·음악 모두).
  영화·애니 탭도 두 칸 다 TMDB로 검색(`searchScreen`): 제목 칸은 제목으로, 감독 칸은
  `by='director'`로 그 감독의 연출작. TMDB엔 "제목+감독" 검색이 없어서 두 칸이 다 차 있으면
  연출작을 받아 제목으로 걸러냄(`screenSearch`/`titled`, 0건이면 지금 칸만으로 + 알림).
  제목 검색 결과를 고르면 포스터, 그다음 `fetchScreenCreator`로 감독을 따로 물어 감독 칸에
  채움 — 그사이 다른 걸 고르거나 감독 칸을 직접 고치면 늦게 온 답은 버림(`creatorLookup`). 연출작
  결과는 감독(`creator`)을 이미 알아서 따로 안 물음. 목록 아래 TMDB 출처
  + 보증 아님 문구는 TMDB 약관이라 지우면 안 됨.
  두 칸 목록은 서로를 클릭·포커스로 닫거나 덮지 않고(`keepOpenOn`/`openOnFocus`), 한쪽에
  입력을 시작하면 다른 쪽 목록을 닫음.
  제목·만든 사람 칸은 위아래 한 묶음(`.title-group`)이고 두 칸의 추천 목록은 묶음 아래(가수
  칸 밑)에 뜸 — 목록이 가수 칸을 가리지 않게. 한 줄 배치는 긴 제목이 잘려서 되돌림.
  고르면 가수·커버만 채우고 **제목은 입력한 그대로**(대개 노래 제목이라). 커버 서버
  (yt3.googleusercontent.com)는 CORS를 줘서 중계 안 거침. 목록 그리기는 책·음악 모두
  `presetAutocomplete.js`의 후보 `card`({title, meta, cover, square}) 하나로.
  표지 중계: 백엔드 `GET /api/cover` + `book_search.COVER_HOSTS` ↔ `js/shared/photoSrc.js`의
  `RELAY_HOSTS`(같아야 함). 사진을 띄우는 곳(로비 `coverImage.js`, 목록 `itemFormat.js`,
  추가 창 `photoPicker.js`, 검색 목록)은 전부 `photoSrc()`를 거침.
- 구글 방 복구: `POST /api/auth/google` 응답의 `current_empty`(지금 브라우저의 방이
  비었는지, 다른 방을 복구할 때만 true/false) ↔ `js/shared/googleAuth.js`(빈 방이면
  묻지 않고 넘어가고, 아니면 확인 창 → 취소 시 안내).
- 앱 안 브라우저(카톡·인스타 웹뷰): `js/shared/inAppBrowser.js` + `css/inapp.css`를 네 html이
  모두 페이지 본체 스크립트보다 **앞에** 불러옴. 카톡은 세션당 한 번 바깥 브라우저로 자동
  이동, 그 밖엔 안내 띠. 웹뷰에선 구글 로그인 버튼 대신 안내 문구(구글이 웹뷰 로그인을 막음).
- 처음 온 사람 안내(강사님 피드백 "뭘 해야 할지 모르겠다"): 로비 환영 카드는 `js/lobby/helpDialog.js`
  — **기록 0개인 내 방**이면 "첫 기록 남기기"(카테고리 → `library?cat=…&new=1`로 새 기록 창을
  바로 엶, `js/library/main.js`가 `new`를 주소에서 지움) + "예시 방 먼저 구경하기"(개발자의 방),
  **남의 방**이면 "○○에 놀러 왔어요" + "나도 내 방 만들기". 주인·방문자 환영은 localStorage
  키를 따로 둠. 기록이 이미 있는 내 방엔 안 띄움. `?` 버튼은 전체 도움말(터치 기기면 "손가락으로
  밀어서"). 빈 방 말풍선·빈 가구 카드 문구("첫 책 기록하기")는 `js/lobby/onboarding.js`. 기록은
  `roomContext.js`의 `roomRecords`로 한 번만 받아 3D와 안내가 같이 씀. 음악 카드의 턴테이블
  버튼은 "턴테이블에 올리기"/"◉ 턴테이블 위"(예전 "▶ 재생"은 진짜 소리가 나는 줄 알게 해서 바꿈).
- 개발자의 방: `config.js`의 `DEVELOPER_ROOM_CODE = 'TTHB8N'`(사용자 본인 방,
  "도현의 방"). 방문자에게만 로비 왼쪽 아래 "개발자의 방 구경하기" 링크로 뜸.

## 로컬에서 띄워 보기

`localhost`로 열면 프론트는 운영이 아니라 `http://localhost:8000` 백엔드를 봄
(`config.js`의 `isLocalDev`). 운영 서버는 CORS가 `ddonni.github.io`만 허용해서
로컬 프론트로 운영 데이터를 직접 볼 수는 없음. 지금까지 쓴 방법:

1. 임시 SQLite DB를 만들고, 운영의 공개 GET(`/api/rooms/TTHB8N`, `/pages/1`,
   `/records`)으로 받은 데이터를 `app.models`로 넣음(토큰은 새로 만듦).
2. 백엔드: `DATABASE_URL=sqlite:///<임시DB>` 와 `GOOGLE_CLIENT_ID=<config.js 값>`을
   넣고 `python -m uvicorn app.main:app --app-dir <mysite-backend> --port 8000`.
   client id는 정규식으로 뽑을 것(`=` 앞뒤 공백이 바뀐 적 있음). 이게 비면 구글
   로그인이 400 `invalid google token`으로 실패함.
3. 프론트: `/library` → `library.html`처럼 확장자 없는 주소를 처리하는 작은 정적
   서버로 `mysite`를 5500 포트에 띄움(GitHub Pages가 그렇게 동작해서
   `python -m http.server`로는 메뉴 링크가 404가 남).

## 정해둔 것 / 남은 일

- 페이지 이동 시 데이터 캐싱(localStorage)은 시도했다가 되돌림 — 사용자가 렉을
  못 느낀다고 함. 다시 렉 얘기가 나오기 전엔 제안하지 않음.
- **백엔드 주소**: `config.js`의 `API_BASE` = `https://mysite-ddonni.duckdns.org`
  (2026-10-18 `53fb4ff`로 전환, 그 전엔 `https://sketchbook-api.onrender.com`). 이 한 줄이
  전환·롤백 스위치임 — 되돌릴 땐 그 커밋을 revert. WebSocket 주소도 여기서 만들어짐.
- 사진: **새로 올리는 사진**은 `mysite-photos-ddonni`(서울)로 감. **예전 사진**(약 119장,
  5.4MB)은 `mysite-buckets`(시드니, 만든 계정을 못 찾은 다른 AWS 계정)에 그대로 있고 DB에
  전체 URL로 저장돼 있어서 계속 보임. 병행 운영이 끝나면 새 버킷으로 복사하고
  `photo_url`을 바꿀 예정. 업로드 전 줄이기(1200px)와 캐시 헤더는 새로 올리는 사진부터 적용됨.
- Render 서비스와 Neon은 2026-10-25에 삭제함(병행 운영 종료). 그래서 `API_BASE`를 revert해도
  돌아갈 곳이 없음. "Render가 잠듦" 대비는 2026-10-25에 정리함: `js/shared/wake.js` →
  `slow.js`("서버를 깨우는 중" → "연결이 느려요"), 캔버스의 서버 대기 45초 → 10초(그 뒤엔 이 기기
  저장으로 — 서버 장애 대비라 이 폴백 자체는 유지). 예전 Render 자동 배포
  문제(2026-10-15, 원인 미확인)는 더 이상 운영에 영향 없음.
