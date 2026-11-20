# mysite — 작업 이어가기 메모

학원 다니는 동안 여러 PC(학원/집)에서 Claude Code로 이어서 작업하려고 둔
임시 메모. Claude의 메모리는 PC마다 따로라서, 필요한 맥락을 여기 적어 git으로
같이 옮김. **프로젝트가 끝나거나 학원을 그만두면 이 파일은 지울 것.**
공개 저장소라 지워도 git 기록에 남으니 토큰·이메일 같은 개인 정보는 적지 않음.

## 작업 방식 (사용자 선호)

- 대화·코드 주석·문서 전부 한국어. 주석은 "왜"를 설명하는 기존 밀도를 따름.
- 사용자는 백엔드 쪽이 더 익숙함 — 프론트 동작은 HTTP·DB 개념에 빗대 설명.
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
- **3D 방 = 기억 보관소(`lobby.html`, `js/lobby/`)**: 2026-11-18에 `3d-room` 브랜치의 둥근 방을 되살렸다가
  같은 날 사용자 요청("인사이드 아웃의 기억 보관소처럼")으로 **통째로 바꿈** — 옛 가구 방은 `3d-room` 브랜치에만.
  카드 홈 메뉴 줄의 "3D 방" 버튼으로 감(`data-page`라 남의 기록을 보던 중이면 그 방). 구조(`js/lobby/archive/`):
  끝없는 통로 양옆 둥근 서가 탑에 **기록이 한 칸씩** — 책은 두께 있는 책, 영화·애니는 포스터, 음악은 앨범 재킷
  (`covers.js` — 앞면은 실제 표지, 표지는 아틀라스 캔버스(한 장 160칸)에 모아 상자 하나를 InstancedMesh로; 같은 날
  처음엔 빛나는 구슬이었다가 사용자 요청으로 "예전처럼 책·포스터로" 바꿈). 진열 = **카테고리 구분 없이 날짜순**
  (`layout.js` — 오래된 것부터 입구 탑 아랫줄, 빈 선반은 앞으로 채울 자리). 인생작은 조금 크게 + 금테. 탑 안쪽·바닥
  빛은 표지 대표색(`orbColor.js`). 둘러보기(`controls.js`, 사용자 요청 "이동을 자연스럽게, 기본은 위에서"): 지도처럼
  한 점을 중심으로 도는 카메라 — 끌기 돌리기, 오른쪽·Shift·두 손가락 끌기 옮기기, 휠·핀치 커서 쪽으로 다가가기,
  관성, 바닥 누르면 그곳이 가운데로. 처음 화면은 최근 기록이 꽂힌 탑을 비스듬히 가까이(평가 후 — 전체를 내려다보면
  표지가 점처럼 작았음), 아래 "전체 보기"↔"가까이 보기" 버튼. 빈 탑은 하나만(최소 두 쌍). 색은 짙은 남보라 + 금테·
  금빛 조명(카드 홈 톤에 맞춤). 기록을 누르면
  그 책·포스터가 눈앞으로 날아와 크게(`heldCover.js`) + 기록 패널(카드로 보기·음악 ▶ 듣기). 아래 버튼은 카테고리만
  밝히기 + 캔버스(이젤로).
  **이웃 서가**(`neighbors.js`, 2026-11-18 사용자 요청 "빈 공간을 다른 사람 기록으로"): 통로 바로 바깥 줄에 공개 방
  하나당 서가 한 묶음 + 이름표, **그 방 기록 전부를 날짜순으로**(2026-11-20 사용자 요청 — 전엔 인생작 12개만이라
  인생작이 없는 방은 안 보였음). 최근 활동순 최대 16개 방, 방마다 `/records`를 받아 붙임(`roomContext.js`의
  `publicRooms`). 탑 하나에 72개, 넘으면 같은 쪽에 탑이 이어지고, 탑 하나짜리는 기록이 찬 만큼만 높게(최소 2줄).
  묶음은 더 짧은 쪽에 붙음(`layoutNeighbors`). 표지를 누르면 내 기록처럼 꺼내 봄,
  이름표를 누르면 그 서가 앞으로. **가운데는 늘 내 서가 — 남의 보관소 화면은 없음**(사용자 결정). `lobby?room=코드`는
  "그 이웃 서가를 맨 앞에 두고 비춰라"(`focusCode`, 주소에서는 바로 지움 — 위 메뉴가 남의 방으로 착각하지 않게),
  그 방이 비공개라 목록에 없으면 그 방 정보를 받아 맨 앞에 붙임(받은 링크는 늘 보이게). 스위치 설명
  문구는 그대로 둠(사용자 결정). "링크 복사"는 `lobby?room=내코드`(`roomShareUrl(code, base, 'lobby')`).
  프론트가 안 쓰게 된 백엔드: 턴테이블 곡 `records.playing`, 방 테마 `schemas.ROOM_THEMES`(테마 고르기는 뺌 —
  둘러보기 카드 띠 색 `js/rooms/main.js`의 `THEME_COLORS`만 씀).
