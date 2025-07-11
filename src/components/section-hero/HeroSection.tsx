import Image from "next/image";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className='relative w-full flex items-center justify-center text-white overflow-hidden h-[700px] md:h-[720px]'>
      <Image
        src='/hero-image.avif'
        alt='NutriDay background'
        fill
        sizes='100vw'
        style={{ objectFit: "cover" }}
        priority
        className='absolute z-0'
      />
      <div className='relative z-10 w-full h-full px-6 bg-black/40 py-10'>
        <div className='max-w-[780px] lg:max-w-[950px] h-[548px] md:h-[720px] text-start mx-auto flex flex-col justify-center'>
          {" "}
          <h1
            className={`text-4xl md:text-5xl xl:text-[68px] font-bold mb-6 leading-tight font-roboto font-poppins`}
          >
            Легкий старт для здорового харчування та схуднення
          </h1>
          <p className='text-lg md:text-2xl mb-8'>
            Почніть харчуватися збалансовано без складних підрахунків і стресу.
            NutriDay допоможе скласти просте та різноманітне меню для вашого
            комфорту й результату.
          </p>
          <Link
            href='https://t.me/Nutri_day_bot'
            target='_blank'
            rel='noopener noreferrer'
          >
            <button className='bg-main-button hover:bg-main-button-hover text-black text-lg md:text-2xl py-3 px-6 rounded-full transition-colors duration-300'>
              Спробувати зараз
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
