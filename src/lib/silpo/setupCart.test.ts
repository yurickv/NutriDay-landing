import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./client', () => ({ callTool: vi.fn() }));
import { callTool } from './client';
import { haversineKm, nearestBranch, lookupDeliveryOptions, createCart } from './setupCart';

const branch = (id: string, lat: number, lng: number, open = true) => ({
  branchId: id, companyId: 'comp', city: 'Тернопіль', address: `вул. ${id}`,
  latitude: String(lat), longitude: String(lng), hasPickup: true, open,
});

describe('haversineKm', () => {
  it('Kyiv → Ternopil is roughly 370 km', () => {
    const d = haversineKm({ lat: 50.45, lng: 30.52 }, { lat: 49.55, lng: 25.59 });
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(390);
  });
});

describe('nearestBranch', () => {
  it('returns the closest open pickup branch', () => {
    const b = nearestBranch(
      [branch('far', 50.45, 30.52), branch('near', 49.56, 25.6), branch('closed', 49.555, 25.592, false)],
      { lat: 49.555, lng: 25.592 },
    );
    expect(b?.branchId).toBe('near');
  });
  it('returns null when none qualify', () => {
    expect(nearestBranch([branch('x', 1, 1, false)], { lat: 1, lng: 1 })).toBeNull();
  });
});

describe('lookupDeliveryOptions', () => {
  beforeEach(() => vi.mocked(callTool).mockReset());

  it('offers home delivery and nearest pickup', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, addresses: [{ address: 'Тернопіль', city: 'Тернопіль', street: null, houseNumber: null, district: null, latitude: 49.5558, longitude: 25.5924 }] })
      .mockResolvedValueOnce({ success: true, options: [
        { deliveryType: 'DeliveryHome', branchId: 'home-br', description: '' },
        { deliveryType: 'NovaPoshta', branchId: null, description: '' },
        { deliveryType: 'SelfPickup', branchId: null, description: '' },
      ] })
      .mockResolvedValueOnce({ success: true, branches: [branch('far', 50.45, 30.52), branch('near', 49.556, 25.6)], meta: { total: 2 } });

    const res = await lookupDeliveryOptions('u', 'Тернопіль');

    expect(res.address.city).toBe('Тернопіль');
    expect(res.options).toEqual([
      { deliveryType: 'DeliveryHome', branchId: 'home-br', label: 'Доставка додому' },
      expect.objectContaining({ deliveryType: 'SelfPickup', branchId: 'near', label: 'Самовивіз: Тернопіль, вул. near' }),
    ]);
  });

  it('throws address-not-found when geocoding is empty', async () => {
    vi.mocked(callTool).mockResolvedValueOnce({ success: true, addresses: [] });
    await expect(lookupDeliveryOptions('u', 'qwerty')).rejects.toThrow('address-not-found');
  });
});

describe('createCart', () => {
  beforeEach(() => vi.mocked(callTool).mockReset());
  const address = { text: 'Тернопіль, Руська 1', city: 'Тернопіль', street: 'вулиця Руська', houseNumber: '1', district: null, latitude: 49.55, longitude: 25.59 };

  it('creates a home-delivery cart with the first available slot', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, slots: [{ start: 's', end: 'e', available: true, minOrderCost: 699 }] })
      .mockResolvedValueOnce({ success: true, shoppingCartId: 'new' });
    await createCart('u', address, { deliveryType: 'DeliveryHome', branchId: 'home-br', label: 'Доставка додому' });
    const call = vi.mocked(callTool).mock.calls[1];
    expect(call[1]).toBe('silpo_create_shopping_cart');
    expect(call[2]).toEqual({
      addressType: 'house', latitude: 49.55, longitude: 25.59, city: 'Тернопіль', street: 'вулиця Руська', house: '1',
      deliveryType: 'DeliveryHome', timeslot: { start: 's', end: 'e' }, branchId: 'home-br',
    });
  });

  it('creates a self-pickup cart at the branch coordinates', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, slots: [{ start: 's', end: 'e', available: true, minOrderCost: 199 }] })
      .mockResolvedValueOnce({ success: true, shoppingCartId: 'new' });
    await createCart('u', address, {
      deliveryType: 'SelfPickup', branchId: 'near', label: 'Самовивіз',
      branch: { city: 'Тернопіль', address: 'вул. near', latitude: 49.556, longitude: 25.6 },
    });
    expect(vi.mocked(callTool).mock.calls[1][2]).toEqual({
      addressType: 'self-pickup', latitude: 49.556, longitude: 25.6, city: 'Тернопіль', street: 'вул. near',
      deliveryType: 'SelfPickup', timeslot: { start: 's', end: 'e' }, branchId: 'near',
    });
  });
});
