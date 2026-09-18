'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Minus, Plus, RefreshCw } from 'lucide-react';
import { BottomSheet } from '@/components/common/BottomSheet';
import { quantityStep } from '@/lib/silpo/quantity';
import type { SilpoAddResult, SilpoMatch, SilpoProduct, SilpoUnmatched } from '@/lib/silpo/types';
import type { DeliveryOption, ResolvedAddress } from '@/lib/silpo/setupCart';
import { track } from '@/lib/analytics';

export interface OrderItem { itemId: string; name: string; quantity: number; unit: string }

/** What was pushed to the Silpo cart, per shopping-list item (mirrors the server-side tag). */
export interface AddedProduct { itemId: string; productId: string; productName: string; quantity: number }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: OrderItem[];
  onAdded: (added: AddedProduct[]) => void;
}

interface PreviewContext { city: string | null; deliveryType: string; minOrderCost: number | null }

type Step =
  | { kind: 'loading' }
  | { kind: 'address'; options: DeliveryOption[] | null; address: ResolvedAddress | null; error: string | null }
  | { kind: 'preview'; matches: SilpoMatch[]; unmatched: SilpoUnmatched[]; llmUsed: boolean; context: PreviewContext }
  | { kind: 'adding' }
  | { kind: 'done'; result: SilpoAddResult }
  | { kind: 'error'; message: string; reconnect?: boolean };

const ERROR_TEXT: Record<string, string> = {
  'rate-limit': 'Сільпо тимчасово перевантажене, спробуйте за хвилину',
  'no-slots': 'Магазин зараз не приймає замовлення, спробуйте пізніше',
  'no-delivery': 'За цією адресою Сільпо не доставляє і немає магазину поруч',
  'address-not-found': 'Адресу не знайдено, уточніть місто та вулицю',
  reconnect: 'Сесія Сільпо закінчилась, підключіть акаунт знову',
  'not-connected': 'Сільпо не підключено',
  'stale-list': 'Список покупок оновився, перезавантажте сторінку',
  'silpo-error': 'Сільпо не відповідає, спробуйте ще раз',
};

function errorText(code: string | undefined): string {
  return ERROR_TEXT[code ?? ''] ?? ERROR_TEXT['silpo-error'];
}

