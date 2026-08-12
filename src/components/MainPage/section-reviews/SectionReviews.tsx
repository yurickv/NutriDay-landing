"use client";

import React from "react";
import { Star, Quote } from "lucide-react";
import Link from "next/link";
import Title from "../../Title";
import Image from "next/image";

const ReviewsSection = () => {
  const reviews = [
    {
      id: 1,
      text: "Sytno — це економія часу і різноманітність! Я отримую нові ідеї для страв щодня і можу легко змінити меню під настрій.",
      author: "Олена К.",
      rating: 5,
      avatar: "/lena-review.avif",
    },
    {
      id: 2,
      text: "Дуже зручно: меню на день за хвилину, список покупок — і все під контролем!",
      author: "Інна Т.",
      rating: 5,
      avatar: "/inna-review.avif",
    },
    {
      id: 3,
      text: "Нарешті не треба рахувати калорії вручну — все вже готово! Худну на автопілоті ",
      author: "Анна М.",
      rating: 4.5,
      avatar: "/anna-review.avif",
    },
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-5 h-5 ${
          index < rating ? "text-terracotta fill-current" : "text-ink/20"
        }`}
      />
    ));
  };

  return (
    <section className='py-20 bg-sage'>
      <div className='container mx-auto px-4'>
        {/* Заголовок секції */}
        <div className='text-center mb-16 text-card'>
          <Title text=' Що кажуть користувачі' />
          <div className='w-24 h-1 bg-terracotta-light mx-auto my-8 rounded-lg'></div>
        </div>

        {/* Сітка відгуків */}
        <div className='grid md:grid-cols-3 gap-8 max-w-6xl mx-auto'>
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className={`relative bg-card text-ink rounded-2xl p-8 shadow-soft hover:shadow-xl transition-all duration-300 flex flex-col justify-between ${
                index === 1
                  ? "md:transform md:scale-105 md:shadow-xl"
                  : "hover:transform hover:scale-105"
              }`}
            >
              {/* Верхня частина — лапки, рейтинг, текст */}
              <div>
                {/* Іконка лапок */}
                <div className='absolute -top-4 left-8'>
                  <div className='bg-terracotta rounded-full p-3'>
                    <Quote className='w-6 h-6 text-card' />
                  </div>
                </div>

                {/* Рейтинг */}
                <div className='flex justify-center mb-6 mt-4'>
                  <div className='flex gap-1'>{renderStars(review.rating)}</div>
                </div>

                {/* Текст відгуку */}
                <p className='text-ink/80 text-lg leading-relaxed mb-8 text-center italic'>
                  "{review.text}"
                </p>
              </div>

              {/* Нижня частина — автор */}
              <div className='flex items-center justify-center gap-4 mt-auto pt-4'>
                <div className='relative w-12 h-12'>
                  <Image
                    src={review.avatar}
                    alt={review.author}
                    fill
                    className='rounded-full object-cover border-2 border-sage-light'
                    sizes='48px'
                  />
                </div>
                <div>
                  <p className='font-semibold text-ink'>{review.author}</p>
                  <p className='text-sm text-ink/60'>Користувач Sytno</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Заклик до дії */}
        <div className='text-center mt-12'>
          <p className='text-lg text-card/90 mb-6'>
            Приєднуйтесь до сотень задоволених користувачів
          </p>
          <Link
            href='/onboarding'
            className='inline-block w-fit mx-auto lg:mx-0'
          >
            <button className='bg-terracotta hover:bg-terracotta-dark text-card text-lg md:text-xl font-semibold py-3 px-6 rounded-full shadow-soft transition-colors duration-300'>
              Приєднатися зараз
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
