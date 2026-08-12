import { redirect } from 'next/navigation';
import { readSessionUserId } from '@/lib/auth/session';
import LoginForm from './LoginForm';

// Full session check (not just cookie presence): readSessionUserId() deletes
// expired sessions, so a stale cookie falls through to the form instead of
// looping between /menu's guard and this redirect.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const userId = await readSessionUserId();
  if (userId) {
    const target = (await searchParams).redirect;
    const safeTarget =
      target && target.startsWith('/') && !target.startsWith('//')
        ? target
        : '/menu';
    redirect(safeTarget);
  }

  return <LoginForm />;
}
