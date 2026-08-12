import Image from "next/image";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className='relative w-full flex items-center justify-center text-card overflow-hidden h-[700px] md:h-[720px]'>
      <Image
        src='/hero-image.avif'
        alt='Sytno background'
        fill
        sizes='100vw'
        style={{ objectFit: "cover" }}
        priority
        className='absolute z-0'
      />
      <div className='relative z-10 w-full h-full px-6 bg-ink/45 py-10'>
        <div className='max-w-[780px] lg:max-w-[950px] h-[548px] md:h-[720px] text-start mx-auto flex flex-col justify-center'>
          <h1 className='text-4xl md:text-5xl xl:text-[64px] font-bold mb-6 leading-tight font-heading'>
            Легкий старт для здорового харчування та схуднення
          </h1>
          <p className='text-lg md:text-2xl mb-8'>
            Почніть харчуватися збалансовано без складних підрахунків і стресу.
            Sytno допоможе скласти просте та різноманітне меню для вашого
            комфорту й результату.
          </p>
          <Link href='/onboarding'>
            <button className='bg-terracotta hover:bg-terracotta-dark text-card text-lg md:text-2xl font-semibold py-3 px-8 rounded-full shadow-soft transition-colors duration-300'>
              Спробувати зараз
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
