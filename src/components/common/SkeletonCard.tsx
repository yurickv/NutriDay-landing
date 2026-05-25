export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-neutral-200 dark:bg-neutral-800 rounded-2xl animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function MealCardSkeleton() {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 shadow-sm animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-800 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
          <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
        </div>
        <div className="w-12 h-6 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
      </div>
    </div>
  );
}
