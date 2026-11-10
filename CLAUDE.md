# mysite — 작업 이어가기 메모

학원 다니는 동안 여러 PC(학원/집)에서 Claude Code로 이어서 작업하려고 둔
임시 메모. Claude의 메모리는 PC마다 따로라서, 필요한 맥락을 여기 적어 git으로
같이 옮김. **프로젝트가 끝나거나 학원을 그만두면 이 파일은 지울 것.**
공개 저장소라 지워도 git 기록에 남으니 토큰·이메일 같은 개인 정보는 적지 않음.

## 작업 방식 (사용자 선호)

- 대화·코드 주석·문서 전부 한국어. 주석은 "왜"를 설명하는 기존 밀도를 따름.
- 사용자는 백엔드 쪽이 더 익숙함 — 프론트/3D 동작은 HTTP·DB 개념에 빗대 설명.
- 확인 질문은 최소로. 배포(push)나 되돌리기 어려운 일만 먼저 물어보고, 나머지는 그냥 진행.
- **사용자가 낸 의견(기능·문구·화면 변경)은 push 전에 로컬에서 띄워서 사용자가 직접 확인하게 할 것**
  (2026-10-26 요청). 테스트 통과만으로 push하지 않음. 폰 화면은 로컬 페이지에서 브라우저 개발자도구의
  기기 모드로 확인(같은 Wi-Fi의 폰으로 열면 운영 API를 보게 돼 CORS로 막힘).
- Bash에서 `cd 경로 && 명령`을 쓰지 말 것(권한 확인 창이 자주 뜸) —
  `git -C <경로>`, `npm --prefix <경로>`, 절대 경로를 씀.
- 커밋 메시지는 영어, 주제별로 나눔. 프론트는 push하면 바로 배포됨(GitHub Pages,
  약 40초). **백엔드도 `main`에 push하면 자동 배포**(2026-10-28부터 — 테스트 통과 → GitHub
  OIDC → SSM으로 그 커밋만 EC2에 올림, DB 마이그레이션은 서버가 켜질 때 자동). DB 칸을 새로
  쓰는 기능이면 백엔드를 먼저 push. 자세한 건 `mysite-backend/CLAUDE.md`.

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
  (`crud.suggestions`) ↔ `js/library/modal/autocomplete.js`(제목 칸만 "이미 기록함"). 코드에 박아 둔 추천 제목
  (`PRESETS`)은 책·음악·영화·애니 검색이 생겨서 지움.
- 의견 보내기: 백엔드 `POST /api/feedback`(`schemas.FeedbackIn` 길이 제한, 429 제한) ↔
  `js/shared/feedback.js`(`MESSAGE_MAX`·`NAME_MAX`). 네 html 모두 메뉴의
  `data-feedback-open` 버튼 + `css/feedback.css` + 이 스크립트를 따로 불러옴.
  받은 의견은 관리자 페이지 `admin.html`(`js/admin/`)에서 봄 — 구글 로그인 ID 토큰을
  `Authorization: Bearer`로 보내면 백엔드 `GET /api/admin/feedback`이 서버 환경 변수
  `ADMIN_EMAILS`에 든 이메일인지 확인함(비어 있으면 아무도 못 봄). 정리본은 `FEEDBACK.md`.
- `GOOGLE_CLIENT_ID`: `js/shared/config.js` ↔ 백엔드 환경 변수(같은 값이어야 함).
- 새 기록 창: **검색부터**(`js/library/modal/searchView.js` → `modal/findWorks.js`). 검색어 하나로
  이름(작가 `by=author`·감독 `by=director`) 검색과 제목 검색을 둘 다 해서 합침. 검색 버튼·Enter를
  눌러야 찾음(한 글자 제목도 됨). 결과를 고르거나 "+ 넣기"를 누르면 값이 채워진 입력 칸(별점·감상을
  쓰고 저장 → 다시 검색 화면, 결과는 그대로). "+ 직접 쓰기"는 빈 입력 칸. 수정은 입력 칸만.
  입력 칸의 **제목 칸 자동 완성도 같은 `findWorks`**(2026-11-06 — 예전엔 따로 찾아서 결과가 달랐음)
  + 위에 이 방·공개 방들의 기존 기록 후보(`GET .../suggestions`) 3개까지. 만든 사람 칸은 예전 방식
  (`modal/recordSearch.js`의 `creatorSuggestions`/`webSearch` — 제목 칸에 직접 쓴 값이 있으면 합쳐 찾고,
  0건이면 이름만으로 + 목록 위 알림; 음악 가수 칸은 `by=artist`로 앨범·싱글).
  검색 중엔 "검색 중…", 결과가 없으면 "'검색어' 검색 결과가 없어요", 검색 자체가 실패하면
  "지금은 검색할 수 없어요".
