import Image from "next/image";

const cardInfo = [
  {
    title: "Персоналізовані меню",
    description:
      "Меню під ваші цілі та смаки — отримайте готовий план харчування за хвилину.",
    image: "/adv-card1.avif",
  },
  {
    title: "Миттєва заміна страв",
    description:
      "Легко змінюйте страви в меню — обирайте те, що смакує вам саме сьогодні.",
    image: "/adv-card2.avif",
  },
  {
    title: "Список покупок за секунду",
    description:
      "Автоматично створюємо список продуктів для вашого меню — економте час у магазині.",
    image: "/adv-card3.avif",
  },
];

export default function AdvantagesCard() {
  return (
    <section className='text-white py-12'>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mx-auto'>
        {cardInfo.map((card, index) => (
          <div
            key={index}
            className='relative h-[400px] rounded-xl overflow-hidden shadow-lg group'
          >
            <Image
              src={card.image}
              alt={card.title}
              fill
              sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
              style={{ objectFit: "cover" }}
              className='transform group-hover:scale-105 transition-transform duration-500'
              loading='lazy'
            />
            <div className='absolute bottom-0 w-full bg-black/50 backdrop-blur-sm p-4 z-10'>
              <h3 className='text-2xl font-semibold font-poppins'>
                {card.title}
              </h3>
              <p className='text-lg mt-2'>{card.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
