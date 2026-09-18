import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./client', () => ({ callTool: vi.fn() }));
import { callTool } from './client';
import { matchShoppingItems, rankCandidates, searchCandidates } from './matchProducts';
import { SilpoProduct } from './types';

const ctx = {
  cartId: 'c', branchId: 'br', companyId: 'co', deliveryType: 'SelfPickup',
  timeslot: { start: 's', end: 'e' }, minOrderCost: 199, address: { city: null, street: null },
};
const prod = (id: string, name: string, extra: Partial<SilpoProduct> = {}): SilpoProduct => ({
  id, name, slug: id, price: 100, oldPrice: null, stock: 10, available: true, image: null,
  weighted: false, step: 1, displayRatio: '800г', companyId: 'co', branchId: 'br', externalProductId: 1, ...extra,
});
const prefs = { allergies: [], dislikedFoods: [], dietaryPreferences: [] };

describe('searchCandidates', () => {
  beforeEach(() => vi.mocked(callTool).mockReset());
  it('chunks names by 30 and keys results by query, dropping unavailable products', async () => {
    const names = Array.from({ length: 31 }, (_, i) => `p${i}`);
    vi.mocked(callTool)
      .mockResolvedValueOnce({ queries: names.slice(0, 30).map((q) => ({ query: q, totalFound: 1, products: [prod(q, q)] })) })
      .mockResolvedValueOnce({ queries: [{ query: 'p30', totalFound: 2, products: [prod('a', 'a', { available: false }), prod('b', 'b', { stock: 0 }), prod('c', 'c')] }] });
    const map = await searchCandidates('u', ctx, names);
    expect(vi.mocked(callTool)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(callTool).mock.calls[0][2]).toMatchObject({ branchId: 'br', deliveryType: 'SelfPickup', timeslotStart: 's', timeslotEnd: 'e', limit: 6 });
    expect(map.get('p0')?.[0].id).toBe('p0');
    expect(map.get('p30')?.map((p) => p.id)).toEqual(['c']);
  });
});

describe('rankCandidates', () => {
  const items = [{ itemId: 'i1', name: 'Кисломолочний сир', quantity: 400, unit: 'г' }];
  const candidates = new Map([['Кисломолочний сир', [prod('baby', 'Сирок Milupa дитячий'), prod('cheese', 'Сир кисломолочний 9%')]]]);

  it('uses the LLM choice when it names a real candidate', async () => {
    const llm = vi.fn().mockResolvedValue(JSON.stringify({ choices: { i1: 'cheese' } }));
    const r = await rankCandidates(items, candidates, prefs, llm);
    expect(r.get('i1')).toBe('cheese');
    expect(llm.mock.calls[0][1]).toContain('Сирок Milupa');
  });
  it('honours an explicit null (no suitable product)', async () => {
    const llm = vi.fn().mockResolvedValue(JSON.stringify({ choices: { i1: null } }));
    expect((await rankCandidates(items, candidates, prefs, llm)).get('i1')).toBeNull();
  });
  it('falls back to the first candidate when the LLM fails or hallucinates', async () => {
    expect((await rankCandidates(items, candidates, prefs, vi.fn().mockRejectedValue(new Error('down')))).get('i1')).toBe('baby');
    expect((await rankCandidates(items, candidates, prefs, vi.fn().mockResolvedValue('{"choices":{"i1":"ghost"}}'))).get('i1')).toBe('baby');
  });
  it('skips the LLM entirely when no item has candidates', async () => {
    const llm = vi.fn();
    await rankCandidates(items, new Map(), prefs, llm);
    expect(llm).not.toHaveBeenCalled();
  });
});

describe('matchShoppingItems', () => {
  beforeEach(() => vi.mocked(callTool).mockReset());
  it('builds matches with quantities, alternatives, totals and unmatched', async () => {
    vi.mocked(callTool).mockResolvedValueOnce({ queries: [
      { query: 'Гречка', totalFound: 2, products: [prod('g1', 'Гречка 800г', { price: 109 }), prod('g2', 'Батончик гречка', { price: 125 })] },
      { query: 'Єдиноріг', totalFound: 0, products: [] },
    ] });
    const llm = vi.fn().mockResolvedValue(JSON.stringify({ choices: { a: 'g1' } }));
    const res = await matchShoppingItems('u', [
      { itemId: 'a', name: 'Гречка', quantity: 1000, unit: 'г' },
      { itemId: 'b', name: 'Єдиноріг', quantity: 1, unit: 'шт' },
    ], ctx, prefs, llm);

    expect(res.unmatched).toEqual([{ itemId: 'b', name: 'Єдиноріг' }]);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0]).toMatchObject({ itemId: 'a', quantity: 2, approximate: false, lineTotal: 218 });
    expect(res.matches[0].alternatives.map((p) => p.id)).toEqual(['g2']);
    expect(res.total).toBe(218);
    expect(res.llmUsed).toBe(true);
  });
});
