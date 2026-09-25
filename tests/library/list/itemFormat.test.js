// itemFormat.js는 list.js에서 분리해낸 순수 포맷팅 헬퍼들 — DOM과
// 무관해서 유닛 테스트로 확인하기 좋음. featureButtonLabel은 음악만
// 버튼이 없어야 함(로비 액자 대신 턴테이블에 걸리는 카테고리라서).
import { describe, expect, it } from 'vitest';
import { featureButtonLabel } from '../../../js/library/list/itemFormat.js';

describe('featureButtonLabel', () => {
  it('음악은 항상 null(버튼 자체가 없음)', () => {
    expect(featureButtonLabel('music', false)).toBeNull();
    expect(featureButtonLabel('music', true)).toBeNull();
  });

  it('책/애니/영화는 "대표작" 문구', () => {
    expect(featureButtonLabel('book', false)).toBe('대표작으로');
    expect(featureButtonLabel('book', true)).toBe('대표작 해제');
    expect(featureButtonLabel('movie', false)).toBe('대표작으로');
  });
});
