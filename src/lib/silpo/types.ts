export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface SilpoConnectionDoc {
  userEmail: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  expiresAt: Date;
  scope: string | null;
  status: 'active' | 'expired';
  connectedAt: Date;
  updatedAt: Date;
}

export interface SilpoProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  available: boolean;
  image: string | null;
  weighted: boolean;
  step: number;
  displayRatio: string | null;
  companyId: string;
  branchId: string;
  externalProductId: number;
}

export interface SilpoTimeslot {
  start: string;
  end: string;
}

export interface SilpoCartContext {
  cartId: string;
  branchId: string;
  companyId: string;
  /** Delivery type to use for searches (Express is mapped to DeliveryHome). */
  deliveryType: string;
  timeslot: SilpoTimeslot;
  minOrderCost: number | null;
  address: { city: string | null; street: string | null };
}

export type CartContextResult =
  | { kind: 'ready'; ctx: SilpoCartContext }
  | { kind: 'no-cart' };

export interface SilpoMatch {
  itemId: string;
  itemName: string;
  itemQuantity: number;
  itemUnit: string;
  product: SilpoProduct;
  alternatives: SilpoProduct[];
  /** Packs for piece goods, kilograms for weighted goods. */
  quantity: number;
  approximate: boolean;
  lineTotal: number;
}

export interface SilpoUnmatched {
  itemId: string;
  name: string;
}

export interface SilpoValidation {
  level: string;
  type: string;
  message: string;
  context: unknown;
}

/** Normalised `silpo_get_product_details` payload for the detail view. */
export interface SilpoProductDetails {
  name: string;
  images: string[];
  price: number | null;
  displayRatio: string | null;
  weighted: boolean;
  available: boolean;
  description: string | null;
  /** Flat "label: value" rows (composition, brand, country, storage, nutrition…). */
  attributes: Array<{ label: string; value: string }>;
}

export interface SilpoAddResult {
  totalAfterDiscounts: number;
  minOrderCost: number | null;
  validations: SilpoValidation[];
  checkoutWebLink: string | null;
  checkoutMobileLink: string | null;
}

export class SilpoNotConnectedError extends Error {
  constructor() { super('Silpo is not connected'); this.name = 'SilpoNotConnectedError'; }
}
export class SilpoAuthError extends Error {
  constructor(message = 'Silpo authorization expired') { super(message); this.name = 'SilpoAuthError'; }
}
export class SilpoRateLimitError extends Error {
  constructor() { super('Silpo rate limit'); this.name = 'SilpoRateLimitError'; }
}
export class SilpoToolError extends Error {
  constructor(message: string) { super(message); this.name = 'SilpoToolError'; }
}
