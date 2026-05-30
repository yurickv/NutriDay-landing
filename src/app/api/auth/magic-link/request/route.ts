// app/api/auth/magic-link/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { issueMagicLinkToken } from '@/lib/auth/magic';
import { sendMagicLinkEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, tooManyRequestsResponse } from '@/lib/rateLimit';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
    };

    const email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Invalid or missing email' },
        { status: 400 }
      );
    }

    // Throttle: per (ip,email) to stop bombing one address, and per ip to stop
    // enumerating many addresses from one source.
    const ip = getClientIp(req);
    const perEmail = await checkRateLimit(`ml:${ip}:${email}`, 5, WINDOW_MS);
    if (!perEmail.allowed) return tooManyRequestsResponse(perEmail.retryAfterSeconds);
    const perIp = await checkRateLimit(`ml-ip:${ip}`, 20, WINDOW_MS);
    if (!perIp.allowed) return tooManyRequestsResponse(perIp.retryAfterSeconds);

    const { token } = await issueMagicLinkToken(email);

    const sent = await sendMagicLinkEmail(email, token);

    return NextResponse.json({
      success: true,
      sent,
    });
  } catch (error: any) {
    console.error('Magic-link request error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

