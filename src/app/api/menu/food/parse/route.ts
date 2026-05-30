import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { parseCustomFood } from '@/lib/menu/parseCustomFood';

interface ParseBody {
  text: string;
  grams: number;
}

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
