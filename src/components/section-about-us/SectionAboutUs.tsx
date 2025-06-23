import Link from "next/link";
import Image from "next/image";
import Title from "../Title";

export default function AboutUsSection() {
  return (
    <section className='text-white bg-[#323030] py-12 xl:py-16'>
      <div className='w-full h-full px-6 xl:px-10 flex flex-col xl:flex-row gap-6 xl:gap-12'>
        <div className='w-full h-64 md:h-80 xl:w-[448px] xl:h-[448px] relative rounded-lg overflow-hidden'>
          <Image
            src='/woman-make-menu.avif'
            alt='Жінка складає меню з NutriDay'
            fill
            sizes='(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 448px'
            style={{ objectFit: "cover" }}
            loading='lazy'
          />
        </div>

        <div className='text-start flex flex-col gap-4 md:gap-6 xl:flex-1 xl:justify-center'>
          <Title text='Здоров’я без зайвих зусиль — разом з NutriDay' />
          <p className='text-base md:text-lg leading-relaxed'>
            Ми створили NutriDay для тих, хто цінує свій час і хоче харчуватися
            різноманітно та корисно без складних розрахунків. Наш Telegram-бот
            допомагає скласти збалансоване меню на день за хвилину, враховуючи
            ваші вподобання, цілі та бюджет. Наша команда експертів з 10+ років
            досвіду у фітнесі гарантує: кожен день ви отримуєте простий, смачний
            і корисний раціон.
          </p>
          <Link
            href='https://web.telegram.org/k/#@Nutri_day_bot'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-block w-fit'
          >
            <button className='bg-main-button hover:bg-main-button-hover text-black text-lg md:text-xl font-semibold py-3 px-3 rounded-lg transition-colors duration-300'>
              Спробувати зараз
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
