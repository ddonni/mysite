// ?! 글 ↔ 저장 값 — 유튜브 주소를 떼어 listen_url로, 나머지는 memo로. 카드 이름·썸네일.
import { describe, expect, it } from 'vitest';
import { joinNote, noteTitle, splitNote, youtubeThumb } from '../../js/library/noteText.js';

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('splitNote', () => {
  it('글만 — 앞뒤 공백을 자르고 링크는 없음', () => {
    expect(splitNote('  요즘 필름 카메라  \n')).toEqual({ memo: '요즘 필름 카메라', listen_url: null });
  });

  it('링크만 — 글은 비고 링크만', () => {
    expect(splitNote(`  ${YT}  `)).toEqual({ memo: '', listen_url: YT });
  });

  it('글 사이의 유튜브 주소를 떼어 냄(https:// 없이 써도)', () => {
    expect(splitNote('이 무대 계속 봄\nyoutu.be/dQw4w9WgXcQ\n\n\n\n최고')).toEqual({
      memo: '이 무대 계속 봄\n\n최고',
      listen_url: 'https://youtu.be/dQw4w9WgXcQ',
    });
  });

  it('유튜브 주소가 아니면(채널·다른 사이트) 글에 그대로', () => {
    expect(splitNote('https://www.youtube.com/@channel 구독함')).toEqual({ memo: 'https://www.youtube.com/@channel 구독함', listen_url: null });
    expect(splitNote('https://example.com/v')).toEqual({ memo: 'https://example.com/v', listen_url: null });
  });

  it('두 번째 주소부터는 글에 남음', () => {
    const second = 'https://youtu.be/abcdefghijk';
    expect(splitNote(`${YT} 그리고 ${second}`)).toEqual({ memo: `그리고 ${second}`, listen_url: YT });
  });
});

describe('joinNote · noteTitle · youtubeThumb', () => {
  it('고칠 때는 글 다음 줄에 링크', () => {
    expect(joinNote({ memo: '좋은 노래', listen_url: YT })).toBe(`좋은 노래\n${YT}`);
    expect(joinNote({ memo: null, listen_url: YT })).toBe(YT);
    expect(splitNote(joinNote({ memo: '좋은 노래', listen_url: YT }))).toEqual({ memo: '좋은 노래', listen_url: YT });
  });

  it('이름은 첫 줄(빈 줄 건너뜀, 길면 줄임), 링크만이면 "유튜브 영상"', () => {
    expect(noteTitle({ memo: '\n  첫 줄\n둘째 줄' })).toBe('첫 줄');
    expect(noteTitle({ memo: 'ㄱ'.repeat(50) })).toBe('ㄱ'.repeat(39) + '…');
    expect(noteTitle({ memo: null, listen_url: YT })).toBe('유튜브 영상');
  });

  it('영상 주소만 썸네일, 재생목록·다른 주소는 없음', () => {
    expect(youtubeThumb(YT)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(youtubeThumb('https://www.youtube.com/playlist?list=PLabcdefgh')).toBeNull();
    expect(youtubeThumb(null)).toBeNull();
  });
});
