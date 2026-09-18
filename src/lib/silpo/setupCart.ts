import { callTool } from './client';
import { fetchAvailableSlots } from './cartContext';
import { SilpoToolError } from './types';

export interface ResolvedAddress {
  text: string;
  city: string | null;
  street: string | null;
  houseNumber: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
}

export interface DeliveryOption {
  deliveryType: 'DeliveryHome' | 'SelfPickup';
  branchId: string;
  label: string;
  branch?: { city: string; address: string; latitude: number; longitude: number };
}

interface Branch {
  branchId: string;
  companyId: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  hasPickup: boolean;
  open: boolean;
}
interface FindAddressResponse {
  addresses?: Array<{
    address: string; city: string | null; street: string | null; houseNumber: string | null;
    district: string | null; latitude: number; longitude: number;
  }>;
}
interface DeliveryTypesResponse { options?: Array<{ deliveryType: string; branchId: string | null }> }
interface BranchesResponse { branches?: Branch[] }

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestBranch(branches: Branch[], point: { lat: number; lng: number }): Branch | null {
  let best: Branch | null = null;
  let bestKm = Infinity;
  for (const b of branches) {
    if (!b.open || !b.hasPickup) continue;
    const km = haversineKm(point, { lat: parseFloat(b.latitude), lng: parseFloat(b.longitude) });
    if (km < bestKm) {
      bestKm = km;
      best = b;
    }
  }
  return best;
}

export async function lookupDeliveryOptions(
  userEmail: string,
  addressText: string,
): Promise<{ address: ResolvedAddress; options: DeliveryOption[] }> {
  const geo = await callTool<FindAddressResponse>(userEmail, 'silpo_find_address', { address: addressText });
  const first = geo.addresses?.[0];
  if (!first) throw new SilpoToolError('address-not-found');
  const address: ResolvedAddress = {
    text: addressText,
    city: first.city,
    street: first.street,
    houseNumber: first.houseNumber,
    district: first.district,
    latitude: first.latitude,
    longitude: first.longitude,
  };

  const types = await callTool<DeliveryTypesResponse>(userEmail, 'silpo_get_available_delivery_types', {
    latitude: address.latitude,
    longitude: address.longitude,
  });
  const options: DeliveryOption[] = [];
  const home = types.options?.find((o) => o.deliveryType === 'DeliveryHome' && o.branchId);
  if (home?.branchId) options.push({ deliveryType: 'DeliveryHome', branchId: home.branchId, label: 'Доставка додому' });

  if (types.options?.some((o) => o.deliveryType === 'SelfPickup')) {
    const list = await callTool<BranchesResponse>(userEmail, 'silpo_list_branches', { hasPickup: true, limit: 500 });
    const near = nearestBranch(list.branches ?? [], { lat: address.latitude, lng: address.longitude });
    if (near) {
      options.push({
        deliveryType: 'SelfPickup',
        branchId: near.branchId,
        label: `Самовивіз: ${near.city}, ${near.address}`,
        branch: { city: near.city, address: near.address, latitude: parseFloat(near.latitude), longitude: parseFloat(near.longitude) },
      });
    }
  }
  if (options.length === 0) throw new SilpoToolError('no-delivery');
  return { address, options };
}

function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

export async function createCart(userEmail: string, address: ResolvedAddress, option: DeliveryOption): Promise<void> {
  const slots = await fetchAvailableSlots(userEmail, option.branchId, option.deliveryType);
  if (slots.length === 0) throw new SilpoToolError('no-slots');
  const timeslot = { start: slots[0].start, end: slots[0].end };

  const args = option.deliveryType === 'SelfPickup' && option.branch
    ? compact({
        addressType: 'self-pickup',
        latitude: option.branch.latitude,
        longitude: option.branch.longitude,
        city: option.branch.city,
        street: option.branch.address,
        deliveryType: 'SelfPickup',
        timeslot,
        branchId: option.branchId,
      })
    : compact({
        addressType: 'house',
        latitude: address.latitude,
        longitude: address.longitude,
        city: address.city,
        street: address.street,
        house: address.houseNumber,
        district: address.district,
        deliveryType: option.deliveryType,
        timeslot,
        branchId: option.branchId,
      });

  await callTool(userEmail, 'silpo_create_shopping_cart', args);
}
