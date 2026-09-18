import { SilpoProduct } from './types';

export type BaseUnit = 'g' | 'ml' | 'pc';
export interface BaseAmount { amount: number; unit: BaseUnit }

const KG_PER_PIECE_ESTIMATE = 0.15; // used when a weighted product is requested in pieces

const UNIT_TABLE: Array<{ match: RegExp; unit: BaseUnit; factor: number }> = [
  { match: /^(г|гр|грам|грамів|g)$/i, unit: 'g', factor: 1 },
  { match: /^(кг|kg)$/i, unit: 'g', factor: 1000 },
  { match: /^(мл|ml)$/i, unit: 'ml', factor: 1 },
  { match: /^(л|l)$/i, unit: 'ml', factor: 1000 },
  { match: /^(шт|шт\.|штук|штуки|pc|pcs)$/i, unit: 'pc', factor: 1 },
  { match: /^(ст\.?\s?л\.?|столова ложка|столові ложки)$/i, unit: 'g', factor: 15 },
  { match: /^(ч\.?\s?л\.?|чайна ложка|чайні ложки)$/i, unit: 'g', factor: 5 },
  { match: /^(скл\.?|склянка|склянки|стакан)$/i, unit: 'ml', factor: 250 },
];

export function toBaseUnits(quantity: number, unit: string): BaseAmount | null {
  const u = unit.trim().toLowerCase();
  for (const row of UNIT_TABLE) {
    if (row.match.test(u)) return { amount: quantity * row.factor, unit: row.unit };
  }
  return null;
}

/** "800г" → 800 g; "0,5кг" → 500 g; "10шт" → 10 pc; "шт" → 1 pc. */
export function parseDisplayRatio(ratio: string | null | undefined): BaseAmount | null {
  if (!ratio) return null;
  const s = ratio.trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)?\s*([а-яa-z.]+)$/i);
  if (!m) return null;
  // Only real packaging units make sense here (not spoons/glasses).
  if (!/^(г|гр|кг|мл|л|шт|шт\.)$/.test(m[2])) return null;
  const num = m[1] ? parseFloat(m[1]) : 1;
  return toBaseUnits(num, m[2]);
}

function roundUpToStep(value: number, step: number): number {
  const steps = Math.ceil(value / step - 1e-9);
  return Math.max(1, steps) * step;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** UI stepper increment: kg step for weighted goods, 1 pack otherwise. */
export function quantityStep(product: Pick<SilpoProduct, 'weighted' | 'step'>): number {
  return product.weighted ? product.step || 0.1 : 1;
}

export function computeQuantity(
  need: { quantity: number; unit: string },
  product: Pick<SilpoProduct, 'weighted' | 'step' | 'displayRatio' | 'stock'>,
): { quantity: number; approximate: boolean } {
  const base = toBaseUnits(need.quantity, need.unit);

  if (product.weighted) {
    const step = product.step > 0 ? product.step : 0.1;
    let kg: number;
    let approximate = false;
    if (!base) {
      kg = step;
      approximate = true;
    } else if (base.unit === 'pc') {
      kg = base.amount * KG_PER_PIECE_ESTIMATE;
      approximate = true;
    } else {
      kg = base.amount / 1000;
      approximate = base.unit === 'ml';
    }
    let qty = roundUpToStep(kg, step);
    if (product.stock > 0 && qty > product.stock) {
      qty = Math.max(step, Math.floor(product.stock / step + 1e-9) * step);
    }
    return { quantity: round3(qty), approximate };
  }

  const pack = parseDisplayRatio(product.displayRatio);
  let packs = 1;
  let approximate = false;
  if (!base || !pack) {
    approximate = true;
  } else if (base.unit === pack.unit) {
    packs = Math.ceil(base.amount / pack.amount - 1e-9);
  } else if (base.unit !== 'pc' && pack.unit !== 'pc') {
    packs = Math.ceil(base.amount / pack.amount - 1e-9); // g vs ml: density ≈ 1
    approximate = true;
  } else {
    approximate = true;
  }
  packs = Math.max(1, packs);
  if (product.stock > 0 && packs > product.stock) packs = Math.max(1, Math.floor(product.stock));
  return { quantity: packs, approximate };
}
