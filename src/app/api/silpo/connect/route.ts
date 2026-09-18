import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { buildAuthorizeUrl, generatePkce, getRedirectUri, getSilpoClientId, isSilpoEnabled } from '@/lib/silpo/oauth';
import { createOauthState } from '@/lib/silpo/connections';
import { safeReturnTo } from '@/lib/silpo/apiErrors';

export async function GET(req: NextRequest) {
  if (!isSilpoEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 404 });
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.redirect(new URL('/auth/login', req.url));

  const returnTo = safeReturnTo(req.nextUrl.searchParams.get('returnTo'));
  const { verifier, challenge, state } = generatePkce();
  await createOauthState({ state, userEmail, verifier, returnTo });

  const url = buildAuthorizeUrl({
    clientId: getSilpoClientId() as string,
    redirectUri: getRedirectUri(),
    challenge,
    state,
  });
  return NextResponse.redirect(url);
}
