// share.js 중 DOM/WebGL 없이 부를 수 있는 순수 함수만 — 공유 링크와 문구.
import { describe, expect, it } from 'vitest';
import { shareUrl, shareText } from '../../js/lobby/share.js';

describe('shareUrl', () => {
  it('지금 페이지가 있는 폴더 기준으로 ?room=을 붙임(기존 쿼리는 버림)', () => {
    expect(shareUrl('TTHB8N', 'https://ddonni.github.io/mysite/?room=ABC123'))
      .toBe('https://ddonni.github.io/mysite/?room=TTHB8N');
    expect(shareUrl('TTHB8N', 'https://ddonni.github.io/mysite/index.html'))
      .toBe('https://ddonni.github.io/mysite/?room=TTHB8N');
  });

  it('코드를 인코딩해서 항상 방 하나만 가리킴', () => {
    expect(shareUrl('A&B', 'http://localhost:5500/')).toBe('http://localhost:5500/?room=A%26B');
  });
});

describe('shareText', () => {
  it('내 방은 "놀러 오세요", 남의 방은 "구경하러 오세요"', () => {
    expect(shareText('도현의 방', false)).toBe('도현의 방에 놀러 오세요');
    expect(shareText('개발자의 방', true)).toBe('개발자의 방 구경하러 오세요');
  });
});
