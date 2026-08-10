// Layout живе крізь переходи між кроками ([step] ремаунтиться, layout — ні):
// тримає кремовий фон, щоб між кроками не просвічував білий body.
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-dvh bg-cream dark:bg-night">{children}</div>;
}
