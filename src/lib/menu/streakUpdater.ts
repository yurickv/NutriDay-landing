import { getDb } from '@/lib/db';
import { UserStreak } from '@/types/engagement';

const BADGE_THRESHOLDS = [3, 7, 14, 30, 60, 100];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(date: Date, reference: Date): boolean {
  const yesterday = new Date(reference);
  yesterday.setDate(reference.getDate() - 1);
  return isSameDay(date, yesterday);
}

export async function updateStreak(userEmail: string): Promise<UserStreak> {
  const db = await getDb();
  const col = db.collection('user_streaks');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const existing = await col.findOne<UserStreak>({ userEmail });

  const streak: UserStreak = existing ?? {
    userEmail,
    currentStreak: 0,
    longestStreak: 0,
    lastCheckedDate: new Date(0),
    totalDaysCompleted: 0,
    badges: [],
  };

  const last = new Date(streak.lastCheckedDate);

  if (isSameDay(last, today)) {
    return streak;
  }

  let newCurrent: number;

  if (isYesterday(last, today) || streak.currentStreak === 0) {
    newCurrent = streak.currentStreak + 1;
  } else {
    newCurrent = 1;
  }

  const newLongest = Math.max(streak.longestStreak, newCurrent);
  const newTotal = streak.totalDaysCompleted + 1;

  const existingBadgeIds = new Set(streak.badges.map((b) => b.id));
  const newBadges = BADGE_THRESHOLDS
    .filter((t) => newCurrent >= t && !existingBadgeIds.has(`streak_${t}`))
    .map((t) => ({ id: `streak_${t}`, earnedAt: now }));

  const updated: UserStreak = {
    userEmail,
    currentStreak: newCurrent,
    longestStreak: newLongest,
    lastCheckedDate: today,
    totalDaysCompleted: newTotal,
    badges: [...streak.badges, ...newBadges],
  };

  await col.updateOne(
    { userEmail },
    { $set: updated },
    { upsert: true },
  );

  return updated;
}
