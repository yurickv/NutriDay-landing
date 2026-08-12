import Link from "next/link";
import { cookies } from "next/headers";

export default async function Header() {
  // Cheap cookie-presence check (same as middleware) — no DB hit on every
  // landing view. A stale cookie sends the user to /menu, whose guard does the
  // real session check and bounces them back to the login form.
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get("nd_sess")?.value);

  return (
    <header className='absolute top-0 left-0 w-full z-20'>
      <div className='mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4'>
        <Link
          href='/'
          className='text-2xl text-white font-logo drop-shadow-md'
        >
          Sytno
        </Link>
        <Link
          href={hasSession ? "/menu" : "/auth/login"}
          className='rounded-full border border-white/70 bg-white/10 px-5 py-2 text-white backdrop-blur-sm transition-colors duration-300 hover:bg-card hover:text-ink'
        >
          {hasSession ? "Мій кабінет" : "Увійти"}
        </Link>
      </div>
    </header>
  );
}
