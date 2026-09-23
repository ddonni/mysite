import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // localStorage/location/history를 쓰는 모듈이 많아서 기본 환경을
    // jsdom으로 둠 — 순수 로직 테스트도 이 환경에서 그냥 돌아가니
    // 파일마다 따로 지정할 필요 없음.
    environment: 'jsdom',
  },
});
