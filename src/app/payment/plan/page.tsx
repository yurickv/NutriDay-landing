// Серверна обгортка /payment/plan: читає httpOnly-куку знижки, щоб таймер і
// ціни були в першому HTML без клієнтського fetch. Читання cookies() робить
// роут динамічним — прийнятно: без походів у БД TTFB мінімальний.
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  DISCOUNT_COOKIE,
  discountUntilFromValue,
  isDiscountActive,
} from '@/lib/discount';
import { PlanPageClient } from '@/components/payment/PlanPageClient';
import { FaqSection } from '@/components/payment/FaqSection';

export default async function PlanPage() {
  const store = await cookies();
  const until = discountUntilFromValue(store.get(DISCOUNT_COOKIE)?.value);

  return (
    <>
      <PlanPageClient
        initialDiscount={{ active: isDiscountActive(until), until }}
        faq={<FaqSection />}
      />

      {/* Міні-футер у стилі лендінгового Footer */}
      <footer className="bg-sage-dark py-6 text-card/60">
        <div className="div-container mx-auto flex flex-col items-center gap-2 text-center text-xs md:flex-row md:justify-between md:text-left">
          <span>© {new Date().getFullYear()} Sytno. Усі права захищені.</span>
          <Link
            href="/oferta"
            className="underline-offset-4 transition-colors hover:text-card hover:underline"
          >
            Публічна оферта (умови, ФОП, повернення)
          </Link>
        </div>
      </footer>
    </>
  );
}
