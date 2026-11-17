// 프로필 사진(js/shared/avatar.js)과 카드 표지의 카테고리 아이콘(itemFormat.js의 catIconHtml).
import { describe, expect, it } from 'vitest';
import { avatarHtml, avatarInner } from '../../js/shared/avatar.js';

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
