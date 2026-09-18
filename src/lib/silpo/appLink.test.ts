import { describe, it, expect } from 'vitest';
import { androidIntentUrl, silpoOpenLink, SILPO_WEB_URL } from './appLink';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('silpoOpenLink', () => {
  it('keeps a plain https Universal Link on iOS and desktop', () => {
    expect(silpoOpenLink(IPHONE_UA)).toBe(SILPO_WEB_URL);
    expect(silpoOpenLink('Mozilla/5.0 (Windows NT 10.0)')).toBe(SILPO_WEB_URL);
  });

  it('builds an intent URL with web fallback on Android', () => {
    const href = silpoOpenLink(ANDROID_UA);
    expect(href.startsWith('intent://silpo.ua/#Intent;scheme=https;package=ua.silpo.android;')).toBe(true);
    expect(href).toContain(`S.browser_fallback_url=${encodeURIComponent(SILPO_WEB_URL)}`);
    expect(href.endsWith(';end')).toBe(true);
  });

  it('carries path and query of a specific page into the intent', () => {
    expect(androidIntentUrl('https://silpo.ua/checkout?cart=1')).toContain('intent://silpo.ua/checkout?cart=1#Intent;');
  });
});
