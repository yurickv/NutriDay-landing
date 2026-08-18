import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: 'Як цей план може допомогти мені схуднути?',
    answer:
      'Сервіс складає індивідуальне меню під ваші дані та ціль, підтримуючи м’який дефіцит калорій — без голодувань і жорстких обмежень. Ви бачите калорійність і баланс білків, жирів та вуглеводів кожної страви, а система щодня відстежує ваш прогрес відносно цілі. Такий послідовний режим харчування дає стабільний результат у схудненні.',
  },
  {
    question: 'Що робити, якщо я швидко втрачу мотивацію?',
    answer:
      'Ми подбали про легкі нагадування, поради експертів та зручні інструменти відстеження — серії успішних днів, трекери води й ваги. Ви щодня бачите свій прогрес, а коли результат помітний, залишатися послідовними значно легше. Так ви досягнете своїх цілей і насолоджуватиметеся більш підтягнутим, здоровим тілом, не боячись здатися.',
  },
  {
    question: 'Як я отримаю доступ до свого плану?',
    answer:
      'Після здійснення покупки ви отримаєте магічне посилання на вказану електронну пошту. Після переходу по посиланню вас перенесе в особистий кабінет. Все вже налаштовано. Ми будемо супроводжувати та підтримувати вас протягом усього процесу.',
  },
];

// Серверний компонент: акордеон на <details>/<summary> — без клієнтського JS.
export function FaqSection() {
  return (
    <section>
      <h2 className="mb-3 text-center font-heading text-[30px] font-bold md:text-[35px] xl:text-[44px]">
        Люди часто запитують
      </h2>
      <div className="flex flex-col divide-y divide-ink/10 dark:divide-night-ink/10">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} name="faq" className="group">
            <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 py-4 text-left font-heading text-[20px] font-bold transition-colors hover:text-sage-dark md:text-[24px] dark:hover:text-sage-light [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown className="h-6 w-6 flex-shrink-0 text-ink/40 transition-transform group-open:rotate-180 dark:text-night-muted" />
            </summary>
            <p className="pb-4 text-lg leading-relaxed text-ink/70 dark:text-night-ink/70">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
