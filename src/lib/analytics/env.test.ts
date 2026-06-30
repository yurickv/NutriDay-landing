import { describe, it, expect } from 'vitest';
import { resolveAnalyticsEnv } from './env';

describe('resolveAnalyticsEnv', () => {
  it('returns local when no posthog key', () => {
    expect(resolveAnalyticsEnv({ posthogKey: undefined, envLabel: 'prod' })).toBe('local');
  });
  it('returns staging when key present and label is staging', () => {
    expect(resolveAnalyticsEnv({ posthogKey: 'phc_x', envLabel: 'staging' })).toBe('staging');
  });
  it('returns prod when key present and label is prod', () => {
    expect(resolveAnalyticsEnv({ posthogKey: 'phc_x', envLabel: 'prod' })).toBe('prod');
  });
  it('defaults to prod when key present but label missing', () => {
    expect(resolveAnalyticsEnv({ posthogKey: 'phc_x', envLabel: undefined })).toBe('prod');
  });
});
