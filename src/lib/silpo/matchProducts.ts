import OpenAI from 'openai';
import { callTool } from './client';
import { computeQuantity } from './quantity';
import { SilpoCartContext, SilpoMatch, SilpoProduct, SilpoUnmatched } from './types';

export interface MatchInput { itemId: string; name: string; quantity: number; unit: string }
export interface MatchPrefs { allergies: string[]; dislikedFoods: string[]; dietaryPreferences: string[] }
export type LlmCall = (system: string, user: string) => Promise<string>;

const BATCH_SIZE = 30;
const CANDIDATES_PER_ITEM = 6;

interface BatchResponse {
  queries?: Array<{ query: string; totalFound: number; products: SilpoProduct[] }>;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Runs `silpo_find_products_batch` in chunks of 30; map key = the query string sent. */
export async function searchCandidates(
  userEmail: string,
  ctx: SilpoCartContext,
  names: string[],
): Promise<Map<string, SilpoProduct[]>> {
  const result = new Map<string, SilpoProduct[]>();
  for (const part of chunk(names, BATCH_SIZE)) {
    const res = await callTool<BatchResponse>(userEmail, 'silpo_find_products_batch', {
      branchId: ctx.branchId,
      deliveryType: ctx.deliveryType,
      timeslotStart: ctx.timeslot.start,
      timeslotEnd: ctx.timeslot.end,
      products: part,
      limit: CANDIDATES_PER_ITEM,
    });
    for (const q of res.queries ?? []) {
      result.set(q.query, (q.products ?? []).filter((p) => p.available && p.stock > 0));
    }
  }
  return result;
}

const RANK_SYSTEM = `You choose grocery products for a Ukrainian shopping list. For each list item you get up to ${CANDIDATES_PER_ITEM} candidate products found in a Silpo supermarket search.

Pick the ONE candidate a sensible home cook would buy for that ingredient:
- Prefer the plain, basic version of the ingredient (e.g. "Сир кисломолочний 9%" for "кисломолочний сир"), not baby food, snacks, bars, ready meals, smoked/salted/marinated variants, or products where the ingredient is only an additive.
- Prefer a package size close to the needed amount; among equals prefer the cheaper one.
- Never pick a product that contains an allergen or a disliked food from the user's preferences.
- If NO candidate is genuinely the requested ingredient, answer null for that item.

Reply with ONLY valid JSON: {"choices": {"<itemId>": "<productId or null>", ...}}. Include every itemId you were given.`;

function pickFallback(candidates: SilpoProduct[] | undefined): string | null {
  return candidates?.[0]?.id ?? null;
}

export async function rankCandidates(
  items: MatchInput[],
  candidates: Map<string, SilpoProduct[]>,
  prefs: MatchPrefs,
  llm: LlmCall,
): Promise<Map<string, string | null>> {
  const withCandidates = items.filter((it) => (candidates.get(it.name)?.length ?? 0) > 0);
  const result = new Map<string, string | null>();
  if (withCandidates.length === 0) return result;

  const payload = {
    preferences: prefs,
    items: withCandidates.map((it) => ({
      itemId: it.itemId,
      need: `${it.name} ${it.quantity} ${it.unit}`,
      candidates: (candidates.get(it.name) ?? []).map((p) => ({
        id: p.id, name: p.name, price: p.price, displayRatio: p.displayRatio, weighted: p.weighted,
      })),
    })),
  };

  let choices: Record<string, unknown> = {};
  try {
    const raw = await llm(RANK_SYSTEM, JSON.stringify(payload));
    const parsed = JSON.parse(raw) as { choices?: Record<string, unknown> };
    choices = parsed.choices ?? {};
  } catch {
    choices = {};
  }

  for (const it of withCandidates) {
    const list = candidates.get(it.name) ?? [];
    const hasKey = Object.prototype.hasOwnProperty.call(choices, it.itemId);
    const choice = choices[it.itemId];
    if (hasKey && choice === null) {
      result.set(it.itemId, null);
      continue;
    }
    if (typeof choice === 'string' && list.some((p) => p.id === choice)) {
      result.set(it.itemId, choice);
      continue;
    }
    result.set(it.itemId, pickFallback(list));
  }
  return result;
}

let openaiClient: OpenAI | null = null;
export const defaultLlm: LlmCall = async (system, user) => {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await openaiClient.chat.completions.create({
    model: 'gpt-4.1-mini',
    temperature: 0,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  return res.choices[0]?.message?.content ?? '{}';
};

export function buildMatch(item: MatchInput, product: SilpoProduct, alternatives: SilpoProduct[]): SilpoMatch {
  const { quantity, approximate } = computeQuantity({ quantity: item.quantity, unit: item.unit }, product);
  return {
    itemId: item.itemId,
    itemName: item.name,
    itemQuantity: item.quantity,
    itemUnit: item.unit,
    product,
    alternatives,
    quantity,
    approximate,
    lineTotal: Math.round(quantity * product.price * 100) / 100,
  };
}

export async function matchShoppingItems(
  userEmail: string,
  items: MatchInput[],
  ctx: SilpoCartContext,
  prefs: MatchPrefs,
  llm: LlmCall = defaultLlm,
): Promise<{ matches: SilpoMatch[]; unmatched: SilpoUnmatched[]; total: number; llmUsed: boolean }> {
  const names = Array.from(new Set(items.map((it) => it.name)));
  const candidates = await searchCandidates(userEmail, ctx, names);

  let llmUsed = true;
  const tracked: LlmCall = async (s, u) => {
    try {
      return await llm(s, u);
    } catch (e) {
      llmUsed = false;
      throw e;
    }
  };
  const choices = await rankCandidates(items, candidates, prefs, tracked);

  const matches: SilpoMatch[] = [];
  const unmatched: SilpoUnmatched[] = [];
  for (const it of items) {
    const list = candidates.get(it.name) ?? [];
    const chosenId = choices.get(it.itemId) ?? null;
    const product = chosenId ? list.find((p) => p.id === chosenId) : undefined;
    if (!product) {
      unmatched.push({ itemId: it.itemId, name: it.name });
      continue;
    }
    matches.push(buildMatch(it, product, list.filter((p) => p.id !== product.id)));
  }
  const total = Math.round(matches.reduce((s, m) => s + m.lineTotal, 0) * 100) / 100;
  return { matches, unmatched, total, llmUsed };
}
