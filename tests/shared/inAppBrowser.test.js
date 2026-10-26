// inAppBrowser.js — 어떤 UA를 앱 안 브라우저로 보는지, 바깥 브라우저로 여는
// 주소가 맞게 만들어지는지, 안내 띠가 언제 뜨고 카톡 자동 이동이 한 번만 되는지.
import { beforeEach, describe, expect, it, vi } from 'vitest'; // vi: 모듈 캐시 초기화(resetModules)

const UA = {
  kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5',
  instaIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.22.109 (iPhone15,2; iOS 17_5; ko_KR)',
  instaAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Instagram 340.0.0.22.109 Android',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
};

const HERE = 'https://ex.com/mysite/?room=AB12CD';
let hrefSet;
let mod;

// 모듈은 jsdom 기본 UA(앱 안 브라우저 아님)로 불러와서 자동 실행은 아무것도
// 안 하고, 각 테스트가 UA·주소·이동 함수를 넣어 initInAppBrowser를 직접 부름.
// (jsdom에선 location.href에 kakaotalk:// 같은 주소를 넣으면 이동하려다 에러가 남.)
function load(ua) {
  document.body.innerHTML = '';
  mod.initInAppBrowser({ ua, href: HERE, go: (url) => hrefSet.push(url) });
}

beforeEach(async () => {
  vi.resetModules();
  sessionStorage.clear();
  hrefSet = [];
  mod = await import('../../js/shared/inAppBrowser.js');
});

describe('detectInApp', () => {
  it('카톡은 kakao, 인스타는 other, 일반 브라우저는 null', () => {
    const { detectInApp } = mod;
    expect(detectInApp(UA.kakaoIos)).toBe('kakao');
    expect(detectInApp(UA.instaIos)).toBe('other');
    expect(detectInApp(UA.instaAndroid)).toBe('other');
    expect(detectInApp(UA.safari)).toBeNull();
    expect(detectInApp(UA.chromeAndroid)).toBeNull();
  });
});

describe('바깥 브라우저 주소', () => {
  it('카톡 openExternal에 지금 주소를 인코딩해서 넣음', () => {
    expect(mod.kakaoExternalUrl('https://ex.com/?room=AB12CD')).toBe('kakaotalk://web/openExternal?url=https%3A%2F%2Fex.com%2F%3Froom%3DAB12CD');
  });

  it('안드로이드는 크롬 intent 주소', () => {
    expect(mod.androidChromeUrl('https://ex.com/library?cat=book')).toBe(
      'intent://ex.com/library?cat=book#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fex.com%2Flibrary%3Fcat%3Dbook;end',
    );
  });
});

describe('안내 띠', () => {
  it('일반 브라우저에선 아무것도 안 함', () => {
    load(UA.safari);
    load(UA.chromeAndroid);
    expect(document.querySelector('.inapp-banner')).toBeNull();
    expect(hrefSet).toEqual([]);
  });

  it('카톡이면 처음 한 번만 자동으로 바깥 브라우저로 보냄', () => {
    load(UA.kakaoIos);
    expect(hrefSet).toEqual([mod.kakaoExternalUrl(HERE)]);
    expect(document.querySelector('.inapp-open')).not.toBeNull();

    load(UA.kakaoIos); // 웹뷰에서 다른 페이지로 옮긴 경우
    expect(hrefSet).toHaveLength(1);
  });

  it('아이폰 인스타는 처음 한 번 사파리로 자동 시도 + 사파리·크롬 버튼·메뉴 안내·링크 복사', () => {
    load(UA.instaIos);
    expect(hrefSet).toEqual(['x-safari-' + HERE]);
    expect(document.querySelector('.inapp-how')).not.toBeNull();
    expect(document.querySelector('.inapp-copy')).not.toBeNull();
    const [safari, chrome] = document.querySelectorAll('.inapp-open');
    expect(safari.textContent).toBe('사파리로 열기');
    expect(chrome.textContent).toBe('크롬으로 열기');
    safari.click();
    chrome.click();
    expect(hrefSet).toEqual(['x-safari-' + HERE, 'x-safari-' + HERE, 'googlechromes://ex.com/mysite/?room=AB12CD']);

    load(UA.instaIos);
    expect(hrefSet).toHaveLength(3); // 자동 시도는 세션당 한 번
  });

  it('안드로이드 인스타는 처음 한 번 크롬으로 자동 시도 + 크롬으로 열기 버튼', () => {
    load(UA.instaAndroid);
    expect(hrefSet).toEqual([mod.androidChromeUrl(HERE)]);
    document.querySelector('.inapp-open').click();
    expect(hrefSet).toEqual([mod.androidChromeUrl(HERE), mod.androidChromeUrl(HERE)]);
  });

  it('링크 복사 후엔 버튼은 "복사됨"으로 멈추고, 붙여넣을 곳은 안내 줄에 적음', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
    load(UA.instaIos);
    const copy = document.querySelector('.inapp-copy');
    copy.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(HERE);
    expect(copy.textContent).toBe('복사됨 ✓');
    expect(copy.disabled).toBe(true);
    expect(document.querySelector('.inapp-how').textContent).toContain('주소창에 붙여넣어');
  });

  it('인스타 말고 다른 앱(아이폰 페이스북)은 자동 이동 없이 안내만', () => {
    load('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]');
    expect(hrefSet).toEqual([]);
    expect(document.querySelector('.inapp-open')).toBeNull();
    expect(document.querySelector('.inapp-copy')).not.toBeNull();
  });

  it('"여기서 볼게요"를 누르면 닫히고 이번 세션엔 다시 안 뜸', () => {
    load(UA.instaIos);
    document.querySelector('.inapp-close').click();
    expect(document.querySelector('.inapp-banner')).toBeNull();
    load(UA.instaIos);
    expect(document.querySelector('.inapp-banner')).toBeNull();
  });
});