- **캔버스(`sketchbook.html`, `js/sketchbook/`)**: 2026-11-18 되살림, **보관소 입구 옆 이젤에서만** 들어감(사용자
  결정 — 카드 화면엔 캔버스로 가는 길이 없음). 백엔드 그림 API `/pages/{n}`, WebSocket
  `/ws/rooms/{code}/pages/{n}`, `pages` 표. 3D 방 이젤의 그림 미리보기도 같은 API(`js/shared/strokes.js`).
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
  와서 `get_artist_albums`로 나머지도), 일반 검색, `by=track`(2026-11-19 — iTunes로 그 제목의 수록곡을
  찾아 유튜브 앨범의 곡으로, "샴페인" → 2PM·동방신기의 샴페인)을 합쳐, 검색어가 가수 이름이면 그 가수의 노래,
  "제목 가수"("뉴질랜드 래원")면 그 가수의 그 노래, 그 가수 노래 중 제목이 안 맞으면("샴페인 에픽하이" —
  유튜브엔 "Champagne") 쓴 제목 줄 + 그 가수 노래 목록(검색어로 찾힌 앨범의 곡을 앞에), 아니면 제목 검색
  곡들 → 쓴 제목 그대로의 줄을 가수마다 하나씩. 가수 이름을 뺄 땐 함께 받은 결과들의 가수 표기를 전부 봄
  (앨범 결과는 영어 "Epik High"라서). 한계: "샴페인"만으론 에픽하이 곡이 안 나옴(iTunes 순위가 너무 낮음).
  같은 제목은 가수까지 봐서 하나만. 커버 서버(yt3.googleusercontent.com)는 CORS를 줘서 중계 안 거침.
- 음악 재생(2026-11-06): 기록의 `listen_url`(백엔드 `schemas.is_youtube_url` ↔ `js/shared/youtube.js`의
  `parseYouTube` — 같은 규칙, https 유튜브 영상·재생목록만). 로그인 없는 유튜브 뮤직은 노래별 영상
  번호를 안 줘서 **앨범 재생목록 + 몇 번째 곡**(`playlist?list=OLAK5uy_…&index=N`)으로 저장 — 노래
  목록 결과엔 `listen`이 바로 오고, 앨범 줄은 `GET /api/search/music/listen?album_id=&song=`로 물음.
  입력 칸의 "유튜브 링크" 칸(음악만, 직접 붙여 넣어도 됨, "▶ 들어보기"). 재생은 `youtube.js`의
  `getPlayer()` — 유튜브 IFrame API 임베드를 화면 구석 작은 창(약관상 숨기면 안 됨, 200px 이상)으로,
  재생목록은 그 곡부터 틀고 다음 곡으로 넘어가면 멈춤. 광고는 영상 주인이 켰으면 나옴. 상세 창
  "▶ 듣기"(방문자도)와 음악 카드 뒷면 "▶ 듣기". **저절로 틀지 않음**
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
- 사진: 사진을 띄우는 곳(목록 `itemFormat.js`, 추가 창 `photoPicker.js`, 검색 목록)은 전부
  `photoSrc()`를 거치고 **`crossorigin="anonymous"`로** 받음 — S3·TMDB는 Origin 없는 요청엔 CORS
  헤더 없이 1년 캐시로 답해서, 한 곳이라도 그냥 받으면 그 캐시 때문에 3D 방의 WebGL
  텍스처가 막혔음(3D 방은 2026-11-18에 되살려서 지금도 필요함). 표지 중계: 백엔드 `GET /api/cover` +
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
- 처음 온 사람 안내(강사님 피드백 "뭘 해야 할지 모르겠다"): 첫 화면의 환영 카드는
  `js/library/welcome.js` — **기록 0개인 내 방**이면 "첫 기록 남기기"(카테고리를 누르면 그 칩으로
  바꾸고 새 기록 창을 엶) + "예시 방 먼저 구경하기"(개발자의 방), **남의 방**이면 "○○에 놀러
  왔어요". 주인·방문자 환영은 localStorage 키를 따로 둠(3D 방 시절과 같은 키). 기록이 이미 있는
  내 방엔 안 띄움. 위 줄 `?` 버튼은 전체 도움말. `./?cat=…&new=1`로 오면 새 기록 창을 바로 엶
  (`js/library/main.js`가 `new`를 주소에서 지움). 남의 방이면 "+ 기록" 자리에 "내 방으로"(내 방이
  비었으면 "나도 내 방 만들기").
