import { NextRequest, NextResponse } from 'next/server';
import { checkSessionSubscription } from '@/lib/subscription';
import { parseCustomFood } from '@/lib/menu/parseCustomFood';

interface ParseBody {
  text: string;
  grams: number;
}

export async function POST(req: NextRequest) {
  // This route spends money on an OpenAI call, so gate it behind an ACTIVE
  // subscription — not merely a valid session — to prevent lapsed users from
  // racking up AI cost.
  const { email: userEmail, active } = await checkSessionSubscription();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!active) {
    return NextResponse.json(
      { error: 'Subscription expired', message: 'Ваша підписка завершилася.' },
      { status: 402 },
    );
  }

  const body = (await req.json()) as ParseBody;
  const text = (body.text ?? '').trim();
  const grams = Math.round(Number(body.grams));

  if (!text) {
    return NextResponse.json({ error: 'Порожній опис' }, { status: 400 });
  }
  if (text.length > 200) {
    return NextResponse.json({ error: 'Опис задовгий' }, { status: 400 });
  }
  if (!Number.isFinite(grams) || grams <= 0) {
    return NextResponse.json({ error: 'Вкажіть вагу страви' }, { status: 400 });
  }

  const parsed = await parseCustomFood(text, grams);
  return NextResponse.json({ parsed });
}