function fmt(n: number): string {
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

function fmtQty(product: Pick<SilpoProduct, 'weighted'>, qty: number): string {
  return product.weighted ? `${fmt(qty)} кг` : `${qty} уп.`;
}

function validationText(v: { message: string; context: unknown }): string | null {
  const ctx = (v.context ?? {}) as Record<string, unknown>;
  if (v.message === 'product.offer.stock.max') {
    return `Частину товарів обмежено залишком (доступно ${String(ctx.stock ?? '?')})`;
  }
  if (v.message.startsWith('timeslot')) return 'Оберіть час доставки при оформленні';
  if (v.message === 'order.cost.min') {
    return `Сума менша за мінімальне замовлення${ctx.orderCostMin != null ? ` (${String(ctx.orderCostMin)} ₴)` : ''}`;
  }
  return null;
}

const INPUT_CLASS =
  'flex-1 text-sm px-3 py-2.5 rounded-xl bg-card dark:bg-night-card border border-ink/10 dark:border-night-ink/10 text-ink dark:text-night-ink placeholder:text-ink/40 dark:placeholder:text-night-muted focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage-light/50';
const PRIMARY_BTN =
  'w-full py-3 bg-terracotta hover:bg-terracotta-dark text-card font-semibold rounded-2xl text-sm shadow-soft disabled:opacity-50 active:scale-95 transition-all';
const STEPPER_BTN =
  'w-7 h-7 rounded-full bg-card dark:bg-night-card shadow-soft flex items-center justify-center text-ink dark:text-night-ink';

function Spinner({ text }: { text: string }) {
  return (
    <div className="py-12 text-center space-y-3">
      <div className="text-4xl animate-spin inline-block">🌀</div>
      <p className="text-sm text-ink/60 dark:text-night-muted">{text}</p>
    </div>
  );
}

export function SilpoOrderSheet({ isOpen, onClose, items, onAdded }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<Record<string, SilpoProduct>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [altOpen, setAltOpen] = useState<string | null>(null);
  const [addressText, setAddressText] = useState('');
  const [pickedOption, setPickedOption] = useState<DeliveryOption | null>(null);
  const [busy, setBusy] = useState(false);

  // The parent rebuilds `items` on every render (toasts, toggles), so the match
  // must not depend on the array identity: read the latest items through a ref
  // and only (re)run when the sheet transitions from closed to open.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const runMatch = useCallback(async () => {
    const items = itemsRef.current;
    setStep({ kind: 'loading' });
    track('silpo_match_requested', { items: items.length });
    try {
      const res = await fetch('/api/silpo/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })) }),
      });
      const data = (await res.json()) as { error?: string } & Extract<Step, { kind: 'preview' }>;
      if (res.status === 409 && data.error === 'no-cart') {
        setStep({ kind: 'address', options: null, address: null, error: null });
        return;
      }
      if (!res.ok) {
        setStep({ kind: 'error', message: errorText(data.error), reconnect: data.error === 'reconnect' });
        return;
      }
      track('silpo_match_result', { matched: data.matches.length, unmatched: data.unmatched.length });
      setSelected(new Set(data.matches.map((m) => m.itemId)));
      setChosen(Object.fromEntries(data.matches.map((m) => [m.itemId, m.product])));
      setQty(Object.fromEntries(data.matches.map((m) => [m.itemId, m.quantity])));
      setAltOpen(null);
      setStep({ kind: 'preview', matches: data.matches, unmatched: data.unmatched, llmUsed: data.llmUsed, context: data.context });
    } catch {
      setStep({ kind: 'error', message: ERROR_TEXT['silpo-error'] });
    }
  }, []);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) void runMatch();
    wasOpen.current = isOpen;
  }, [isOpen, runMatch]);

  const lookupOptions = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/silpo/cart/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addressText }),
      });
      const data = (await res.json()) as { error?: string; address?: ResolvedAddress; options?: DeliveryOption[] };
      if (!res.ok || !data.options) {
        setStep({ kind: 'address', options: null, address: null, error: errorText(data.error) });
        return;
      }
      setPickedOption(data.options[0]);
      setStep({ kind: 'address', options: data.options, address: data.address ?? null, error: null });
    } catch {
      setStep({ kind: 'address', options: null, address: null, error: ERROR_TEXT['silpo-error'] });
    } finally {
      setBusy(false);
    }
  };

  const createCartAndMatch = async () => {
    if (step.kind !== 'address' || !step.address || !pickedOption) return;
    setBusy(true);
    try {
      const res = await fetch('/api/silpo/cart/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: step.address, option: pickedOption }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStep({ ...step, error: errorText(data.error) });
        return;
      }
      await runMatch();
    } catch {
      setStep({ ...step, error: ERROR_TEXT['silpo-error'] });
    } finally {
      setBusy(false);
    }
  };

  const preview = step.kind === 'preview' ? step : null;

  const total = useMemo(() => {
    if (!preview) return 0;
    return preview.matches.reduce((s, m) => {
      if (!selected.has(m.itemId)) return s;
      const p = chosen[m.itemId] ?? m.product;
      return s + (qty[m.itemId] ?? m.quantity) * p.price;
    }, 0);
  }, [preview, selected, chosen, qty]);

  const toggleSelected = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const changeQty = (m: SilpoMatch, dir: 1 | -1) => {
    const p = chosen[m.itemId] ?? m.product;
    const stepSize = quantityStep(p);
    setQty((prev) => {
      const cur = prev[m.itemId] ?? m.quantity;
      const next = Math.round((cur + dir * stepSize) * 1000) / 1000;
      const capped = p.stock > 0 ? Math.min(next, p.stock) : next;
      return { ...prev, [m.itemId]: Math.max(stepSize, capped) };
    });
  };

  const pickAlternative = (m: SilpoMatch, alt: SilpoProduct) => {
    setChosen((prev) => ({ ...prev, [m.itemId]: alt }));
    // Restart quantity from one unit of the new product (kg step or 1 pack).
    setQty((prev) => ({ ...prev, [m.itemId]: quantityStep(alt) }));
    setAltOpen(null);
  };

  const addToCart = async () => {
    if (!preview) return;
    const products = preview.matches
      .filter((m) => selected.has(m.itemId))
      .map((m) => {
        const p = chosen[m.itemId] ?? m.product;
        return {
          itemId: m.itemId,
          productId: p.id,
          productName: p.name,
          companyId: p.companyId,
          branchId: p.branchId,
          quantity: qty[m.itemId] ?? m.quantity,
        };
      });
    if (products.length === 0) return;
    setStep({ kind: 'adding' });
    try {
      const res = await fetch('/api/silpo/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      const data = (await res.json()) as SilpoAddResult & { error?: string };
      if (!res.ok) {
        setStep({ kind: 'error', message: errorText(data.error), reconnect: data.error === 'reconnect' });
        return;
      }
      track('silpo_cart_added', { products: products.length, total: Math.round(data.totalAfterDiscounts) });
      setStep({ kind: 'done', result: data });
      onAdded(products.map(({ itemId, productId, productName, quantity }) => ({ itemId, productId, productName, quantity })));
    } catch {
      setStep({ kind: 'error', message: ERROR_TEXT['silpo-error'] });
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Замовити в Сільпо">
      <div className="px-5 pb-6">
        {step.kind === 'loading' && <Spinner text="Підбираємо товари у вашому Сільпо…" />}
        {step.kind === 'adding' && <Spinner text="Додаємо в кошик…" />}

        {step.kind === 'address' && (
          <div className="py-4 space-y-3">
            <p className="text-sm text-ink/70 dark:text-night-muted">
              У вашому Сільпо ще немає кошика. Вкажіть адресу, щоб ми обрали магазин у вашому місті.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="Місто, вулиця, будинок"
                className={INPUT_CLASS}
              />
              <button
                onClick={() => void lookupOptions()}
                disabled={busy || addressText.trim().length < 3}
                className="px-4 py-2.5 bg-sage hover:bg-sage-dark text-card font-semibold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-all"
              >
                {busy && !step.options ? '…' : 'Знайти'}
              </button>
            </div>
            {step.error && <p className="text-xs text-danger dark:text-danger-dark">{step.error}</p>}
            {step.options && (
              <div className="space-y-2">
                {step.options.map((o) => (
                  <label
                    key={o.deliveryType}
                    className="flex items-center gap-3 rounded-2xl border border-ink/10 dark:border-night-ink/10 px-4 py-3 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="silpo-delivery"
                      checked={pickedOption?.deliveryType === o.deliveryType}
                      onChange={() => setPickedOption(o)}
                      className="accent-sage"
                    />
                    <span className="text-ink dark:text-night-ink">{o.label}</span>
                  </label>
                ))}
                <button onClick={() => void createCartAndMatch()} disabled={busy || !pickedOption} className={PRIMARY_BTN}>
                  {busy ? 'Створюємо кошик…' : 'Продовжити'}
                </button>
              </div>
            )}
          </div>
        )}

        {preview && (
          <div className="py-3">
            <p className="text-xs text-ink/50 dark:text-night-muted mb-3">
              {preview.context.deliveryType === 'SelfPickup' ? 'Самовивіз' : 'Доставка'}
              {preview.context.city ? ` · ${preview.context.city}` : ''}
              {!preview.llmUsed ? ' · підбір спрощений' : ''}
            </p>

            <ul className="space-y-2">
              {preview.matches.map((m) => {
                const p = chosen[m.itemId] ?? m.product;
                const q = qty[m.itemId] ?? m.quantity;
                const isSel = selected.has(m.itemId);
                const alts = [m.product, ...m.alternatives].filter((a) => a.id !== p.id);
                return (
                  <li
                    key={m.itemId}
                    className={`rounded-2xl border p-3 transition-colors ${
                      isSel ? 'border-sage/50 bg-sage-light/20 dark:bg-sage/10' : 'border-ink/10 dark:border-night-ink/10 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSelected(m.itemId)}
                        className="mt-1 accent-sage w-4 h-4"
                        aria-label={`Включити ${p.name}`}
                      />
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-cream flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-cream dark:bg-night flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink dark:text-night-ink leading-snug">{p.name}</p>
                        <p className="text-xs text-ink/50 dark:text-night-muted">
                          {p.displayRatio ?? ''} · {fmt(p.price)} ₴{p.weighted ? '/кг' : ''} · для: {m.itemName} {fmt(m.itemQuantity)} {m.itemUnit}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => changeQty(m, -1)} className={STEPPER_BTN} aria-label="Менше">
                              <Minus size={14} />
                            </button>
                            <span className="text-sm font-semibold min-w-[3.5rem] text-center text-ink dark:text-night-ink">
                              {m.approximate ? '≈ ' : ''}{fmtQty(p, q)}
                            </span>
                            <button onClick={() => changeQty(m, 1)} className={STEPPER_BTN} aria-label="Більше">
                              <Plus size={14} />
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-ink dark:text-night-ink">{fmt(q * p.price)} ₴</span>
                        </div>
                        {alts.length > 0 && (
                          <button
                            onClick={() => setAltOpen(altOpen === m.itemId ? null : m.itemId)}
                            className="mt-1.5 flex items-center gap-1 text-xs text-terracotta font-semibold"
                          >
                            <RefreshCw size={12} /> Замінити
                          </button>
                        )}
                        {altOpen === m.itemId && (
                          <ul className="mt-2 space-y-1">
                            {alts.map((a) => (
                              <li key={a.id}>
                                <button
                                  onClick={() => pickAlternative(m, a)}
                                  className="w-full text-left text-xs px-3 py-2 rounded-xl bg-card dark:bg-night-card border border-ink/10 dark:border-night-ink/10 text-ink dark:text-night-ink"
                                >
                                  {a.name}{' '}
                                  <span className="text-ink/50 dark:text-night-muted">· {a.displayRatio ?? ''} · {fmt(a.price)} ₴</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {preview.unmatched.length > 0 && (
              <div className="mt-4 rounded-2xl bg-cream dark:bg-night p-3">
                <p className="text-xs font-semibold text-ink/60 dark:text-night-muted mb-1">Не знайшли в Сільпо</p>
                <p className="text-xs text-ink/60 dark:text-night-muted">{preview.unmatched.map((u) => u.name).join(', ')}</p>
              </div>
            )}

            <div className="mt-4 border-t border-ink/10 dark:border-night-ink/10 pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-ink/70 dark:text-night-muted">Разом</span>
                <span className="font-heading font-bold text-lg text-ink dark:text-night-ink">≈ {fmt(total)} ₴</span>
              </div>
              {preview.context.minOrderCost != null && total < preview.context.minOrderCost && (
                <p className="text-xs text-terracotta-dark dark:text-terracotta-light flex items-center gap-1 mb-2">
                  <AlertTriangle size={12} /> Мінімальне замовлення {fmt(preview.context.minOrderCost)} ₴
                </p>
              )}
              <button onClick={() => void addToCart()} disabled={selected.size === 0} className={`${PRIMARY_BTN} py-3.5`}>
                Додати в кошик Сільпо ({selected.size})
              </button>
            </div>
          </div>
        )}

        {step.kind === 'done' && (
          <div className="py-6 text-center space-y-4">
            <div className="text-5xl">🛒</div>
            <div>
              <p className="font-heading font-semibold text-lg text-ink dark:text-night-ink">Товари в кошику Сільпо</p>
              <p className="text-sm text-ink/60 dark:text-night-muted mt-1">До оплати ≈ {fmt(step.result.totalAfterDiscounts)} ₴</p>
            </div>
            {step.result.minOrderCost != null && step.result.totalAfterDiscounts < step.result.minOrderCost && (
              <p className="text-xs text-terracotta-dark dark:text-terracotta-light">
                Мінімальне замовлення {fmt(step.result.minOrderCost)} ₴, додайте ще товарів у застосунку Сільпо.
              </p>
            )}
            {step.result.validations
              .filter((v) => v.level === 'error' || v.level === 'warning')
              .map((v, i) => {
                const text = validationText(v);
                return text ? <p key={i} className="text-xs text-ink/60 dark:text-night-muted">{text}</p> : null;
              })}
            <div className="flex flex-col gap-2 pt-2">
              {step.result.checkoutWebLink && (
                <a
                  href={step.result.checkoutWebLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${PRIMARY_BTN} flex items-center justify-center gap-2`}
                >
                  Оформити на сайті <ExternalLink size={14} />
                </a>
              )}
              {step.result.checkoutMobileLink && (
                <a
                  href={step.result.checkoutMobileLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 border-2 border-ink/15 dark:border-night-ink/15 text-ink dark:text-night-ink font-semibold rounded-2xl text-sm flex items-center justify-center gap-2"
                >
                  Оформити в застосунку <ExternalLink size={14} />
                </a>
              )}
              {!step.result.checkoutWebLink && !step.result.checkoutMobileLink && (
                <>
                  <a
                    href="https://silpo.ua"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${PRIMARY_BTN} flex items-center justify-center gap-2`}
                  >
                    Відкрити Сільпо <ExternalLink size={14} />
                  </a>
                  <p className="text-xs text-ink/50 dark:text-night-muted">
                    Товари вже у вашому кошику Сільпо. Завершіть замовлення на сайті або в застосунку.
                  </p>
                </>
              )}
              <button onClick={onClose} className="text-sm text-ink/50 dark:text-night-muted py-2">
                Закрити
              </button>
            </div>
          </div>
        )}

        {step.kind === 'error' && (
          <div className="py-10 text-center space-y-4">
            <span className="text-5xl">😔</span>
            <p className="text-sm text-ink/70 dark:text-night-muted">{step.message}</p>
            {step.reconnect ? (
              <a
                href={`/api/silpo/connect?returnTo=${encodeURIComponent('/shopping-list')}`}
                className="inline-block px-6 py-3 bg-terracotta text-card font-semibold rounded-2xl text-sm shadow-soft"
              >
                Підключити Сільпо знову
              </a>
            ) : (
              <button onClick={() => void runMatch()} className="inline-flex items-center gap-2 text-sm text-terracotta font-semibold">
                <RefreshCw size={16} /> Спробувати знову
              </button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
