// app/api/subscription/me/route.ts
// Returns the current session user's saved email / onboarding / plan so the payment
// page can prefill for returning users (whose localStorage may be empty/stale).
import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

export async function GET() {
  const email = await readSessionUserId();
  if (!email) {
    return NextResponse.json({ email: null });
  }

  const db = await getDb();
  const user = await db.collection('users').findOne<{
    email?: string;
    planId?: string | null;
    onboarding?: Record<string, unknown>;
  }>({ email });

  if (!user) {
    return NextResponse.json({ email: null });
  }

  return NextResponse.json({
    email: user.email ?? email,
    planId: user.planId ?? null,
    onboarding: user.onboarding ?? {},
  });
}
