// app/api/auth/magic-link/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { issueMagicLinkToken } from '@/lib/auth/magic';
import { sendMagicLinkEmail } from '@/lib/email';

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

