import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SilpoToolError } from './types';

vi.mock('./client', () => ({ callTool: vi.fn() }));
import { callTool } from './client';
import { chooseTimeslot, resolveCartContext, searchDeliveryType } from './cartContext';

const slot = (h: number, available = true) => ({
  start: `2026-09-18T${String(h).padStart(2, '0')}:00:00+00:00`,
  end: `2026-09-18T${String(h).padStart(2, '0')}:30:00+00:00`,
  available,
  minOrderCost: 199,
});

describe('chooseTimeslot', () => {
  it('keeps the current slot when it is still available', () => {
    const r = chooseTimeslot(slot(11), [slot(10), slot(11)]);
    expect(r).toEqual({ slot: slot(11), changed: false });
  });
  it('picks the first available slot otherwise', () => {
    expect(chooseTimeslot(slot(5), [slot(10), slot(11)])).toEqual({ slot: slot(10), changed: true });
    expect(chooseTimeslot(null, [slot(10)])).toEqual({ slot: slot(10), changed: true });
  });
  it('throws no-slots when nothing is available', () => {
    expect(() => chooseTimeslot(null, [])).toThrow(SilpoToolError);
    expect(() => chooseTimeslot(null, [])).toThrow('no-slots');
  });
});

describe('searchDeliveryType', () => {
  it('maps express to DeliveryHome', () => {
    expect(searchDeliveryType('DeliveryExpressByPromise')).toBe('DeliveryHome');
    expect(searchDeliveryType('SelfPickup')).toBe('SelfPickup');
  });
});

describe('resolveCartContext', () => {
  const cart = {
    id: 'cart-1',
    deliveryType: 'SelfPickup',
    timeslot: slot(5),
    address: { addressType: 'self-pickup', city: 'Тернопіль', street: 'вул. Петлюри, 2Б', latitude: '1', longitude: '2' },
    shipments: [{ id: 's', companyId: 'comp', branchId: 'br', products: [] }],
    calculation: { totalAfterDiscounts: 0, validations: [] },
  };
  beforeEach(() => vi.mocked(callTool).mockReset());

  it('returns no-cart when the user has none', async () => {
    vi.mocked(callTool).mockResolvedValueOnce({ success: true, exists: false, shoppingCartId: null });
    await expect(resolveCartContext('u')).resolves.toEqual({ kind: 'no-cart' });
  });

  it('updates a stale timeslot and returns the context', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, exists: true, shoppingCartId: 'cart-1' })
      .mockResolvedValueOnce({ success: true, cart })
      .mockResolvedValueOnce({ success: true, slots: [slot(4, false), slot(10), slot(11)] })
      .mockResolvedValueOnce({ success: true });

    const res = await resolveCartContext('u');

    expect(res.kind).toBe('ready');
    if (res.kind !== 'ready') return;
    expect(res.ctx).toMatchObject({
      cartId: 'cart-1', branchId: 'br', companyId: 'comp', deliveryType: 'SelfPickup',
      timeslot: { start: slot(10).start, end: slot(10).end }, minOrderCost: 199,
      address: { city: 'Тернопіль', street: 'вул. Петлюри, 2Б' },
    });
    const update = vi.mocked(callTool).mock.calls[3];
    expect(update[1]).toBe('silpo_update_shopping_cart');
    expect(update[2]).toMatchObject({
      shoppingCartId: 'cart-1', deliveryType: 'SelfPickup',
      timeslot: { start: slot(10).start, end: slot(10).end },
      shipments: [{ companyId: 'comp', branchId: 'br' }],
    });
  });

  it('does not touch the cart when its slot is still valid', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, exists: true, shoppingCartId: 'cart-1' })
      .mockResolvedValueOnce({ success: true, cart: { ...cart, timeslot: slot(10) } })
      .mockResolvedValueOnce({ success: true, slots: [slot(10)] });
    await resolveCartContext('u');
    expect(vi.mocked(callTool)).toHaveBeenCalledTimes(3);
  });
});
