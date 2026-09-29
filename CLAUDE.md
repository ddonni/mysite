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
- 커밋 메시지는 영어, 주제별로 나눔. push하면 바로 배포됨
  (백엔드: Render 자동 재배포, 프론트: GitHub Pages).

## 폴더 구조

작업 폴더 `mysite-project/`는 git 저장소가 아니고, 안에 저장소 두 개가 따로 있음.

- `mysite/` — 이 저장소. 빌드 없는 정적 사이트(GitHub Pages `ddonni.github.io/mysite`).
  테스트는 Vitest(`npm test`). 구조는 README.md 참고.
- `mysite-backend/` — FastAPI + Neon Postgres + S3, Render 배포. 규칙·에러 문자열
  계약은 그 저장소의 CLAUDE.md 참고. 테스트는 `pytest -q`(SQLite) — 반드시
  `mysite-backend` 폴더를 기준으로 돌릴 것(아니면 `test.db`가 엉뚱한 폴더에 생김).
- `DATA_FLOW.md`(상위 폴더, git 밖) — 프론트↔백엔드 데이터 흐름 설명. OneDrive로만 동기화됨.

## 두 저장소가 맞물린 곳 (한쪽을 바꾸면 다른 쪽도)

- 에러 문자열(`featured_limit`, `page not found`, `not room owner` 등, 업로드 415/413).
- 테마 목록: 백엔드 `schemas.ROOM_THEMES` ↔ `js/lobby/scene.js`의 `THEMES`.
- `GOOGLE_CLIENT_ID`: `js/shared/config.js` ↔ 백엔드 환경 변수(같은 값이어야 함).
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
- 사진은 S3 버킷 `mysite-buckets`(시드니 `ap-southeast-2`)에 있음. 2026-09-29에 재 보니
  개발자 방 사진 119장이 합계 5.4MB(평균 46KB, 최대 0.14MB)라 기존 사진을 줄일 필요는
  없음. 업로드 전 줄이기(1200px)와 캐시 헤더는 새로 올리는 사진부터 적용됨.
- 버킷을 만든 AWS 계정을 사용자가 아직 못 찾음(2026-09-29). Render의
  `AWS_ACCESS_KEY_ID`(시크릿 말고)로 12자리 계정 번호를 계산해 대조하는 방법이 남아 있음.
- 2026-10-15 무렵: 백엔드 `render.yaml`의 옛 Render DB(`databases:`) 블록 삭제
  (2026-09-27에 Neon으로 옮기고 백업으로 남겨둔 것).
