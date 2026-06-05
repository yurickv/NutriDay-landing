import { inngest } from '../client';
import { getDb } from '@/lib/db';
import { generateMenuWithAI } from '@/lib/menu/generateMenuWithAI';
import { buildShoppingList } from '@/lib/menu/shoppingListBuilder';
import { getWeekStartMonday, isSameWeek } from '@/lib/menu/weekUtils';
import { UserProfile } from '@/types/userProfile';

type GenerateMenuEvent = {
  data: {
    userEmail: string;
    highRated: string[];
    lowRated: string[];
  };
};

// retries: 1 — archive already happened in the HTTP route, so retrying here is safe.
// maxAttempts: 1 passed to generateMenuWithAI so each Inngest invocation makes a single
// OpenAI call (~20-25s) and stays well within Vercel Hobby's 60s maxDuration limit.
// Internal retries (3 attempts × 20s = up to 75s) are what caused FUNCTION_INVOCATION_TIMEOUT.
export const generateMenuFn = inngest.createFunction(
  { id: 'generate-weekly-menu', retries: 1, triggers: [{ event: 'menu/generate.requested' }] },
  async ({ event }: { event: GenerateMenuEvent }) => {
    const { userEmail, highRated, lowRated } = event.data;
    const db = await getDb();

    try {
      const profile = await db
        .collection<UserProfile>('user_profiles')
        .findOne({ userEmail });
      if (!profile) throw new Error('Profile not found');

      // Archive already done in the HTTP route before enqueuing.
      // Single OpenAI attempt — Inngest retries the whole function if it fails.
      const { days, weekStartDate } = await generateMenuWithAI(
        profile,
        highRated,
        lowRated,
        { maxAttempts: 1 },
      );

      const now = new Date();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (db.collection('weekly_menus') as any).insertOne({
        userEmail,
        weekStartDate,
        goalCaloriesAtGeneration: profile.goalCalories,
        aiModel: 'gpt-4.1-mini',
        status: 'active',
        days,
        createdAt: now,
        updatedAt: now,
      });

      const shoppingItems = buildShoppingList(days);
      await db.collection('shopping_lists').deleteMany({ userEmail });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.collection('shopping_lists') as any).insertOne({
        userEmail,
        weeklyMenuId: result.insertedId,
        weekStartDate,
        items: shoppingItems,
        updatedAt: now,
      });

      // Increment generation counter and mark done.
      const weekStart = getWeekStartMonday();
      const generationsThisWeek = isSameWeek(profile.lastGenerationWeekStart, weekStart)
        ? (profile.menuGenerationsThisWeek ?? 0)
        : 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.collection('user_profiles') as any).updateOne(
        { userEmail },
        {
          $set: {
            menuGenerationsThisWeek: generationsThisWeek + 1,
            lastGenerationWeekStart: weekStart,
            generationStatus: 'done',
            generationError: null,
          },
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Помилка генерації меню';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.collection('user_profiles') as any).updateOne(
        { userEmail },
        { $set: { generationStatus: 'error', generationError: message } },
      );
      throw err; // surface to Inngest logs
    }
  },
);
