import { NextResponse } from 'next/server';
import { checkSessionSubscription } from '@/lib/subscription';
import { getDb } from '@/lib/db';
import { UserProfile } from '@/types/userProfile';

export async function GET() {
  const { email: userEmail } = await checkSessionSubscription();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const profile = await db
    .collection<UserProfile>('user_profiles')
    .findOne({ userEmail }, { projection: { generationStatus: 1, generationError: 1 } });

  return NextResponse.json({
    status: profile?.generationStatus ?? 'done',
    error: profile?.generationError ?? null,
  });
}
