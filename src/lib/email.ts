// src/lib/email.ts

const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendMagicLinkEmail(to: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';

  if (!apiKey || !from || !appUrl) {
    console.warn(
      '[email] Missing RESEND_API_KEY / EMAIL_FROM / APP_URL, falling back to console log.'
    );
    const url = `${appUrl || ''}/auth/confirm?token=${encodeURIComponent(
      token
    )}`;
    console.log(`Magic link for ${to}: ${url}`);
    return false;
  }

  // Point at a confirmation PAGE (GET, no side effects) rather than the consume
  // API. The token is only spent when the user clicks the button there, which
  // fires a POST — so email scanners / link prefetchers that issue a GET can no
  // longer silently consume the one-time token before the user arrives.
  const magicLinkUrl = `${appUrl}/auth/confirm?token=${encodeURIComponent(
    token
  )}`;

  const subject = 'Ваш магічний лінк для входу в EasyMenu';
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
      <h2>Вітаємо в EasyMenu!</h2>
      <p>Натисніть кнопку нижче, щоб увійти до свого кабінету без пароля.</p>
      <p style="margin: 24px 0;">
        <a href="${magicLinkUrl}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#f97316;color:#fff;text-decoration:none;font-weight:600;">
          Увійти одним кліком
        </a>
      </p>
      <p>Якщо кнопка не працює, скопіюйте й вставте це посилання в браузер:</p>
      <p style="word-break:break-all;"><a href="${magicLinkUrl}">${magicLinkUrl}</a></p>
      <p style="font-size:12px;color:#6b7280;margin-top:24px;">Якщо ви не очікували цього листа, просто проігноруйте його.</p>
    </div>
  `;

  const resp = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('[email] Failed to send magic link email:', resp.status, text);
    return false;
  }

  return true;
}