- 책 검색: 백엔드 `GET /api/search/book`(카카오, 키는 백엔드 `KAKAO_REST_KEY`) ↔ `records.js`의
  `searchBooks`. **고르는 건 "이걸로 하겠다"는 선택**이라 결과의 제목·작가는 전에 쓴 값이 있어도 바꿈
  (`fillFromPick`). 사진만 예외 — 직접 올린 사진은 안 바꾸고 검색 표지(`photoSrc.js`의 `isSearchCover`)만.
- 음악 검색: 백엔드 `GET /api/search/music`(유튜브 뮤직, 비공식 ytmusicapi — 로그인 없이는 노래
  검색이 안 되고 앨범만 옴, 노래 제목은 iTunes로 실린 앨범을 찾음). 기록은 **노래 단위**:
  `findWorks`의 `findSongs`가 `by=songs`(가수 페이지의 앨범·싱글 수록곡 전부 — 페이지엔 10개까지만
  와서 `get_artist_albums`로 나머지도)와 일반 검색을 합쳐, 검색어가 가수 이름이면 그 가수의 노래,
  "제목 가수"("뉴질랜드 래원")면 그 가수의 그 노래, 아니면 쓴 제목 그대로의 줄을 가수마다 하나씩.
  같은 제목은 가수까지 봐서 하나만. 커버 서버(yt3.googleusercontent.com)는 CORS를 줘서 중계 안 거침.
- 음악 재생(2026-11-06): 기록의 `listen_url`(백엔드 `schemas.is_youtube_url` ↔ `js/shared/youtube.js`의
  `parseYouTube` — 같은 규칙, https 유튜브 영상·재생목록만). 로그인 없는 유튜브 뮤직은 노래별 영상
  번호를 안 줘서 **앨범 재생목록 + 몇 번째 곡**(`playlist?list=OLAK5uy_…&index=N`)으로 저장 — 노래
  목록 결과엔 `listen`이 바로 오고, 앨범 줄은 `GET /api/search/music/listen?album_id=&song=`로 물음.
  입력 칸의 "유튜브 링크" 칸(음악만, 직접 붙여 넣어도 됨, "▶ 들어보기"). 재생은 `youtube.js`의
  `getPlayer()` — 유튜브 IFrame API 임베드를 화면 구석 작은 창(약관상 숨기면 안 됨, 200px 이상)으로,
  재생목록은 그 곡부터 틀고 다음 곡으로 넘어가면 멈춤. 광고는 영상 주인이 켰으면 나옴. 상세 창
  "▶ 듣기"(방문자도), 로비 턴테이블의 ▶/■ 스프라이트 버튼(`turntable.js` `setPlayButton`, 확대
  여부 상관없이 눌림 — `controls.js`의 `hitsPlayButton`)과 음악 카드 "▶ 듣기". **저절로 틀지 않음**
  (사용자 결정 — 누를 때만).
- 영화·애니 검색: 백엔드 `GET /api/search/screen`(TMDB, 키는 백엔드 `TMDB_TOKEN`) ↔ `searchScreen`.
  영화 탭 이름은 "영화·시리즈"(드라마도 나옴, 카테고리 키는 그대로 `movie`, 벽 글씨 "MOVIE & SERIES").
  제목 검색 결과엔 감독이 없어서 고른 것만 `fetchScreenCreator`로 따로 물음 — 그사이 다른 걸 고르거나
  감독 칸을 고치면 늦은 답은 버림. 목록 아래 TMDB 출처 + 보증 아님 문구는 TMDB 약관이라 지우면 안 됨.
- 입력 칸 배치: 제목·만든 사람 칸은 위아래 한 묶음(`.title-group`)이고 두 칸의 목록은 묶음 아래에 뜸
  (목록이 가수 칸을 가리지 않게). 두 목록은 한 번에 하나만(`autocomplete.js`의 `onShow`), 서로를
  클릭·포커스로 닫거나 덮지 않음(`keepOpenOn`/`openOnFocus`). 카테고리 탭을 바꾸면(`recordSearch.js`의
  `refresh`) 직접 쓴 값은 두고 검색 결과로 채운 값(`autoTitle`/`autoCreator`/`autoCover`)만 지움.
  폰 키보드: `modal/fitViewport.js`가 창을 `visualViewport`에 맞추고, 저장·취소 줄(`.modal-actions`)은
  `position:sticky`. 창이 열린 동안 `body.modal-open` + `overscroll-behavior:contain`(아이폰에서 끝까지
  당기면 창이 밀리고 뒤가 보였음).
