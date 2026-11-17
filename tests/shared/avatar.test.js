// 프로필 사진(js/shared/avatar.js)과 카드 표지의 카테고리 아이콘(itemFormat.js의 catIconHtml).
import { describe, expect, it } from 'vitest';
import { avatarHtml, avatarInner } from '../../js/shared/avatar.js';
import { catIconHtml } from '../../js/library/list/itemFormat.js';

describe('avatar', () => {
  it('사진이 없으면 기본 실루엣', () => {
    expect(avatarInner(null)).toContain('<svg');
    expect(avatarInner(null)).not.toContain('<img');
  });

  it('사진이 있으면 crossorigin으로 받는 이미지', () => {
    const html = avatarInner('https://bucket.s3.ap-northeast-2.amazonaws.com/records/a.jpg');
    expect(html).toContain('<img');
    expect(html).toContain('crossorigin="anonymous"');
  });

  it('이름에 든 따옴표는 이스케이프', () => {
    expect(avatarHtml(null, { label: '"x"의 사진' })).toContain('aria-label="&quot;x&quot;의 사진"');
  });
});

describe('catIconHtml', () => {
  it('카테고리마다 아이콘 상자, 모르는 카테고리는 빈 문자열', () => {
    ['book', 'anime', 'movie', 'music'].forEach((cat) => {
      expect(catIconHtml(cat)).toMatch(/^<span class="cat-icon"[^>]*><svg/);
    });
    expect(catIconHtml('anime')).toContain('>A</text>');
    expect(catIconHtml('etc')).toBe('');
  });
});

// 보는 중·읽는 중 표시(itemFormat.js의 coverHtml).
import { coverHtml } from '../../js/library/list/itemFormat.js';

describe('보는 중 표시', () => {
  it('책은 읽는 중, 애니·영화는 보는 중, 음악은 없음', () => {
    expect(coverHtml({ cat: 'book', title: 'a', in_progress: true })).toContain('<span class="badge progress">읽는 중</span>');
    expect(coverHtml({ cat: 'anime', title: 'a', in_progress: true })).toContain('>보는 중</span>');
    expect(coverHtml({ cat: 'music', title: 'a', in_progress: true })).not.toContain('badge progress');
    expect(coverHtml({ cat: 'movie', title: 'a' })).not.toContain('badge progress');
  });
});
