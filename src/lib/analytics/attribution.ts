export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

const STORAGE_KEY = 'nd_attribution';

const UTM_KEYS: Array<[keyof Attribution, string]> = [
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['utmContent', 'utm_content'],
  ['utmTerm', 'utm_term'],
];

export function parseUtm(search: string): Attribution {
  const params = new URLSearchParams(search);
  const out: Attribution = {};
  for (const [key, param] of UTM_KEYS) {
    const value = params.get(param);
    if (value) out[key] = value;
  }
  return out;
}

export function captureAttribution(
  search: string,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): void {
  if (storage.getItem(STORAGE_KEY)) return; // first-touch wins
  const parsed = parseUtm(search);
  if (Object.keys(parsed).length === 0) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}

export function readAttribution(storage: Pick<Storage, 'getItem'>): Attribution {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}
