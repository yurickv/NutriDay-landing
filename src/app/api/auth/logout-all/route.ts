// app/api/auth/logout-all/route.ts
import { NextResponse } from 'next/server';
import { clearAllSessions } from '@/lib/auth/session';

export async function POST() {
  await clearAllSessions();
  return NextResponse.json({ success: true });
}
