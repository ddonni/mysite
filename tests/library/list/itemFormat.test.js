// itemFormat.js는 list.js에서 분리해낸 순수 포맷팅 헬퍼들 — DOM과
// 무관해서 유닛 테스트로 확인하기 좋음. featureButtonLabel은 모든
// 카테고리(음악 포함 — 최애음악이 로비 턴테이블에서 돎)에 버튼이 있어야 하고,
// 카테고리마다 이름과 조사가 다름.
import { describe, expect, it } from 'vitest';
import { featureButtonLabel, withEunNeun, withEulReul } from '../../../js/library/list/itemFormat.js';

describe('featureButtonLabel', () => {
  it('카테고리마다 인생책/인생애니/인생영화/최애음악, 조사도 받침에 맞춤', () => {
    expect(featureButtonLabel('book', false)).toBe('인생책으로');
    expect(featureButtonLabel('book', true)).toBe('인생책에서 빼기');
    expect(featureButtonLabel('anime', false)).toBe('인생애니로');
    expect(featureButtonLabel('movie', false)).toBe('인생영화로');
    expect(featureButtonLabel('music', false)).toBe('최애음악으로');
    expect(featureButtonLabel('music', true)).toBe('최애음악에서 빼기');
  });

  it('은/는, 을/를도 받침에 맞춤', () => {
    expect(withEunNeun('인생책')).toBe('인생책은');
    expect(withEunNeun('인생애니')).toBe('인생애니는');
    expect(withEulReul('최애음악')).toBe('최애음악을');
    expect(withEulReul('인생영화')).toBe('인생영화를');
  });
});
