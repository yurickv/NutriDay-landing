import { NextResponse } from 'next/server';
import { SilpoAuthError, SilpoNotConnectedError, SilpoRateLimitError, SilpoToolError } from './types';

export function silpoErrorResponse(err: unknown): NextResponse {
  if (err instanceof SilpoNotConnectedError) return NextResponse.json({ error: 'not-connected' }, { status: 409 });
  if (err instanceof SilpoAuthError) return NextResponse.json({ error: 'reconnect' }, { status: 401 });
  if (err instanceof SilpoRateLimitError) return NextResponse.json({ error: 'rate-limit' }, { status: 429 });
  if (err instanceof SilpoToolError) {
    if (err.message === 'no-slots') return NextResponse.json({ error: 'no-slots' }, { status: 409 });
    if (err.message === 'no-delivery') return NextResponse.json({ error: 'no-delivery' }, { status: 409 });
    if (err.message === 'address-not-found') return NextResponse.json({ error: 'address-not-found' }, { status: 404 });
    console.error('Silpo tool error:', err.message);
    return NextResponse.json({ error: 'silpo-error', message: err.message.slice(0, 300) }, { status: 502 });
  }
  console.error('Silpo unexpected error:', err);
  return NextResponse.json({ error: 'silpo-error' }, { status: 502 });
}

const RETURN_TO_WHITELIST = new Set(['/shopping-list', '/profile']);

export function safeReturnTo(value: string | null): string {
  return value && RETURN_TO_WHITELIST.has(value) ? value : '/profile';
}