- **첫 화면 위 두 줄**(2026-11-17): 윗줄 = 프로필(`js/library/profileHeader.js` — 사진·이름·그 아래
  한 줄 소개·내 기록이면 오른쪽 공개 스위치, 스크롤하면 같이 올라감), 아랫줄 = 메뉴(☰ · 카테고리 칩 ·
  티어리스트 · 3D 방 · 보기 전환 · + 기록, `position:sticky`로 위에 붙음). 내 기록이면 이름·소개는 **누르면 그 자리에서
  입력 칸**(Enter·바깥 클릭 저장, Esc 취소), 사진은 누르면 가운데 큰 창 → 연필(파일 고르기, 512px로 줄여
  `POST .../uploads` → `PUT .../avatar`)·휴지통(기본 실루엣으로). 저장 요청은 `js/shared/profileApi.js`,
  사진·실루엣 그리기는 `js/shared/avatar.js`(둘러보기 카드도 씀). ☰ 서랍의 "기록 설정"엔 **구글 계정 연동만**
  남김(`js/shared/roomSettings.js` — 구글 버튼 스크립트는 `index.html`만 불러옴).
- **방명록·좋아요**(2026-11-17, `js/library/social.js`): 오른쪽 아래 떠 있는 ♥(기록 좋아요)·말풍선(방명록)
  버튼. 방명록은 버튼 **왼쪽 옆**에 반투명 채팅 창(뒤 카드가 비침), 내 글 오른쪽·남의 글 왼쪽, 익명 스위치는
  남의 방명록에서만. 쓰기·좋아요는 **구글 계정을 연동한 방만**(백엔드 `X-Actor-Code/Token` — 이 브라우저의
  내 방으로 "누가"를 정함), 안 했으면 로그인 안내 창(구글 버튼). 방 주인은 연동 없이 자기 방명록에 씀.
  `initSocial`이 `{ isLinked, askLogin, showToast }`를 돌려줘서 카드 공감도 같은 안내를 씀.
- **카드 공감**: 카드 앞면 정보 줄의 하트(`cardsView.js`의 `likeHtml`, `main.js`의 `onLike`) — 남의 기록만
  누름, 내 기록은 받은 수만. `records.js`의 `setActor(mine)` + 목록 GET에 `X-Actor-*`를 실어 `liked`를 받음.
- **기록 둘러보기**(`rooms.html`): 최근 활동순 / 인기순(`?sort=popular`, 방 좋아요) 칩, 카드마다 프로필
  사진·소개, ♥ 수, 인생작 작은 표지 12개(6개씩 두 줄).
- **티어리스트**(2026-11-17, `tier.html` · `js/tier/main.js` · 규칙은 `js/tier/board.js` · `css/tier.css`):
  기록 하나에 **보드 하나**(사용자 결정 — 칩은 카테고리 거르기만). 줄 SS·S·A·B·C·D·F + 미배치. 직접 놓지
  않은 작품은 **별점으로 자동**(반 별 단위 10점: 5★ SS, 4.5★ S, 4★ A, 3.5★ B, 3★ C, 2.5★ D, 그 아래 F,
  별점 없음은 미배치), 직접 옮긴 자리가 별점보다 우선. 작품은 작은 표지 + **제목이 늘 보임**(같은 앨범
  노래는 표지가 같아서). 내 기록: 마우스는 끌어서 놓기(화면 위·아래 끝에서 자동 스크롤), 폰은 누르고 줄
  누르기. 옮길 때마다 바뀐 줄만 `PUT .../tierlist`. "별점순으로 초기화". 한 줄이 12개(폰 6개)를 넘으면
  "+N개 더 보기"로 접힘. 컴퓨터에선 미배치 칸이 오른쪽에 붙어 따라옴. 홈의 티어리스트 버튼은 보던 칩을
  들고 감(`tier?cat=…`).
