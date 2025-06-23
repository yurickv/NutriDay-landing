const cardInfo = [
  {
    title: "Персоналізовані меню",
    description:
      "Меню під ваші цілі та смаки — отримайте готовий план харчування за хвилину.",
    image: "adv-card1.avif",
  },
  {
    title: "Миттєва заміна страв",
    description:
      "Легко змінюйте страви в меню — обирайте те, що смакує саме вам сьогодні.",
    image: "adv-card2.avif",
  },
  {
    title: "Список покупок за секунду",
    description:
      "Автоматично створюємо список продуктів для вашого меню — економте час у магазині.",
    image: "adv-card3.avif",
  },
];

export default function AdvantagesCard() {
  return (
    <section className='text-white px-6 py-12'>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto'>
        {cardInfo.map((card, index) => (
          <div
            key={index}
            className='relative h-[300px] rounded-xl overflow-hidden shadow-lg group'
          >
            <img
              src={card.image}
              alt={card.title}
              className='absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition duration-500'
            />
            <div className='absolute bottom-0 w-full bg-black/50 backdrop-blur-md p-4'>
              <h3 className='text-xl font-semibold'>{card.title}</h3>
              <p className='text-sm mt-2'>{card.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
