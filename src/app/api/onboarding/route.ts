// app/api/onboarding/route.ts
//
// Intentional no-op endpoint. The onboarding wizard posts here before the user
// is authenticated; the real onboarding data is persisted later (with an email
// key) via /api/subscription/init. This route only acknowledges the client so
// the "creating plan" screen can advance.
//
// SECURITY: it must NOT log the request body — that body carries personal data
// (age/weight/sex/goals) and writing it to server logs is a PII leak. We also
// don't parse it into anything, to keep this a minimal, side-effect-free stub.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: true });
}
