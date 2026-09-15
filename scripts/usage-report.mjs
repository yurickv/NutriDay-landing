// scripts/usage-report.mjs
//
// Read-only usage report for Sytno: who pays, who generates menus, who comes
// back. Run periodically until the admin panel exists:
//
//   npm run usage-report              # human-readable tables
//   npm run usage-report -- --json    # machine-readable (for later admin UI)
//
// Reads MONGODB_URI / MONGODB_DB from .env. Never writes to the database.
//
// "Last activity" is the max of every timestamp a user leaves behind: menu
// updates (consume/swap/custom food), shopping-list updates, streak checks,
// weight/water logs, and the session sliding-expiry (expiresAt - TTL ≈ last
// request, 1-day granularity because the refresh runs at most once a day).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');

// Keep in sync with src/lib/auth/session.ts
const SESSION_TTL_MS = 24 * 30 * 60 * 60 * 1000;

function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

const fmt = (v) => (v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '—');
const maxTs = (arr) =>
  arr.filter(Boolean).map((x) => new Date(x).getTime()).reduce((a, b) => Math.max(a, b), 0) || null;
const groupBy = (arr, key) =>
  arr.reduce((m, x) => ((m[x[key]] ||= []).push(x), m), {});
const daysAgo = (ts) => (ts ? Math.round((Date.now() - ts) / 864e5) : null);

