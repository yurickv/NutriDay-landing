// Lightweight event tracking — extend with GA4 / Mixpanel / PostHog as needed

type AnalyticsEvent =
  | 'menu_generated'
  | 'meal_viewed'
  | 'meal_consumed'
  | 'meal_rated'
  | 'meal_swapped'
  | 'meal_saved_favorite'
  | 'shopping_item_checked'
  | 'shopping_day_filter_used'
  | 'water_logged'
  | 'weight_logged'
  | 'streak_completed'
  | 'streak_badge_earned'
  | 'push_permission_granted'
  | 'push_permission_denied'
  | 'servings_changed'
  | 'weekly_summary_viewed';

type EventProps = Record<string, string | number | boolean | undefined>;

export function track(event: AnalyticsEvent, props?: EventProps): void {
  if (typeof window === 'undefined') return;

  // Console log in development
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props);
  }

  // Placeholder: send to analytics provider
  // Example: window.gtag?.('event', event, props);
  // Example: window.posthog?.capture(event, props);
}
