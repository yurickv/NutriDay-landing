import { BottomNavBar } from './BottomNavBar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="w-full max-w-[1400px] mx-auto">{children}</div>
      </main>
      <BottomNavBar />
    </div>
  );
}
