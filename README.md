# 스케치북 (프론트엔드)

`sketchbook.html`은 번호가 매겨진 페이지를 스케치북처럼 넘기며 자유롭게
그리는 캔버스 페이지. 그림 저장/실시간 동기화는 별도 레포인
[mysite-backend](https://github.com/<사용자명>/mysite-backend)의
API 서버가 담당함 — 그 서버가 꺼져 있으면 이 페이지는 자동으로 이 기기
로컬 저장 모드로 동작함.

## 파일 구조

```
sketchbook.html   # 마크업 (HTML)
css/style.css     # 스타일
js/app.js         # 동작 로직 (JS)
```

`js/app.js` 맨 위 `API_BASE` 상수가 백엔드 서버 주소. 백엔드를 배포한 뒤 그
값을 실제 배포 주소로 바꿔주면 됨.
