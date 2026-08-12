import Image from 'next/image';

const cardInfo = [
  {
    title: 'Персоналізовані меню',
    description:
      'Меню під ваші цілі та смаки — отримайте готовий план харчування за хвилину.',
    image: '/adv-card1.avif',
  },
  {
    title: 'Підбір страв на ваш смак',
    description:
      'Додавайте свої улюблені страви та виключіть не бажані — наш сервіс врахує ваші побажання.',
    image: '/adv-card2.avif',
  },
  {
    title: 'Список покупок за секунду',
    description:
      'Автоматично створюємо список продуктів для вашого меню — економте час у магазині.',
    image: '/adv-card3.avif',
  },
];

export default function AdvantagesCard() {
  return (
    <section className="py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mx-auto">
        {cardInfo.map((card, index) => (
          <div
            key={index}
            className="relative h-[400px] rounded-2xl overflow-hidden shadow-soft group"
          >
            <Image
              src={card.image}
              alt={card.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              style={{ objectFit: 'cover' }}
              className="transform group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute bottom-0 w-full bg-ink/55 backdrop-blur-sm p-4 z-10 text-card">
              <h3 className="text-2xl font-bold font-heading">
                {card.title}
              </h3>
              <p className="text-lg mt-2">{card.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
