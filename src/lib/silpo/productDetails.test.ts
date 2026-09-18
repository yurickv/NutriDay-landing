import { describe, it, expect } from 'vitest';
import { normalizeProductDetails } from './productDetails';

describe('normalizeProductDetails', () => {
  it('collects gallery + thumbnail, description and attribute rows from a typical payload', () => {
    const d = normalizeProductDetails({
      success: true,
      product: {
        name: 'Куряче філе',
        image: 'https://img/1.png',
        images: ['https://img/1.png', 'https://img/2.png'],
        price: 199,
        displayRatio: '100г',
        weighted: true,
        available: true,
        hasOfferAtBranch: true,
        description: 'Охолоджене філе.',
        attributes: [{ name: 'Країна', value: 'Україна' }, { name: 'Зберігання', value: '0…+4 °C' }],
        nutrition: { calories: 110, proteins: 23, fats: 1.2, carbohydrates: 0 },
      },
    });
    expect(d.name).toBe('Куряче філе');
    expect(d.images).toEqual(['https://img/1.png', 'https://img/2.png']);
    expect(d.description).toBe('Охолоджене філе.');
    expect(d.price).toBe(199);
    expect(d.weighted).toBe(true);
    expect(d.attributes).toEqual(expect.arrayContaining([
      { label: 'Країна', value: 'Україна' },
      { label: 'Калорійність', value: '110' },
      { label: 'Білки', value: '23' },
    ]));
  });

  it('marks the product unavailable when hasOfferAtBranch is false', () => {
    expect(normalizeProductDetails({ name: 'x', available: true, hasOfferAtBranch: false }).available).toBe(false);
  });

  it('survives an unexpected shape', () => {
    const d = normalizeProductDetails({ weird: { nested: true } });
    expect(d).toEqual({
      name: '', images: [], price: null, displayRatio: null, weighted: false, available: true, description: null, attributes: [],
    });
  });

  it('accepts images as objects with url and dedupes them', () => {
    const d = normalizeProductDetails({ image: 'a', images: [{ url: 'a' }, { url: 'b' }] });
    expect(d.images).toEqual(['a', 'b']);
  });
});
