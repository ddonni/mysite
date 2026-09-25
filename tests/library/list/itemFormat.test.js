// itemFormat.js는 list.js에서 분리해낸 순수 포맷팅 헬퍼들 — DOM과
// 무관해서 유닛 테스트로 확인하기 좋음. featureButtonLabel은 모든
// 카테고리(음악 포함 — 대표곡이 로비 턴테이블에서 돎)에 버튼이 있어야 함.
import { describe, expect, it } from 'vitest';
import { featureButtonLabel } from '../../../js/library/list/itemFormat.js';

describe('featureButtonLabel', () => {
  it('책/애니/영화/음악 모두 "대표작" 문구', () => {
    expect(featureButtonLabel('book', false)).toBe('대표작으로');
    expect(featureButtonLabel('book', true)).toBe('대표작에서 빼기');
    expect(featureButtonLabel('movie', false)).toBe('대표작으로');
    expect(featureButtonLabel('music', false)).toBe('대표작으로');
    expect(featureButtonLabel('music', true)).toBe('대표작에서 빼기');
  });
});
