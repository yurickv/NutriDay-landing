import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { decryptTokens, deleteConnection, getConnection } from '@/lib/silpo/connections';
import { getSilpoClientId, revokeToken } from '@/lib/silpo/oauth';

export async function DELETE() {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conn = await getConnection(userEmail);
  if (conn) {
    try {
      const { accessToken } = decryptTokens(conn);
      await revokeToken(accessToken, getSilpoClientId() ?? '');
    } catch {
      // revoke is best-effort
    }
    await deleteConnection(userEmail);
  }
  return NextResponse.json({ success: true });
}
