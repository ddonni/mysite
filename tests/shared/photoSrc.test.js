// photoSrc.js — 카카오 표지만 백엔드 중계(/api/cover)를 거치고, 나머지 사진
// 주소(S3 등)는 그대로인지.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../js/shared/config.js', () => ({
  API_BASE: 'http://api.test',
  GOOGLE_CLIENT_ID: '',
  DEVELOPER_ROOM_CODE: '',
}));

const { photoSrc, isSearchCover } = await import('../../js/shared/photoSrc.js');

describe('isSearchCover', () => {
  it('카카오·유튜브 뮤직·TMDB 표지는 검색 표지, S3 사진은 직접 올린 사진', () => {
    expect(isSearchCover('https://t1.daumcdn.net/lbook/image/1')).toBe(true);
    expect(isSearchCover('https://yt3.googleusercontent.com/abc=w544')).toBe(true);
    expect(isSearchCover('https://image.tmdb.org/t/p/w342/a.jpg')).toBe(true);
    expect(isSearchCover('https://mysite-photos-ddonni.s3.ap-northeast-2.amazonaws.com/records/a.jpg')).toBe(false);
    expect(isSearchCover('not a url')).toBe(false);
  });
});

describe('photoSrc', () => {
  it('카카오 표지 서버 주소는 /api/cover로 감쌈', () => {
    const cover = 'https://t1.daumcdn.net/lbook/image/540810?timestamp=20261023110741';
    expect(photoSrc(cover)).toBe('http://api.test/api/cover?url=' + encodeURIComponent(cover));
  });

  it('S3 같은 다른 주소는 그대로', () => {
    const s3 = 'https://mysite-photos-ddonni.s3.ap-northeast-2.amazonaws.com/records/a.jpg';
    expect(photoSrc(s3)).toBe(s3);
  });

  it('호스트 이름만 비슷한 주소는 감싸지 않음', () => {
    const fake = 'https://t1.daumcdn.net.evil.com/a.jpg';
    expect(photoSrc(fake)).toBe(fake);
  });

  it('빈 값·주소가 아닌 값은 그대로', () => {
    expect(photoSrc(null)).toBeNull();
    expect(photoSrc('')).toBe('');
    expect(photoSrc('not a url')).toBe('not a url');
  });
});