- **기록 창**(`modal.js`): 꼭 쓸 건 제목뿐이라 나머지 칸 이름엔 "(선택)". 제목 아래 "아직 보는 중/읽는
  중이에요" 스위치(음악 없음, 카드 왼쪽 위 초록 표시). 감상 아래 **세부 기록**이 늘 펼쳐져 있음
  (`modal/detailFields.js` — 애니: 참신함·스토리·작화·캐릭터·결말, 영화: 스토리·연기·영상미·음악·결말,
  책: 결말 + 카테고리별 장르 12개 중 5개, 음악 없음 — 백엔드 `schemas.DETAIL_ASPECTS·DETAIL_GENRES`와
  같아야 함). 카드 뒷면엔 요소별 별점·장르 태그, 맨 아래 버튼 위에 만든 사람(작가·감독·가수 — 11-17에 뺐다가 11-18에 아래쪽으로 다시 넣음). **수정할 땐 카테고리 탭이 잠김**(지금 것만
  켜짐). 창 바깥(어두운 곳)을 누르면 닫히는데, 입력 칸을 직접 고쳤으면 한 번 물음(`touched`).
- **보기 전환**(2026-11-18, 피드백 "카드로는 모든 작품을 한눈에 볼 수 없다"): 카드 · 촘촘히(표지만 빽빽이,
  인생작 금테·보는 중 초록 점·제목은 마우스 올리면) · 목록(한 줄에 표지·제목·카테고리·별점·날짜).
  `js/library/list/compactViews.js`, 고른 보기는 localStorage `mysite:view`(`list.js`의 `setView`). 촘촘히·목록에서
  작품을 누르면 `#cardDialog`에 카드 하나를 뒷면부터 띄워서 수정·삭제·인생작·공감·듣기를 카드 보기와 똑같이 씀.
- **옷·일기**(2026-11-20): 카테고리에 옷·일기 추가 — **방 주인만 봄**(백엔드가 토큰이 맞을 때만 목록에 넣음,
  `records.js`의 `fetchRecords`가 내 기록이면 토큰을 실음). 칩은 전체 · 작품만 · 책 · 애니 · 영화·시리즈 · 음악 · 옷 · 일기
  (`list.js`의 `tabsFor` — 남의 기록엔 작품만·옷·일기 칩 없음), "전체"는 옷·일기까지 날짜순으로 섞임. 옷은 새 기록 창에서
  검색 없이 바로 입력 칸(`modal.js`의 `openDirect`, 칸 이름은 `fieldLabels`): 이름·사진 필수 + 브랜드 + 종류·색·
  계절(여러 개)·핏·톤·특징 태그·소재·사이즈·구매일(`modal/clothesFields.js`). **일기는 쓸 때만 블로그처럼 따로 된 페이지**
  (`diary.html`·`js/diary/`·`css/diary.css`, 사용자 요청 — 보는 건 카드): 날짜·제목(선택)·사진 여러 장(선택, 최대 20 —
  `js/diary/photos.js`: 고르기·페이지 어디에든 끌어다 놓기·붙여넣기, 칸을 끌어 순서 바꾸기, 첫 장이 카드 표지, 저장할 때
  올림)·본문(필수), 카드 뒷면엔 사진이 여러 장이면 작은 사진 줄. 새 일기는
  이 브라우저에 임시 저장(`mysite:diary-draft`), 안 저장하고 떠나면 물음, Ctrl+S. 새 기록 창의 "일기" 탭·카드 "수정"은
  `diary`/`diary?id=`로 보냄(`modal.js`의 `goDiary`).
  카드: 옷 뒷면은 속성 칸·태그, 일기는 사진이 없으면 줄 공책 표지 + 뒷면에 본문 전체, 제목이 없으면 "11월 19일의 일기"
  (`itemFormat.js`의 `displayTitle`). 옷·일기는 인생작·별점 없음, 티어리스트·3D 방에도 안 나옴. 코디·OOTD는 나중에.
- 카드 표지 오른쪽 위 카테고리 아이콘(`itemFormat.js`의 `catIconHtml`) — 음표·책·A·슬레이트, 카테고리마다
  연한 바탕색(드라마 OST처럼 표지만으론 무슨 기록인지 모를 때가 있어서).
