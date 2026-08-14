// app/api/discount/route.ts
// GET  → стан вікна знижки з httpOnly-куки: { active, until }.
// POST → відкриває вікно (скретч-картка на /payment/surprise). Ідемпотентний:
//        якщо кука вже є — повертає її стан і НЕ перезапускає таймер, тож
//        «згорілу» знижку не можна відновити повторним скретчем (поки жива
//        кука). Ставити куку може лише сервер — клієнт дедлайн не диктує.
import { NextRequest, NextResponse } from 'next/server';
import {
  DISCOUNT_COOKIE,
  DISCOUNT_COOKIE_MAX_AGE_S,
  DISCOUNT_WINDOW_MS,
  discountUntilFromCookie,
  isDiscountActive,
} from '@/lib/discount';

function stateResponse(until: number | null) {
  return NextResponse.json({
    active: isDiscountActive(until),
    until,
  });
}

export async function GET(request: NextRequest) {
  return stateResponse(discountUntilFromCookie(request));
}

export async function POST(request: NextRequest) {
  const existing = discountUntilFromCookie(request);
  if (existing !== null) return stateResponse(existing);

  const until = Date.now() + DISCOUNT_WINDOW_MS;
  const res = stateResponse(until);
  res.cookies.set(DISCOUNT_COOKIE, String(until), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DISCOUNT_COOKIE_MAX_AGE_S,
  });
  return res;
}
