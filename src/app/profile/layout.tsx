import { redirect } from 'next/navigation';
import { checkSessionSubscription, inactiveRedirectTarget } from '@/lib/subscription';

// Server guard: blocks access when the subscription is missing or expired.
// The page renders its own AppShell, so this layout only enforces access.
export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { active, userExists } = await checkSessionSubscription();
  if (!active) redirect(inactiveRedirectTarget(userExists));

  return <>{children}</>;
}
