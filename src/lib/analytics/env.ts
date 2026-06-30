export type AnalyticsEnv = 'local' | 'staging' | 'prod';

export function resolveAnalyticsEnv(input: {
  posthogKey?: string;
  envLabel?: string;
}): AnalyticsEnv {
  if (!input.posthogKey) return 'local';
  return input.envLabel === 'staging' ? 'staging' : 'prod';
}

export function getAnalyticsEnv(): AnalyticsEnv {
  return resolveAnalyticsEnv({
    posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    envLabel: process.env.NEXT_PUBLIC_ANALYTICS_ENV,
  });
}

export function isAnalyticsEnabled(): boolean {
  return getAnalyticsEnv() !== 'local';
}
