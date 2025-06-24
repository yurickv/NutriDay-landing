"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import Title from "../Title";

const ExampleWorkSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Приклади робіт з демонстраційними зображеннями
  const workExamples = [
    {
      id: 1,
      title: "Введіть свої дані",
      description:
        "Після команди Start сервіс попросить Вас ввести свої дані: вага, вік, стать. Також бажану ціль: схуднення, підтримка чи набір ваги",
      image:
        "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop",
      category: "Mobile App",
    },
    {
      id: 2,
      title: "Денна потреба в калорійності",
      description:
        "Отримайте розрахунок калорійності денного меню та перевірте свої дані.",
      image:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
      category: "Corporate Website",
    },
    {
      id: 3,
      title: "Створити меню",
      description: "Після команди /menu АІ сервіс сформує ваше меню",
      image:
        "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop",
      category: "Web Application",
    },
    {
      id: 4,
      title: "Приклад готового меню",
      description:
        "Приклад меню з дотриманням калорійності, що дуже важливо при схудненні чи наборі ваги.",
      image:
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop",
      category: "Mobile App",
    },
    {
      id: 5,
      title: "Додати/забрати продукти",
      description:
        "Можна додати або виключити певні продукти чи страви, щоб це врахувалось при складанні меню.",
      image:
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop",
      category: "Mobile App",
    },
    {
      id: 6,
      title: "Допомога",
      description:
        "Натисніть на іконку внизу екрану і зявиться перелік доступних команд.",
      image:
        "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop",
      category: "Web Development",
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
      (prev) => (prev - 1 + workExamples.length) % workExamples.length
    );
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying((prev) => !prev);
  };

  return (
    <section className='py-8 xl:py-12 bg-white'>
      <div className='container mx-auto px-4'>
        {/* Заголовок секції */}
        <div className='text-center mb-16'>
          <Title text='Як це працює?' />
          <p className='text-xl max-w-3xl mx-auto'>Скріншоти роботи сервісу</p>
        </div>

        {/* Слайдер */}
        <div className='relative max-w-6xl mx-auto'>
          <div className='relative overflow-hidden rounded-2xl shadow-lg bg-gray-50 border border-gray-200'>
            {/* Контейнер слайдів */}
            <div
              className='flex transition-transform duration-700 ease-in-out'
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {workExamples.map((work) => (
                <div key={work.id} className='w-full flex-shrink-0'>
                  <div className='grid md:grid-cols-2 gap-8 p-8 md:p-12'>
                    {/* Зображення */}
                    <div className='relative group'>
                      <img
                        src={work.image}
                        alt={work.title}
                        className='w-full h-80 object-cover rounded-xl shadow-md group-hover:shadow-xl transition-shadow duration-300'
                      />
                      {/* <div className='absolute top-4 left-4'>
                        <span className='bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium'>
                          {work.category}
                        </span>
                      </div> */}
                    </div>

                    {/* Контент */}
                    <div className='flex flex-col justify-center'>
                      <h3 className='text-3xl font-bold text-gray-900 mb-4'>
                        {work.title}
                      </h3>
                      <p className='text-gray-600 text-lg leading-relaxed mb-6'>
                        {work.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Кнопки навігації */}
            <button
              onClick={prevSlide}
              className='absolute left-4 top-1/2 -translate-y-1/2 bg-white border border-gray-300 text-gray-700 p-3 rounded-full hover:bg-gray-50 shadow-md transition-all duration-300 group'
            >
              <ChevronLeft className='w-6 h-6 group-hover:scale-110 transition-transform' />
            </button>

            <button
              onClick={nextSlide}
              className='absolute right-4 top-1/2 -translate-y-1/2 bg-white border border-gray-300 text-gray-700 p-3 rounded-full hover:bg-gray-50 shadow-md transition-all duration-300 group'
            >
              <ChevronRight className='w-6 h-6 group-hover:scale-110 transition-transform' />
            </button>
          </div>

          {/* Індикатори слайдів */}
          <div className='flex justify-center items-center gap-6 mt-8'>
            <div className='flex gap-2'>
              {workExamples.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? "bg-main-button scale-125"
                      : "bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>

            {/* Кнопка автопрокрутки */}
            <button
              onClick={toggleAutoPlay}
              className='bg-white border border-gray-300 text-gray-700 p-2 rounded-full hover:bg-gray-50 shadow-md transition-all duration-300'
              title={
                isAutoPlaying
                  ? "Зупинити автопрокрутку"
                  : "Запустити автопрокрутку"
              }
            >
              {isAutoPlaying ? (
                <Pause className='w-4 h-4' />
              ) : (
                <Play className='w-4 h-4' />
              )}
            </button>
          </div>
        </div>

        {/* Статистика */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto'>
          {[
            { number: "2500+", label: "Згенерованих меню" },
            { number: "150+", label: "Задоволених клієнтів" },
            { number: "24/7", label: "Підтримка" },
            {
              number: "10+",
              label: "Роки досвіду у сфері фітнесу і нутриціології",
            },
          ].map((stat, index) => (
            <div key={index} className='text-center'>
              <div className='text-3xl md:text-4xl font-bold mb-2'>
                {stat.number}
              </div>
              <div className='text-sm md:text-base'>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className='h-[75px] md:h-[125px] lg:h-[150px] w-full relative overflow-hidden bg-[#323030] -mb-8 xl:-mb-12'>
        <div className='absolute bottom-0 left-0 w-0 h-0 border-l-[50vw] border-r-[50vw] border-t-[75px] md:border-t-[125px] lg:border-t-[150px] border-l-transparent border-r-transparent border-t-white'></div>
      </div>
    </section>
  );
};

export default ExampleWorkSection;
