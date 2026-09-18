import { describe, it, expect } from 'vitest';
import { parseDisplayRatio, toBaseUnits, computeQuantity } from './quantity';

describe('parseDisplayRatio', () => {
  it.each([
    ['800г', { amount: 800, unit: 'g' }],
    ['0,5кг', { amount: 500, unit: 'g' }],
    ['1 кг', { amount: 1000, unit: 'g' }],
    ['950мл', { amount: 950, unit: 'ml' }],
    ['1л', { amount: 1000, unit: 'ml' }],
    ['10шт', { amount: 10, unit: 'pc' }],
    ['шт', { amount: 1, unit: 'pc' }],
    ['100г', { amount: 100, unit: 'g' }],
  ])('parses %s', (input, expected) => {
    expect(parseDisplayRatio(input)).toEqual(expected);
  });
  it('returns null for unknown or empty', () => {
    expect(parseDisplayRatio('')).toBeNull();
    expect(parseDisplayRatio(null)).toBeNull();
    expect(parseDisplayRatio('пачка')).toBeNull();
  });
});

describe('toBaseUnits', () => {
  it.each([
    [200, 'г', { amount: 200, unit: 'g' }],
    [1.5, 'кг', { amount: 1500, unit: 'g' }],
    [300, 'мл', { amount: 300, unit: 'ml' }],
    [2, 'л', { amount: 2000, unit: 'ml' }],
    [3, 'шт', { amount: 3, unit: 'pc' }],
    [2, 'ст.л.', { amount: 30, unit: 'g' }],
    [1, 'ч.л.', { amount: 5, unit: 'g' }],
    [1, 'скл.', { amount: 250, unit: 'ml' }],
  ])('%s %s', (q, u, expected) => {
    expect(toBaseUnits(q, u)).toEqual(expected);
  });
  it('returns null for vague units', () => {
    expect(toBaseUnits(1, 'пучок')).toBeNull();
    expect(toBaseUnits(1, 'за смаком')).toBeNull();
  });
});

describe('computeQuantity — piece goods', () => {
  const pack800 = { weighted: false, step: 1, displayRatio: '800г', stock: 30 };
  it('rounds packs up', () => {
    expect(computeQuantity({ quantity: 1000, unit: 'г' }, pack800)).toEqual({ quantity: 2, approximate: false });
  });
  it('never returns less than one pack', () => {
    expect(computeQuantity({ quantity: 50, unit: 'г' }, pack800)).toEqual({ quantity: 1, approximate: false });
  });
  it('treats ml vs g as interchangeable but approximate', () => {
    expect(computeQuantity({ quantity: 900, unit: 'мл' }, pack800)).toEqual({ quantity: 2, approximate: true });
  });
  it('falls back to one approximate pack when units are incompatible', () => {
    expect(computeQuantity({ quantity: 3, unit: 'шт' }, pack800)).toEqual({ quantity: 1, approximate: true });
    expect(computeQuantity({ quantity: 1, unit: 'пучок' }, pack800)).toEqual({ quantity: 1, approximate: true });
  });
  it('handles piece packs', () => {
    const eggs = { weighted: false, step: 1, displayRatio: '10шт', stock: 20 };
    expect(computeQuantity({ quantity: 14, unit: 'шт' }, eggs)).toEqual({ quantity: 2, approximate: false });
  });
  it('caps at stock', () => {
    expect(computeQuantity({ quantity: 5000, unit: 'г' }, { ...pack800, stock: 3 })).toEqual({ quantity: 3, approximate: false });
  });
});

describe('computeQuantity — weighted goods (kg)', () => {
  const chicken = { weighted: true, step: 0.5, displayRatio: '100г', stock: 10 };
  it('converts grams to kg rounded up to step', () => {
    expect(computeQuantity({ quantity: 700, unit: 'г' }, chicken)).toEqual({ quantity: 1, approximate: false });
    expect(computeQuantity({ quantity: 1200, unit: 'г' }, chicken)).toEqual({ quantity: 1.5, approximate: false });
  });
  it('never returns less than one step', () => {
    expect(computeQuantity({ quantity: 50, unit: 'г' }, chicken)).toEqual({ quantity: 0.5, approximate: false });
  });
  it('estimates 150 g per piece for weighted produce', () => {
    const tomato = { weighted: true, step: 0.25, displayRatio: '100г', stock: 10 };
    expect(computeQuantity({ quantity: 4, unit: 'шт' }, tomato)).toEqual({ quantity: 0.75, approximate: true });
  });
  it('caps at stock (multiple of step)', () => {
    expect(computeQuantity({ quantity: 20000, unit: 'г' }, { ...chicken, stock: 2.7 })).toEqual({ quantity: 2.5, approximate: false });
  });
});
