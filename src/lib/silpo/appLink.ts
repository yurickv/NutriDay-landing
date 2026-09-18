/**
 * Links that open the Silpo mobile app when it is installed.
 *
 * - iOS: silpo.ua publishes an apple-app-site-association whose `applinks`
 *   paths include `/`, so a plain https link to the root is a Universal Link
 *   and iOS hands it to the app (appID ua.silpo.app.ios) when installed.
 * - Android: an `intent://` URL targets the app package directly and falls
 *   back to the website when the app is missing. Plain https would only open
 *   the app if Chrome had verified App Links for the domain, which we can't
 *   rely on.
 */
export const SILPO_WEB_URL = 'https://silpo.ua/';
export const SILPO_ANDROID_PACKAGE = 'ua.silpo.android';

export function isAndroidUserAgent(userAgent: string): boolean {
  return /android/i.test(userAgent);
}

/** Build a Chrome intent URL for `httpsUrl` that opens the Silpo app or falls back to the web page. */
export function androidIntentUrl(httpsUrl: string): string {
  const u = new URL(httpsUrl);
  const location = `${u.host}${u.pathname}${u.search}`;
  return `intent://${location}#Intent;scheme=https;package=${SILPO_ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
}

/** The href to use for «Відкрити Сільпо» on this device. */
export function silpoOpenLink(userAgent: string, httpsUrl: string = SILPO_WEB_URL): string {
  return isAndroidUserAgent(userAgent) ? androidIntentUrl(httpsUrl) : httpsUrl;
}
