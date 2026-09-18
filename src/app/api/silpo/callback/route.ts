import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { exchangeCode, getRedirectUri, getSilpoClientId, isSilpoEnabled } from '@/lib/silpo/oauth';
import { consumeOauthState, saveTokens } from '@/lib/silpo/connections';

function back(req: NextRequest, path: string, result: 'connected' | 'error') {
  const url = new URL(path, req.url);
  url.searchParams.set('silpo', result);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  if (!isSilpoEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 404 });
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!code || !state) return back(req, '/profile', 'error');

  const pending = await consumeOauthState(state);
  if (!pending) return back(req, '/profile', 'error');

  // The state is bound to the session that started the flow.
  const userEmail = await readSessionUserId();
  if (!userEmail || userEmail !== pending.userEmail) return back(req, pending.returnTo, 'error');

  try {
    const tokens = await exchangeCode({
      code,
      verifier: pending.verifier,
      clientId: getSilpoClientId() as string,
      redirectUri: getRedirectUri(),
    });
    await saveTokens(userEmail, tokens);
    return back(req, pending.returnTo, 'connected');
  } catch (err) {
    console.error('Silpo OAuth callback failed:', err);
    return back(req, pending.returnTo, 'error');
  }
}
