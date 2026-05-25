import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { FavoriteMeal } from '@/types/engagement';
import { AIMeal } from '@/types/meals';
import { ObjectId } from 'mongodb';

// GET /api/favorites
export async function GET() {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const favorites = await db
    .collection('favorite_meals')
    .find<FavoriteMeal & { _id: ObjectId }>({ userEmail })
    .sort({ savedAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({
    favorites: favorites.map((f) => ({ ...f, _id: f._id.toString() })),
  });
}

// POST /api/favorites — save meal
export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { meal: AIMeal };
  if (!body.meal?.name) {
    return NextResponse.json({ error: 'Invalid meal' }, { status: 400 });
  }

  const db = await getDb();
  const col = db.collection('favorite_meals') as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const existing = await col.findOne({ userEmail, 'meal.name': body.meal.name });
  if (existing) {
    await col.updateOne(
      { userEmail, 'meal.name': body.meal.name },
      { $inc: { timesGenerated: 1 } },
    );
    return NextResponse.json({ success: true, alreadyExists: true });
  }

  await col.insertOne({
    userEmail,
    meal: body.meal,
    savedAt: new Date(),
    timesGenerated: 1,
  });

  return NextResponse.json({ success: true });
}

// DELETE /api/favorites?id=<objectId>
export async function DELETE(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = await getDb();
  await db.collection('favorite_meals').deleteOne({
    _id: new ObjectId(id),
    userEmail,
  });

  return NextResponse.json({ success: true });
}
