import { describe, it, expect } from 'vitest';
import { parseUtm, captureAttribution, readAttribution } from './attribution';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    _map: map,
  };
}

describe('parseUtm', () => {
  it('extracts utm params', () => {
    expect(parseUtm('?utm_source=instagram&utm_medium=social&utm_campaign=bio')).toEqual({
      utmSource: 'instagram',
      utmMedium: 'social',
      utmCampaign: 'bio',
    });
  });
  it('returns empty object when no utm params', () => {
    expect(parseUtm('?foo=bar')).toEqual({});
  });
});

describe('captureAttribution (first-touch wins)', () => {
  it('writes attribution when storage empty and utm present', () => {
    const s = fakeStorage();
    captureAttribution('?utm_source=partner&utm_medium=referral', s);
    expect(JSON.parse(s.getItem('nd_attribution')!)).toEqual({ utmSource: 'partner', utmMedium: 'referral' });
  });
  it('does NOT overwrite existing attribution', () => {
    const s = fakeStorage({ nd_attribution: JSON.stringify({ utmSource: 'instagram' }) });
    captureAttribution('?utm_source=partner', s);
    expect(JSON.parse(s.getItem('nd_attribution')!)).toEqual({ utmSource: 'instagram' });
  });
  it('does nothing when no utm present', () => {
    const s = fakeStorage();
    captureAttribution('?foo=bar', s);
    expect(s.getItem('nd_attribution')).toBeNull();
  });
});

describe('readAttribution', () => {
  it('parses stored attribution', () => {
    const s = fakeStorage({ nd_attribution: JSON.stringify({ utmSource: 'instagram' }) });
    expect(readAttribution(s)).toEqual({ utmSource: 'instagram' });
  });
  it('returns empty object when nothing stored', () => {
    expect(readAttribution(fakeStorage())).toEqual({});
  });
});
