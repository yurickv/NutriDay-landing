import { callTool } from './client';
import { CartContextResult, SilpoTimeslot, SilpoToolError, SilpoValidation } from './types';

export interface Slot extends SilpoTimeslot {
  available: boolean;
  minOrderCost: number | null;
}

export interface RawCart {
  id: string;
  deliveryType: string;
  timeslot: SilpoTimeslot | null;
  address: Record<string, unknown> & { city?: string | null; street?: string | null };
  shipments: Array<{ id?: string; companyId: string; branchId: string; products?: unknown[] }>;
  calculation?: { totalAfterDiscounts?: number; validations?: SilpoValidation[] };
  checkoutWebLink?: string | null;
  checkoutMobileLink?: string | null;
}

interface MyCartResponse { success: boolean; exists: boolean; shoppingCartId: string | null }
interface CartResponse { success: boolean; cart: RawCart }
interface SlotsResponse { success: boolean; slots?: Slot[] }

/** Express carts search/browse as regular home delivery (per Silpo tool docs). */
export function searchDeliveryType(cartDeliveryType: string): string {
  return cartDeliveryType === 'DeliveryExpressByPromise' ? 'DeliveryHome' : cartDeliveryType;
}

export async function getCartRaw(userEmail: string, cartId: string): Promise<RawCart> {
  const res = await callTool<CartResponse>(userEmail, 'silpo_get_shopping_cart_by_id', { shoppingCartId: cartId });
  return res.cart;
}

export async function fetchAvailableSlots(userEmail: string, branchId: string, deliveryType: string): Promise<Slot[]> {
  const res = await callTool<SlotsResponse>(userEmail, 'silpo_get_time_slots', {
    branchId,
    deliveryTypes: [deliveryType],
    start: new Date().toISOString(),
    limit: 40,
  });
  return (res.slots ?? []).filter((s) => s.available);
}

/** Keep the cart's slot if it's still offered; otherwise the earliest available one. */
export function chooseTimeslot(current: SilpoTimeslot | null, slots: Slot[]): { slot: Slot; changed: boolean } {
  const available = slots.filter((s) => s.available);
  if (available.length === 0) throw new SilpoToolError('no-slots');
  const same = current && available.find((s) => s.start === current.start && s.end === current.end);
  if (same) return { slot: same, changed: false };
  return { slot: available[0], changed: true };
}

export async function resolveCartContext(userEmail: string): Promise<CartContextResult> {
  const mine = await callTool<MyCartResponse>(userEmail, 'silpo_get_my_shopping_cart');
  if (!mine.exists || !mine.shoppingCartId) return { kind: 'no-cart' };

  const cart = await getCartRaw(userEmail, mine.shoppingCartId);
  const shipment = cart.shipments?.[0];
  if (!shipment) return { kind: 'no-cart' };

  const deliveryType = searchDeliveryType(cart.deliveryType);
  const slots = await fetchAvailableSlots(userEmail, shipment.branchId, deliveryType);
  const { slot, changed } = chooseTimeslot(cart.timeslot, slots);

  if (changed) {
    await callTool(userEmail, 'silpo_update_shopping_cart', {
      shoppingCartId: cart.id,
      deliveryType: cart.deliveryType,
      timeslot: { start: slot.start, end: slot.end },
      address: cart.address,
      shipments: cart.shipments.map((s) => ({ companyId: s.companyId, branchId: s.branchId })),
    });
  }

  return {
    kind: 'ready',
    ctx: {
      cartId: cart.id,
      branchId: shipment.branchId,
      companyId: shipment.companyId,
      deliveryType,
      timeslot: { start: slot.start, end: slot.end },
      minOrderCost: slot.minOrderCost ?? null,
      address: { city: cart.address?.city ?? null, street: cart.address?.street ?? null },
    },
  };
}

/** Cheap summary for the status endpoint: no slot lookups, no writes. */
export async function getCartSummary(
  userEmail: string,
): Promise<{ city: string | null; street: string | null; deliveryType: string } | null> {
  const mine = await callTool<MyCartResponse>(userEmail, 'silpo_get_my_shopping_cart');
  if (!mine.exists || !mine.shoppingCartId) return null;
  const cart = await getCartRaw(userEmail, mine.shoppingCartId);
  return { city: cart.address?.city ?? null, street: cart.address?.street ?? null, deliveryType: cart.deliveryType };
}
