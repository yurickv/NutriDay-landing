import { SilpoProductDetails } from './types';

type Raw = Record<string, unknown>;

const DESCRIPTION_KEYS = ['description', 'shortDescription', 'about', 'text'];
const ATTRIBUTE_LABELS: Record<string, string> = {
  composition: 'Склад',
  ingredients: 'Склад',
  brand: 'Бренд',
  producer: 'Виробник',
  manufacturer: 'Виробник',
  country: 'Країна',
  countryOfOrigin: 'Країна',
  storage: 'Зберігання',
  storageConditions: 'Зберігання',
  shelfLife: 'Термін придатності',
  expiration: 'Термін придатності',
  weight: 'Вага',
  volume: 'Обʼєм',
  calories: 'Калорійність',
  energy: 'Енергетична цінність',
  proteins: 'Білки',
  protein: 'Білки',
  fats: 'Жири',
  fat: 'Жири',
  carbohydrates: 'Вуглеводи',
  carbs: 'Вуглеводи',
};

function str(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function pushRow(out: Array<{ label: string; value: string }>, label: string | null, value: unknown) {
  const v = str(value);
  if (!label || !v) return;
  if (out.some((r) => r.label === label && r.value === v)) return;
  out.push({ label, value: v.length > 400 ? `${v.slice(0, 400)}…` : v });
}

/**
 * The tool's JSON is only loosely documented ("attributes, nutrition info, image
 * URLs"), so this accepts several plausible shapes and degrades to whatever is
 * present. Unknown nested objects are ignored rather than dumped.
 */
export function normalizeProductDetails(rawInput: unknown): SilpoProductDetails {
  const raw = (rawInput ?? {}) as Raw;
  const product = (raw.product && typeof raw.product === 'object' ? raw.product : raw) as Raw;

  const images: string[] = [];
  const gallery = Array.isArray(product.images) ? product.images : [];
  for (const img of gallery) {
    const url = typeof img === 'string' ? img : str((img as Raw)?.url ?? (img as Raw)?.src);
    if (url && !images.includes(url)) images.push(url);
  }
  const thumb = str(product.image);
  if (thumb && !images.includes(thumb)) images.unshift(thumb);

  let description: string | null = null;
  for (const k of DESCRIPTION_KEYS) {
    description = str(product[k]);
    if (description) break;
  }

  const attributes: Array<{ label: string; value: string }> = [];

  // 1) Explicit attribute lists: [{ name|label|title, value }] or { key: value }.
  const attrs = product.attributes ?? product.properties ?? product.characteristics;
  if (Array.isArray(attrs)) {
    for (const a of attrs as Raw[]) {
      pushRow(attributes, str(a?.name ?? a?.label ?? a?.title ?? a?.key), a?.value ?? a?.values ?? a?.text);
    }
  } else if (attrs && typeof attrs === 'object') {
    for (const [k, v] of Object.entries(attrs as Raw)) pushRow(attributes, ATTRIBUTE_LABELS[k] ?? k, v);
  }

  // 2) Nutrition block: { calories, proteins, fats, carbohydrates } or [{ name, value }].
  const nutrition = product.nutrition ?? product.nutritionFacts ?? product.nutritionalValue;
  if (Array.isArray(nutrition)) {
    for (const n of nutrition as Raw[]) pushRow(attributes, str(n?.name ?? n?.label ?? n?.title), n?.value);
  } else if (nutrition && typeof nutrition === 'object') {
    for (const [k, v] of Object.entries(nutrition as Raw)) pushRow(attributes, ATTRIBUTE_LABELS[k] ?? k, v);
  }

  // 3) Well-known top-level scalar fields.
  for (const [k, label] of Object.entries(ATTRIBUTE_LABELS)) {
    if (k in product && typeof product[k] !== 'object') pushRow(attributes, label, product[k]);
  }

  return {
    name: str(product.name) ?? '',
    images,
    price: num(product.price),
    displayRatio: str(product.displayRatio ?? product.ratio),
    weighted: Boolean(product.weighted),
    available: product.hasOfferAtBranch === false ? false : Boolean(product.available ?? true),
    description,
    attributes,
  };
}