async function main() {
  const env = { ...loadEnv(), ...process.env };
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is missing (.env)');
  const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 2 });
  await client.connect();
  const db = client.db(env.MONGODB_DB || 'nutridb');

  const now = new Date();
  const [users, subs, payments] = await Promise.all([
    db.collection('users').find({}).toArray(),
    db.collection('subscriptions').find({}).toArray(),
    db.collection('payment_events').find({}).toArray(),
  ]);
  const subByUserId = Object.fromEntries(subs.map((s) => [String(s.userId), s]));
  const paidUsers = users.filter((u) => u.paymentStatus === 'active');
  const emails = paidUsers.map((u) => u.email).filter(Boolean);
  const inEmails = { $in: emails };

  const [profiles, menus, lists, streaks, weights, waters, favs, pushes, sessions] = await Promise.all([
    db.collection('user_profiles').find({ userEmail: inEmails }).toArray(),
    db.collection('weekly_menus').find({ userEmail: inEmails }).toArray(),
    db.collection('shopping_lists').find({ userEmail: inEmails }).toArray(),
    db.collection('user_streaks').find({ userEmail: inEmails }).toArray(),
    db.collection('weight_logs').find({ userEmail: inEmails }).toArray(),
    db.collection('water_logs').find({ userEmail: inEmails }).toArray(),
    db.collection('favorite_meals').find({ userEmail: inEmails }).toArray(),
    db.collection('push_subscriptions').find({ userEmail: inEmails }).toArray(),
    db.collection('sessions').find({ userId: inEmails }).toArray(),
  ]);
  const P = groupBy(profiles, 'userEmail');
  const M = groupBy(menus, 'userEmail');
  const L = groupBy(lists, 'userEmail');
  const S = groupBy(streaks, 'userEmail');
  const W = groupBy(weights, 'userEmail');
  const H = groupBy(waters, 'userEmail');
  const F = groupBy(favs, 'userEmail');
  const PU = groupBy(pushes, 'userEmail');
  const SE = groupBy(sessions, 'userId');
  const PAY = groupBy(
    payments.map((p) => ({ ...p, email: p.payload?.sender_email || p.payload?.customer || null })),
    'email',
  );

  const subscribers = paidUsers.map((u) => {
    const e = u.email;
    const sub = subByUserId[String(u._id)] || null;
    const ms = (M[e] || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    let totalMeals = 0, consumed = 0, swapped = 0, rated = 0, completedDays = 0, customFoods = 0;
    let lastConsumedAt = null, lastCompletedAt = null;
    for (const m of ms) {
      for (const day of m.days || []) {
        if (day.isCompleted) completedDays++;
        if (day.completedAt) lastCompletedAt = Math.max(lastCompletedAt || 0, new Date(day.completedAt).getTime());
        customFoods += (day.customEntries || []).length;
        for (const slot of Object.values(day.meals || {})) {
          for (const meal of Array.isArray(slot) ? slot : [slot]) {
            if (!meal || typeof meal !== 'object') continue;
            totalMeals++;
            if (meal.isConsumed) consumed++;
            if (meal.consumedAt) lastConsumedAt = Math.max(lastConsumedAt || 0, new Date(meal.consumedAt).getTime());
            if (meal.isSwapped) swapped++;
            if (meal.rating != null) rated++;
          }
        }
      }
    }

    const ls = L[e] || [];
    const listItems = ls.flatMap((l) => l.items || []);
    const purchased = listItems.filter((i) => i.isPurchased || (i.purchasedPeriods || []).length > 0).length;
    const st = (S[e] || [])[0];
    const pr = (P[e] || [])[0];
    const ws = W[e] || [];
    const hs = H[e] || [];
    const ses = SE[e] || [];
    const lastRequestApprox = maxTs(ses.map((s) => s.expiresAt));
    const lastRequest = lastRequestApprox ? lastRequestApprox - SESSION_TTL_MS : null;

    const lastActivity = maxTs([
      ...ms.map((m) => m.updatedAt),
      ...ls.map((l) => l.updatedAt),
      ...listItems.map((i) => i.purchasedAt),
      st?.lastCheckedDate,
      ...ws.map((w) => w.createdAt || w.date),
      ...hs.flatMap((h) => (h.logs || []).map((l) => l.loggedAt)),
      ...(F[e] || []).map((f) => f.savedAt),
      lastConsumedAt,
      lastCompletedAt,
      lastRequest,
    ]);
    const lastPaid = maxTs((PAY[e] || []).filter((p) => p.status === 'success').map((p) => p._id.getTimestamp()));
    const expiresAt = sub?.expiresAt || u.subscriptionExpiresAt || null;

    return {
      email: e,
      utm: [u.utmSource, u.utmMedium, u.utmCampaign].filter(Boolean).join('/') || null,
      plan: sub?.planId || u.planId || null,
      hasSubscriptionDoc: !!sub,
      paymentsSuccess: (PAY[e] || []).filter((p) => p.status === 'success').length,
      paymentsSandbox: (PAY[e] || []).filter((p) => p.status === 'sandbox').length,
      registeredAt: u.createdAt || null,
      lastPaidAt: lastPaid,
      expiresAt,
      expired: expiresAt ? new Date(expiresAt) < now : null,
      hasProfile: !!pr,
      menus: ms.length,
      firstMenuAt: ms[0]?.createdAt || null,
      lastMenuAt: ms.at(-1)?.createdAt || null,
      pendingDays: ms.at(-1)?.pendingDayIndices?.length ?? 0,
      mealsConsumed: consumed,
      mealsTotal: totalMeals,
      daysCompleted: completedDays,
      swapped,
      rated,
      customFoods,
      listPurchased: purchased,
      listTotal: listItems.length,
      streak: st ? { current: st.currentStreak, longest: st.longestStreak, totalDays: st.totalDaysCompleted, badges: (st.badges || []).length } : null,
      weightLogs: ws.length,
      waterDays: hs.length,
      favorites: (F[e] || []).length,
      pushEnabled: (PU[e] || []).length > 0,
      lastRequestApprox: lastRequest,
      lastActivityAt: lastActivity,
      daysSinceActivity: daysAgo(lastActivity),
    };
  }).sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));

  const pending = users
    .filter((u) => u.paymentStatus !== 'active')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((u) => ({
      email: u.email,
      createdAt: u.createdAt || null,
      plan: u.planId || null,
      utm: [u.utmSource, u.utmMedium, u.utmCampaign].filter(Boolean).join('/') || null,
      hasOnboarding: !!(u.onboarding && Object.keys(u.onboarding).length),
    }));

  const successPayments = payments.filter((p) => p.status === 'success');
  const revenueUah = successPayments.reduce((s, p) => s + (Number(p.payload?.amount) || 0), 0);
  const menusByMonth = await db.collection('weekly_menus').aggregate([
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, menus: { $sum: 1 }, users: { $addToSet: '$userEmail' } } },
    { $project: { _id: 0, month: '$_id', menus: 1, users: { $size: '$users' } } },
    { $sort: { month: 1 } },
  ]).toArray();

  const summary = {
    generatedAt: now,
    usersTotal: users.length,
    usersPaid: paidUsers.length,
    usersPending: pending.length,
    subscriptionsActiveNotExpired: subs.filter((s) => s.status === 'active' && s.expiresAt && new Date(s.expiresAt) > now).length,
    subscriptionsExpired: subs.filter((s) => s.expiresAt && new Date(s.expiresAt) <= now).length,
    paymentsSuccess: successPayments.length,
    revenueUah,
    menusTotal: await db.collection('weekly_menus').countDocuments(),
    activeLast7d: subscribers.filter((s) => s.daysSinceActivity != null && s.daysSinceActivity <= 7).length,
    activeLast30d: subscribers.filter((s) => s.daysSinceActivity != null && s.daysSinceActivity <= 30).length,
    menusByMonth,
  };

  await client.close();

  if (JSON_OUT) {
    console.log(JSON.stringify({ summary, subscribers, pending }, null, 2));
    return;
  }

  console.log(`\nSytno usage report — ${fmt(now)} UTC\n`);
  console.table({
    'Users total': summary.usersTotal,
    'Paid users': summary.usersPaid,
    'Pending (never paid)': summary.usersPending,
    'Subscriptions active (not expired)': summary.subscriptionsActiveNotExpired,
    'Subscriptions expired': summary.subscriptionsExpired,
    'Payments (success)': summary.paymentsSuccess,
    'Revenue, UAH': summary.revenueUah,
    'Menus generated': summary.menusTotal,
    'Subscribers active ≤7d': summary.activeLast7d,
    'Subscribers active ≤30d': summary.activeLast30d,
  });
  console.log('Menus by month:');
  console.table(menusByMonth);

  console.log('Subscribers (sorted by last activity):');
  console.table(subscribers.map((s) => ({
    email: s.email,
    plan: `${s.plan ?? '?'}${s.expired ? ' (expired)' : ''}${s.hasSubscriptionDoc ? '' : ' [no sub doc]'}`,
    paid: s.paymentsSuccess,
    expires: fmt(s.expiresAt),
    menus: s.menus,
    eaten: `${s.mealsConsumed}/${s.mealsTotal}`,
    days: s.daysCompleted,
    swaps: s.swapped,
    custom: s.customFoods,
    list: `${s.listPurchased}/${s.listTotal}`,
    streak: s.streak ? `${s.streak.current}/${s.streak.longest}` : '—',
    lastActivity: fmt(s.lastActivityAt),
    daysAgo: s.daysSinceActivity ?? '—',
    utm: s.utm ?? '—',
  })));

  console.log('Pending users (chose plan / requested link, never paid):');
  console.table(pending.map((p) => ({
    email: p.email,
    created: fmt(p.createdAt),
    plan: p.plan ?? '—',
    onboarding: p.hasOnboarding ? 'yes' : 'no',
    utm: p.utm ?? '—',
  })));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
