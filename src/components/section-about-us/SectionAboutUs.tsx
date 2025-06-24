import Link from "next/link";
import Image from "next/image";
import Title from "../Title";

export default function AboutUsSection() {
  return (
    <section className='text-white bg-[#323030] py-8 xl:py-12'>
      <div className='w-full h-full px-6 xl:px-10 flex flex-col lg:flex-row gap-6 xl:gap-12 mb-4'>
        <div className='w-full h-64 md:h-80 lg:w-[448px] lg:h-[448px] relative rounded-lg overflow-hidden'>
          <Image
            src='/woman-make-menu.avif'
            alt='Жінка складає меню з NutriDay'
            fill
            sizes='(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 448px'
            style={{ objectFit: "cover" }}
            loading='lazy'
          />
        </div>

        <div className='text-start flex flex-col gap-4 md:gap-6 lg:flex-1 lg:justify-center'>
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
            href='https://t.me/Nutri_day_bot'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-block w-fit mx-auto lg:mx-0'
          >
            <button className='bg-main-button hover:bg-main-button-hover text-black text-lg md:text-xl font-semibold py-3 px-3 rounded-lg transition-colors duration-300'>
              Спробувати зараз
            </button>
          </Link>
        </div>
      </div>
      <div className='h-[75px] md:h-[125px] lg:h-[150px] w-full relative overflow-hidden bg-white -mb-8 xl:-mb-12'>
        <div className='absolute top-0 left-0 w-0 h-0 border-l-[50vw] border-r-[50vw] border-t-[75px] md:border-t-[125px] lg:border-t-[150px] border-l-transparent border-r-transparent border-t-[#323030]'></div>
      </div>
    </section>
  );
}
