import Title from "../Title";
import AdvantagesCard from "./AdvantagesCard";

export default function AdvantagesSection() {
  const cardInfo = [
    {
      title: "Персоналізовані меню",
      description:
        "Меню під ваші цілі та смаки — отримайте готовий план харчування за хвилину.",
    },
    {
      title: "Миттєва заміна страв",
      description:
        "Легко змінюйте страви в меню — обирайте те, що смакує саме вам сьогодні.",
    },
    {
      title: "Список покупок за секунду",
      description:
        "Автоматично створюємо список продуктів для вашого меню — економте час у магазині.",
    },
  ];
  return (
    <section className='text-white'>
      <div className='w-full h-full px-6'>
        <div className='max-w-[780px] lg:max-w-[950px] xl:max-w-[1200px] h-[548px] md:h-[720px] text-start mx-auto flex flex-col justify-center'>
          <Title text='Зробіть здорове харчування простим і швидким' />
          <AdvantagesCard />
        </div>
      </div>
    </section>
  );
}
