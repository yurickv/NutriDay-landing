export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-ink/10 dark:bg-night-ink/10 rounded-2xl animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function MealCardSkeleton() {
  return (
    <div className="bg-card dark:bg-night-card rounded-2xl p-4 shadow-soft animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-ink/10 dark:bg-night-ink/10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-ink/10 dark:bg-night-ink/10 rounded-xl w-3/4" />
          <div className="h-3 bg-ink/10 dark:bg-night-ink/10 rounded-xl w-1/2" />
        </div>
        <div className="w-12 h-6 bg-ink/10 dark:bg-night-ink/10 rounded-full" />
      </div>
    </div>
  );
}
