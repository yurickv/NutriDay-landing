// app/api/liqpay/result/route.ts
//
// Target for LiqPay `result_url`. LiqPay brings the buyer back with a POST
// form (data + signature); this handler verifies the signature and redirects
// (303 → GET) to the client result page with order_id/status in the query so
// the page works even when localStorage from the checkout tab is unavailable
// (e.g. the bank app returned the user in a different browser).
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyLiqpaySignature,
  decodeLiqpayData,
  buildResultRedirectPath,
  type LiqpayResultPayload,
} from '@/lib/liqpay/resultRedirect';

async function readDataAndSignature(
  request: NextRequest,
): Promise<{ data: string | null; signature: string | null }> {
  const { searchParams } = new URL(request.url);
  let data = searchParams.get('data');
  let signature = searchParams.get('signature');
  if (request.method === 'POST' && (!data || !signature)) {
    try {
      const form = await request.formData();
      data = (form.get('data') as string) || data;
      signature = (form.get('signature') as string) || signature;
    } catch {
      // not a form body — fall through with what we have
    }
  }
  return { data, signature };
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const { data, signature } = await readDataAndSignature(request);
  const privateKey = process.env.LIQPAY_PRIVATE_KEY;

  let payload: LiqpayResultPayload | null = null;
  if (data && signature && privateKey && verifyLiqpaySignature(privateKey, data, signature)) {
    payload = decodeLiqpayData(data);
  }

  // Unsigned/unknown → bare result page; it falls back to localStorage +
  // polling exactly as before.
  const target = new URL(buildResultRedirectPath(payload), request.url);
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