- 개발자의 방: `config.js`의 `DEVELOPER_ROOM_CODE = 'TTHB8N'`(사용자 본인 방,
  "도현의 방"). 방문자에게만 ☰ 서랍의 "개발자의 방 구경하기" 링크로 뜸.

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
3. 프론트: `/rooms` → `rooms.html`처럼 확장자 없는 주소를 처리하는 작은 정적
   서버로 `mysite`를 5500 포트에 띄움(GitHub Pages가 그렇게 동작해서
   `python -m http.server`로는 메뉴 링크가 404가 남).
4. 검색: 로컬엔 카카오·TMDB 키가 없어서(운영 키는 가져오지 않음), 백엔드 앱 앞에 작은 미들웨어를
   붙여 `/api/search/*`(음악 제외 — 키가 필요 없어 로컬 코드로)와 `/api/cover`만 운영 서버로 넘겨서 씀.
   DB 칸을 새로 만든 기능이면 이미 있는 로컬 SQLite에는 `ALTER TABLE`로 칸을 직접 더함
   (`create_all`은 있는 표를 안 고침 — 새 **표**는 백엔드를 다시 켜면 생김). 2026-11-17까지 더한 칸:
   `rooms.avatar_url`·`rooms.bio`, `records.tier`·`tier_pos`·`details`(JSON)·`in_progress`(BOOLEAN NOT NULL
   DEFAULT 0). 백엔드 `main`에 없는 카테고리(옛 옷장 시험 기록 등)가 로컬 DB에 있으면 기록 목록 응답이
   통째로 500이 남.
5. 사진 올리기: 로컬엔 S3 권한이 없어서, `dev_app.py`(백엔드 앞 미들웨어 파일)에서
   `storage.upload_photo`를 임시 폴더에 저장하는 함수로 바꾸고 `/dev-uploads`로 내줌. 프로필 사진 검사도
   그 주소를 받게 `storage.uploaded_url_prefix`를 바꿔 둠.
6. 학원 PC의 함정: 임시 폴더에 설치한 패키지의 DLL을 Windows 보안 정책이 막음 — SQLAlchemy는
   `DISABLE_SQLALCHEMY_CEXT_RUNTIME=1`(+ 설치된 `.pyd` 삭제)로 순수 파이썬으로 돌리고, Postgres 드라이버가
   필요한 마이그레이션 확인은 Docker 안에서 함(`mysite-backend/CLAUDE.md` "빌드/테스트 명령").
7. 화면 확인: headless Edge `--screenshot`(3D 방은 `--use-angle=swiftshader --enable-unsafe-swiftshader`로 WebGL을 켬). 가로 500px보다 좁게는 안 그려서 폰은 500px로
   찍음. 클릭·끌기 같은 동작은 Edge를 `--remote-debugging-port`로 띄워 CDP(`Input.dispatchMouseEvent`·
   `dispatchTouchEvent`)로 재현함.

## 정해둔 것 / 남은 일

- **3D 방 브랜치**: 옛 둥근 가구 방은 `3d-room`(사용자가 보관), `main`의 `lobby.html`은 기억 보관소. `room-redesign`(= 3d-room + 2026-11-11 작업: 네모난 방,
  책·애니·영화를 한데 꽂는 큰 책장, 옷장 가구·옷장 탭, 한글 글꼴). 백엔드 `room-redesign`엔 옷장 카테고리
  (`attrs`·`wardrobe_public`, 마이그레이션 `a7c3e5f9b2d1`)와 인생작 9개 공동 한도가 있음 — `main`에 안
  합침. 옷장을 카드 홈으로 옮길 땐 그 리비전의 `down_revision`을 지금 head(`a2d4f6b8c0e3`)로 바꿔야 함.
- 테스트 출력의 "Unhandled Errors 2개"(기록 창 테스트에서 가짜 검색 함수가 값을 안 돌려줌)는 2026-11-12
  카드 홈 때부터 있던 것 — 결과(전부 통과)와 실제 동작엔 영향 없음.
- 아직 안 한 것(`FEEDBACK.md`): 코디·OOTD, 좋아하는 글귀, 카테고리 커스텀, 캘린더(주인만),
  음성 메모 기록, 맛집, 기록 링크, AI. 제안해 둔 것: 방명록 새 글 알림, 좋아요 누른 사람 목록, 스포일러
  감상·어디서 봤는지, 장르 통계, "보는 중" 거르기, 티어리스트 이미지 저장.

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
  `slow.js`("서버를 깨우는 중" → "연결이 느려요"). 예전 Render 자동 배포
  문제(2026-10-15, 원인 미확인)는 더 이상 운영에 영향 없음.
