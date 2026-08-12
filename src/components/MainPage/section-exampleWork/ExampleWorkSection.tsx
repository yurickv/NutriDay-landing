'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RefreshCw,
} from 'lucide-react';
import Title from '../../Title';
import Image from 'next/image';

const ExampleWorkSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Приклади робіт з демонстраційними зображеннями
  const workExamples = [
    {
      id: 1,
      title: 'Введіть свої дані',
      description:
        'Введіть свої дані (вага, вік, стать) на сторінці онбордингу або змініть їх в пізніше в кабінеті. Також бажану ціль: схуднення, підтримка чи набір ваги',
      image: '/example-1.avif',
    },
    {
      id: 2,
      title: 'Створити меню',
      description:
        'Після команди сервіс сформує денний раціон, враховуючи Ваші уподобання по продуктах і стравах',
      image: '/example-3.avif',
    },
    {
      id: 3,
      title: 'Баланс БЖВ',
      description:
        'Система автоматично переводить з’їдені страви в БЖВ і слідкує за денним балансом: сервіс показує прогрес калорій, білків, жирів та вуглеводів відносно Вашої цілі.',
      image: '/example-7.avif',
    },
    {
      id: 4,
      title: 'Додати/забрати продукти',
      description:
        'Приготувати певну страву? Додайте її до списку улюблених! Чи виключіть певні продукти/страви і це врахується при складанні меню.',
      image: '/example-4.avif',
    },
    {
      id: 5,
      title: 'Список покупок',
      description:
        'Отримайте зручний список покупок на тиждень чи 3-4 дні, відмічайте куплені одиниці.',
      image: '/example-6.avif',
    },
    {
      id: 6,
      title: 'Заміна страви',
      description: (
        <>
          Натисніть на іконку{' '}
          <span className="inline-flex w-7 h-7 rounded-full border border-sage-light bg-card items-center justify-center align-middle mx-1">
            <RefreshCw size={13} className="text-ink/50" />
          </span>{' '}
          в рядку страви і сервіс запропонує альтернативні.
        </>
      ),
      image: '/example-5.avif',
    },
    {
      id: 7,
      title: 'Ввести свою страву',
      description:
        'Внесіть назву страви і вагу порції - сервіс підкаже її калорійність і макронутрієнти, які можна редагувати.',
      image: '/example-2.avif',
    },
  ];

  // Автопрокрутка слайдів
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % workExamples.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, workExamples.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % workExamples.length);
  };

  const prevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + workExamples.length) % workExamples.length,
    );
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying((prev) => !prev);
  };

  return (
    <section className="py-8 xl:py-12 bg-cream">
      <div className="container mx-auto px-4">
        {/* Заголовок секції */}
        <div className="text-center mb-6 md:mb-16">
          <Title text="Як це працює?" />
          <p className="text-xl max-w-3xl mx-auto text-ink/60">
            Скріншоти роботи сервісу
          </p>
        </div>

        {/* Слайдер */}
        <div className="relative max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl shadow-soft bg-card border border-sage-light/60">
            {/* Контейнер слайдів */}
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {workExamples.map((work) => (
                <div key={work.id} className="w-full flex-shrink-0">
                  <div className="grid md:grid-cols-2 gap-8 p-0 md:p-6">
                    {/* Зображення */}
                    <div className="relative w-full h-[480px] md:h-auto md:rounded-xl overflow-hidden md:p-0">
                      <div className="relative w-full h-[480px] md:h-[560px]">
                        <Image
                          src={work.image}
                          alt={work.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1152px) 50vw, 576px"
                          className="object-contain md:rounded-xl"
                          priority
                        />
                      </div>
                    </div>

                    {/* Контент */}
                    <div className="flex flex-col justify-center px-4 md:px-0">
                      <h3 className="text-3xl font-bold font-heading text-ink mb-4 text-center md:text-left">
                        {work.title}
                      </h3>
                      <p className="text-ink/60 text-lg leading-relaxed max-w-[400px] text-center md:text-left mx-auto md:mx-0">
                        {work.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Кнопки навігації */}
            <div className="flex justify-between px-4 mt-4">
              <button
                onClick={prevSlide}
                className="absolute left-2 md:left-4 top-[240px] md:top-1/2 -translate-y-1/2 bg-card/90 md:bg-card disabled:bg-cream
                border border-sage-light text-ink/70 p-1.5 md:p-3 rounded-full hover:bg-cream shadow-soft transition-all duration-300 group"
                aria-label="Попередній слайд"
                disabled={currentSlide === 0} // Опціонально: вимкнути якщо на першому слайді
              >
                <ChevronLeft className="w-4 h-4 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
              </button>

              <button
                onClick={nextSlide}
                className="absolute right-2 md:right-4 top-[240px] md:top-1/2 -translate-y-1/2 bg-card/90 md:bg-card disabled:bg-cream
                border border-sage-light text-ink/70 p-1.5 md:p-3 rounded-full hover:bg-cream shadow-soft transition-all duration-300 group"
                aria-label="Наступний слайд"
                disabled={currentSlide === workExamples.length - 1} // Опціонально: вимкнути якщо на останньому слайді
              >
                <ChevronRight className="w-4 h-4 md:w-6 md:h-6 group-hover:scale-110 transition-transform group-disabled:scale-100" />
              </button>
            </div>
          </div>

          {/* Індикатори слайдів */}
          <div className="flex justify-center items-center gap-6 mt-8">
            {workExamples.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-4 h-4 p-2 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'bg-terracotta scale-125'
                    : 'bg-sage-light hover:bg-sage/60'
                }`}
                aria-label={`Перейти до слайду ${index + 1} з ${
                  workExamples.length
                }`}
                aria-current={index === currentSlide ? 'true' : 'false'}
              />
            ))}

            {/* Кнопка автопрокрутки */}
            <button
              onClick={toggleAutoPlay}
              className="bg-card border border-sage-light text-ink/70 p-2 rounded-full hover:bg-cream shadow-soft transition-all duration-300"
              title={
                isAutoPlaying
                  ? 'Зупинити автопрокрутку'
                  : 'Запустити автопрокрутку'
              }
            >
              {isAutoPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto">
          {[
            { number: '2500+', label: 'Згенерованих меню' },
            { number: '150+', label: 'Задоволених клієнтів' },
            { number: '24/7', label: 'Підтримка' },
            {
              number: '10+',
              label: 'Роки досвіду у сфері фітнесу і нутриціології',
            },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl md:text-4xl font-bold font-heading text-sage-dark mb-2">
                {stat.number}
              </div>
              <div className="text-lg text-ink/70">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-[74px] md:h-[124px] lg:h-[149px] w-full relative overflow-hidden bg-sage -mb-8 xl:-mb-12">
        <div className="absolute bottom-0 left-0 w-0 h-0 border-l-[50vw] border-r-[50vw] border-t-[75px] md:border-t-[125px] lg:border-t-[150px] border-l-transparent border-r-transparent border-t-cream"></div>
      </div>
    </section>
  );
};

export default ExampleWorkSection;