- 사진: 사진을 띄우는 곳(로비 `coverImage.js`, 목록 `itemFormat.js`, 추가 창 `photoPicker.js`, 검색
  목록)은 전부 `photoSrc()`를 거치고 **`crossorigin="anonymous"`로** 받음 — S3·TMDB는 Origin 없는
  요청엔 CORS 헤더 없이 1년 캐시로 답해서, 한 곳이라도 그냥 받으면 그 캐시 때문에 로비 WebGL
  텍스처가 막혔음(사진이 캐시를 지워야 보이던 문제). 표지 중계: 백엔드 `GET /api/cover` +
  `book_search.COVER_HOSTS` ↔ `photoSrc.js`의 `RELAY_HOSTS`(같아야 함, 카카오 표지만).
- 구글 방 복구: `POST /api/auth/google` 응답의 `current_empty`(지금 브라우저의 방이
  비었는지, 다른 방을 복구할 때만 true/false) ↔ `js/shared/googleAuth.js`(빈 방이면
  묻지 않고 넘어가고, 아니면 확인 창 → 취소 시 안내).
- 앱 안 브라우저(카톡·인스타 웹뷰): `js/shared/inAppBrowser.js` + `css/inapp.css`를 네 html이
  모두 페이지 본체 스크립트보다 **앞에** 불러옴. 카톡·안드로이드 인스타는 세션당 한 번 바깥
  브라우저로 자동 이동(인스타는 공식 방법이 없어 크롬 intent), 그 밖엔 안내 띠. 아이폰 인스타
  띠엔 "크롬으로 열기"(`googlechromes://` — 크롬이 없으면 무반응이라 자동 이동엔 안 씀)·링크
  복사. 사파리를 여는 `x-safari-https://`는 인스타가 막음(2026-10 실기기 확인)이라 안 씀. `?v=` 붙이지 말 것 —
  `googleAuth.js`도 import해서 주소가 다르면 모듈이 두 번 돌아 띠가 두 개 뜸. 웹뷰에선 구글 로그인 버튼 대신 안내 문구(구글이 웹뷰 로그인을 막음).
- 링크 미리보기(카톡·인스타): 네 html `<title>` 아래 `og:*` 태그, 이미지는 루트의
  `og-image.png`(1200×630, 원본은 `tools/og-card.html` — 고치면 headless Edge
  `--screenshot --window-size=1200,630`으로 다시 찍음). 크롤러가 JS를 안 돌려서 방마다
  다른 카드는 안 함(사용자 결정). 바꾼 뒤엔 카카오 개발자 사이트 "공유 디버거"에서 캐시 초기화.
- 처음 온 사람 안내(강사님 피드백 "뭘 해야 할지 모르겠다"): 로비 환영 카드는 `js/lobby/helpDialog.js`
  — **기록 0개인 내 방**이면 "첫 기록 남기기"(카테고리 → `library?cat=…&new=1`로 새 기록 창을
  바로 엶, `js/library/main.js`가 `new`를 주소에서 지움) + "예시 방 먼저 구경하기"(개발자의 방),
  **남의 방**이면 "○○에 놀러 왔어요" + "나도 내 방 만들기". 주인·방문자 환영은 localStorage
  키를 따로 둠. 기록이 이미 있는 내 방엔 안 띄움. `?` 버튼은 전체 도움말(터치 기기면 "손가락으로
  밀어서"). 빈 방 말풍선·빈 가구 카드 문구("첫 책 기록하기")는 `js/lobby/onboarding.js`. 기록은
  `roomContext.js`의 `roomRecords`로 한 번만 받아 3D와 안내가 같이 씀. 음악 카드의 턴테이블
  버튼은 "턴테이블에 올리기"/"◉ 턴테이블 위"(예전 "▶ 재생"은 소리가 안 나는데 나는 줄 알게 해서
  바꿨음 — 실제 재생은 위 "음악 재생"의 ▶ 듣기).
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
4. 검색: 로컬엔 카카오·TMDB 키가 없어서(운영 키는 가져오지 않음), 백엔드 앱 앞에 작은 미들웨어를
   붙여 `/api/search/*`(음악 제외 — 키가 필요 없어 로컬 코드로)와 `/api/cover`만 운영 서버로 넘겨서 씀.
   DB 칸을 새로 만든 기능이면 이미 있는 로컬 SQLite에는 `ALTER TABLE`로 칸을 직접 더함
   (`create_all`은 있는 표를 안 고침).

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
