// app/api/account/status/route.ts
import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const userKey = await readSessionUserId();
    if (!userKey) {
      return NextResponse.json({ authenticated: false });
    }

    const db = await getDb();
    const user = await db
      .collection('users')
      .findOne<{ status?: string; paymentStatus?: string }>({
        email: userKey,
      });

    return NextResponse.json({
      authenticated: true,
      status: user?.status || null,
      paymentStatus: user?.paymentStatus || null,
    });
  } catch (error: any) {
    console.error('Account status error:', error);
    return NextResponse.json(
      { authenticated: false, error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

