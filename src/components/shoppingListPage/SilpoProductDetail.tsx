'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { SilpoProduct, SilpoProductDetails, SilpoTimeslot } from '@/lib/silpo/types';

interface Props {
  product: SilpoProduct;
  /** «для: Куряче філе 480 г» */
  forLabel: string;
  context: { branchId: string; deliveryType: string; timeslot: SilpoTimeslot };
  onBack: () => void;
}

type State = { kind: 'loading' } | { kind: 'ready'; details: SilpoProductDetails } | { kind: 'error' };

function fmt(n: number): string {
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

/**
 * Enlarged photo first (always available from the search result), then the
 * product card details (composition, nutrition…) once /api/silpo/product answers.
 */
export function SilpoProductDetail({ product, forLabel, context, onBack }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [activeImage, setActiveImage] = useState<string | null>(product.image);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      slug: product.slug,
      branchId: context.branchId,
      deliveryType: context.deliveryType,
      timeslotStart: context.timeslot.start,
      timeslotEnd: context.timeslot.end,
    });
    fetch(`/api/silpo/product?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { details: SilpoProductDetails };
        if (cancelled) return;
        setState({ kind: 'ready', details: data.details });
        if (!activeImage && data.details.images[0]) setActiveImage(data.details.images[0]);
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error' }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  const details = state.kind === 'ready' ? state.details : null;
  const gallery = details?.images.length ? details.images : product.image ? [product.image] : [];

  return (
    <div className="py-3">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-terracotta font-semibold mb-3">
        <ArrowLeft size={16} /> До списку
      </button>

      <div className="rounded-2xl bg-cream dark:bg-night overflow-hidden aspect-square flex items-center justify-center">
        {activeImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeImage} alt={product.name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-5xl">🛒</span>
        )}
      </div>

      {gallery.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {gallery.map((src) => (
            <button
              key={src}
              onClick={() => setActiveImage(src)}
              className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 ${activeImage === src ? 'border-sage' : 'border-transparent'}`}
              aria-label="Інше фото"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover bg-cream" />
            </button>
          ))}
        </div>
      )}

      <h3 className="mt-3 font-heading font-semibold text-base text-ink dark:text-night-ink leading-snug">
        {details?.name || product.name}
      </h3>
      <p className="text-sm text-ink/60 dark:text-night-muted mt-0.5">
        {product.displayRatio ?? ''} · {fmt(product.price)} ₴{product.weighted ? '/кг' : ''}
        {product.oldPrice ? (
          <span className="ml-1 line-through text-ink/40 dark:text-night-muted/80">{fmt(product.oldPrice)} ₴</span>
        ) : null}
      </p>
      <p className="text-xs text-ink/50 dark:text-night-muted mt-0.5">для: {forLabel}</p>

      {state.kind === 'loading' && (
        <p className="mt-4 text-xs text-ink/50 dark:text-night-muted">Завантажуємо опис товару…</p>
      )}
      {state.kind === 'error' && (
        <p className="mt-4 text-xs text-ink/50 dark:text-night-muted">Опис товару зараз недоступний.</p>
      )}
      {details && (
        <div className="mt-4 space-y-3">
          {details.description && (
            <p className="text-sm text-ink/80 dark:text-night-ink/80 leading-relaxed whitespace-pre-line">{details.description}</p>
          )}
          {details.attributes.length > 0 && (
            <dl className="rounded-2xl bg-card dark:bg-night-card border border-ink/10 dark:border-night-ink/10 divide-y divide-ink/10 dark:divide-night-ink/10">
              {details.attributes.map((a, i) => (
                <div key={`${a.label}-${i}`} className="px-3 py-2 text-xs flex gap-3">
                  <dt className="w-32 flex-shrink-0 text-ink/50 dark:text-night-muted">{a.label}</dt>
                  <dd className="text-ink dark:text-night-ink break-words">{a.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {!details.description && details.attributes.length === 0 && (
            <p className="text-xs text-ink/50 dark:text-night-muted">Сільпо не надає опису для цього товару.</p>
          )}
          {!details.available && (
            <p className="text-xs text-terracotta-dark dark:text-terracotta-light">Наразі немає в наявності у вашому магазині.</p>
          )}
        </div>
      )}
    </div>
  );
}
