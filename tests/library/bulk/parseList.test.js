// 붙여 넣은 목록 → 기록 후보 줄. 메모장·노션·왓챠에서 복사한 모양을 그대로 받는지.
import { describe, expect, it } from 'vitest';
import { parseList, MAX_LINES } from '../../../js/library/bulk/parseList.js';

const titles = (text) => parseList(text).items.map((i) => i.title);

describe('parseList', () => {
  it('빈 줄은 건너뛰고 한 줄에 하나씩', () => {
    expect(titles('데미안\n\n  채식주의자  \r\n어린 왕자')).toEqual(['데미안', '채식주의자', '어린 왕자']);
  });

  it('번호·글머리표·체크박스를 뗌', () => {
    expect(titles('1. 데미안\n2) 채식주의자\n(3) 어린 왕자\n4.노르웨이의 숲\n- 인터스텔라\n• 기생충\n- [ ] 파묘\n☑ 듄'))
      .toEqual(['데미안', '채식주의자', '어린 왕자', '노르웨이의 숲', '인터스텔라', '기생충', '파묘', '듄']);
  });

  it('숫자로 시작하는 제목은 안 건드림', () => {
    expect(titles('1984\n2.5차원의 유혹\n500일의 썸머')).toEqual(['1984', '2.5차원의 유혹', '500일의 썸머']);
  });

  it('" / "로 만든 사람을 나누고, 띄어쓰기 없는 /는 제목으로 둠', () => {
    expect(parseList('채식주의자 / 한강\nFate/stay night').items).toEqual([
      { title: '채식주의자', creator: '한강' },
      { title: 'Fate/stay night', creator: '' },
    ]);
  });

  it('같은 제목(띄어쓰기·대소문자 무시)은 한 번만', () => {
    expect(titles('어린 왕자\n어린왕자\nDune\ndune')).toEqual(['어린 왕자', 'Dune']);
  });

  it(`${MAX_LINES}줄이 넘으면 자르고 잘린 수를 알려줌`, () => {
    const text = Array.from({ length: MAX_LINES + 3 }, (_, i) => `책${i}`).join('\n');
    const { items, overflow } = parseList(text);
    expect(items).toHaveLength(MAX_LINES);
    expect(overflow).toBe(3);
  });
});
