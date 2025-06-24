"use client";

import React from "react";
import { Star, Quote } from "lucide-react";
import Link from "next/link";
import Title from "../Title";

const ReviewsSection = () => {
  const reviews = [
    {
      id: 1,
      text: "NutriDay — це економія часу і різноманітність! Я отримую нові ідеї для страв щодня і можу легко змінити меню під настрій.",
      author: "Олена К.",
      rating: 5,
      avatar:
        "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    },
    {
      id: 2,
      text: "Дуже зручно: меню на день за хвилину, список покупок — і все під контролем!",
      author: "Максим Т.",
      rating: 5,
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    },
    {
      id: 3,
      text: "Нарешті не треба рахувати калорії вручну — все вже готово! Худну на автопілоті ",
      author: "Анна М.",
      rating: 4.5,
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    },
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-5 h-5 ${
          index < rating ? "text-yellow-400 fill-current" : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <section className='py-20' style={{ backgroundColor: "#323030" }}>
      <div className='container mx-auto px-4'>
        {/* Заголовок секції */}
        <div className='text-center mb-16 text-white'>
          <Title text=' Що кажуть користувачі' />
          <div className='w-24 h-1 bg-main-button mx-auto my-8 rounded-lg'></div>
        </div>

        {/* Сітка відгуків */}
        <div className='grid md:grid-cols-3 gap-8 max-w-6xl mx-auto'>
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className={`relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 hover:shadow-2xl transition-all duration-300 ${
                index === 1
                  ? "md:transform md:scale-105 md:shadow-2xl"
                  : "hover:transform hover:scale-105"
              }`}
            >
              {/* Іконка лапок */}
              <div className='absolute -top-4 left-8'>
                <div className='bg-main-button-hover rounded-full p-3'>
                  <Quote className='w-6 h-6 text-white' />
                </div>
              </div>

              {/* Рейтинг */}
              <div className='flex justify-center mb-6 mt-4'>
                <div className='flex gap-1'>{renderStars(review.rating)}</div>
              </div>

              {/* Текст відгуку */}
              <p className='text-gray-100 text-lg leading-relaxed mb-8 text-center italic'>
                "{review.text}"
              </p>

              {/* Автор */}
              <div className='flex items-center justify-center gap-4'>
                <img
                  src={review.avatar}
                  alt={review.author}
                  className='w-12 h-12 rounded-full object-cover border-2 border-blue-300'
                />
                <div>
                  <p className='font-semibold text-white'>{review.author}</p>
                  <p className='text-sm text-gray-300'>Користувач NutriDay</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Додаткова статистика */}
        {/* <div className='mt-16 text-center'>
          <div className='inline-flex items-center gap-8 bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-6 border border-white/20'>
            <div className='text-center'>
              <div className='text-3xl font-bold text-white mb-1'>4.9</div>
              <div className='flex justify-center mb-2'>{renderStars(5)}</div>
              <div className='text-sm text-gray-300'>Середня оцінка</div>
            </div>

            <div className='h-12 w-px bg-white/30'></div>

            <div className='text-center'>
              <div className='text-3xl font-bold text-white mb-1'>1000+</div>
              <div className='text-sm text-gray-300'>Щасливих користувачів</div>
            </div>

            <div className='h-12 w-px bg-white/30'></div>

            <div className='text-center'>
              <div className='text-3xl font-bold text-white mb-1'>95%</div>
              <div className='text-sm text-gray-300'>Рекомендують друзям</div>
            </div>
          </div>
        </div> */}

        {/* Заклик до дії */}
        <div className='text-center mt-12'>
          <p className='text-lg text-gray-300 mb-6'>
            Приєднуйтесь до сотень задоволених користувачів
          </p>
          <Link
            href='https://web.telegram.org/k/#@Nutri_day_bot'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-block w-fit mx-auto lg:mx-0'
          >
            <button className='bg-main-button hover:bg-main-button-hover text-black text-lg md:text-xl font-semibold py-3 px-3 rounded-lg transition-colors duration-300'>
              Спробувати безкоштовно
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
