// LiqPay returns the buyer to result_url with a POST form. A statically
// prerendered page is served as a file on Vercel and answers POST with 405,
// so the result screen (and its GA4 purchase event) never rendered for real
// customers. Rendering on demand lets the page answer POST like any dynamic
// route. Preferred target for result_url is /api/liqpay/result, which also
// carries order_id/status into the query; this keeps the old URL working.
export const dynamic = 'force-dynamic';

export default function PaymentResultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
