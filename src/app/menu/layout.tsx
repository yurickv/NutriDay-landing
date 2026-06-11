import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import InstallBanner from '@/components/common/InstallBanner';
import { checkSessionSubscription, inactiveRedirectTarget } from '@/lib/subscription';

export default async function MenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { active, userExists } = await checkSessionSubscription();
  if (!active) redirect(inactiveRedirectTarget(userExists));

  return (
    <AppShell>
      {children}
      <InstallBanner />
    </AppShell>
  );
}
