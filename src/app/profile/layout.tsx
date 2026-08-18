import { redirect } from 'next/navigation';
import { checkSessionSubscription, inactiveRedirectTarget } from '@/lib/subscription';
import { nunito } from '@/lib/fonts/legacy';

// Server guard: blocks access when the subscription is missing or expired.
// The page renders its own AppShell, so this layout only enforces access.
// Nunito: базовий шрифт цієї ще не відрестайленої сторінки (був на body).
export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { active, userExists } = await checkSessionSubscription();
  if (!active) redirect(inactiveRedirectTarget(userExists));

  return <div className={nunito.className}>{children}</div>;
}
