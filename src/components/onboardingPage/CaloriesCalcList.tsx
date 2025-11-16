// components/onboardingPage/CaloriesCalcList.tsx
'use client';

import React, { useState } from 'react';
import { InputSkeleton } from './InputSkeleton';
import * as yup from 'yup';
import { useRouter } from 'next/navigation';
import { setOnboardingData } from '@/utils/onboardingHelpers';

const schema = yup.object().shape({
  age: yup.number().positive().min(14, 'Не менше 14').max(130, 'Не більше 130'),
  height: yup
    .number()
    .positive()
    .min(100, 'Не менше 100')
    .max(220, 'Не більше 220'),
  weight: yup
    .number()
    .positive()
    .min(40, 'Не менше 40')
    .max(130, 'Не більше 130'),
});

export const CaloriesCalcList = () => {
  const [sex, setSex] = useState<boolean>(true);
  const [age, setAge] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [activity, setActivity] = useState<number>(1.2);

  const [errors, setErrors] = useState<{
    age?: string;
    height?: string;
    weight?: string;
  }>({});

  const router = useRouter();

  const changeAge = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAge(e.target.value);
    setOnboardingData('age', e.target.value);
  };

  const changeWeight = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWeight(e.target.value);
    setOnboardingData('weight', e.target.value);
  };

  const changeHeight = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeight(e.target.value);
    setOnboardingData('height', e.target.value);
  };

  const changeSex = (val: boolean) => {
    setSex(val);
    setOnboardingData('sex', val ? 'Чоловік' : 'Жінка');
  };

  const changeActivity = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActivity(Number(e.target.value));
    setOnboardingData('activity', e.target.value);
  };

  const validate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) {
      setErrors((prev) => ({ ...prev, [e.target.name]: 'введіть число' }));
      return;
    }
    try {
      await schema.validate(
        { [e.target.name]: e.target.value },
        { abortEarly: false }
      );
      setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
    } catch (err) {
      const validationErrors: Record<string, string> = {};
      (err as yup.ValidationError).inner.forEach((error: any) => {
        if (error.path) {
          validationErrors[error.path] = error.message;
        }
      });
      setErrors((prev) => ({ ...prev, ...validationErrors }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;
    if (!age) {
      setErrors((prev) => ({ ...prev, age: "Обов'язкове поле" }));
      hasError = true;
    }
    if (!height) {
      setErrors((prev) => ({ ...prev, height: "Обов'язкове поле" }));
      hasError = true;
    }
    if (!weight) {
      setErrors((prev) => ({ ...prev, weight: "Обов'язкове поле" }));
      hasError = true;
    }
    if (hasError) return;

    // Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor Equation
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    const ageNum = parseFloat(age);

    let bmr: number;
    if (sex) {
      // Male
      bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5;
    } else {
      // Female
      bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161;
    }

    // Calculate TDEE (Total Daily Energy Expenditure)
    const tdee = Math.round(bmr * activity);
    setOnboardingData('tdee', tdee.toString());
    setOnboardingData('bmr', Math.round(bmr).toString());

    router.push('/onboarding/goals');
  };

  return (
    <form className='flex flex-col gap-7' onSubmit={handleSubmit}>
      <label htmlFor='sex' className='font-bold flex items-center gap-3'>
        <span className='p-2 text-lg text-main-title dark:text-main-title-black'>
          Стать:{' '}
        </span>
        <label
          htmlFor='woman'
          className={`cursor-pointer flex items-center justify-center tracking-widest
          dark:hover:bg-[#d4d4d4] dark:hover:text-main-text 
          truncate font-semibold text-lg rounded-xl p-2  hover:bg-[#ECECEC] ${
            !sex
              ? 'bg-[#D9D9D9] dark:bg-[#d4d4d4] text-main'
              : 'dark:text-main-text-black'
          } `}
        >
          Жінка{' '}
        </label>
        <input
          id='woman'
          name='sex'
          type='radio'
          value='Жінка'
          className='appearance-none'
          checked={!sex}
          onChange={() => changeSex(false)}
        />
        <label
          htmlFor='man'
          className={`cursor-pointer flex items-center justify-center tracking-widest
          dark:hover:bg-[#d4d4d4] dark:hover:text-main-text 
          truncate font-semibold text-lg rounded-xl p-2  hover:bg-[#ECECEC] ${
            sex
              ? 'bg-[#D9D9D9] dark:bg-[#d4d4d4] text-main'
              : 'dark:text-main-text-black'
          } `}
        >
          Чоловік{' '}
        </label>
        <input
          id='man'
          name='sex'
          type='radio'
          value='Чоловік'
          className='appearance-none'
          checked={sex}
          onChange={() => changeSex(true)}
        />
      </label>
      <InputSkeleton
        text={'Вік, років:'}
        name='age'
        max={130}
        min={14}
        value={age}
        setAny={changeAge}
        onBlur={validate}
        error={errors.age}
      />
      <InputSkeleton
        text={'Зріст (см):'}
        name='height'
        max={220}
        min={100}
        value={height}
        setAny={changeHeight}
        onBlur={validate}
        error={errors.height}
      />
      <InputSkeleton
        text={'Вага (кг):'}
        name='weight'
        max={130}
        min={40}
        value={weight}
        setAny={changeWeight}
        onBlur={validate}
        error={errors.weight}
      />
      <label
        htmlFor='activity'
        className='font-bold -mb-4 text-lg text-main-title dark:text-main-title-black'
      >
        Рівень щоденної активності
      </label>
      <select
        name='activity'
        className='max-[440px]:max-w-[280px] min-[768px]:max-w-[340px] min-[880px]:max-w-[380px] min-[980px]:max-w-[404px]
        font-bold border border-gray-300 rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-main 
        text-main-text dark:text-main-text-black bg-[#e5e5e5] dark:bg-[#676465]'
        value={activity}
        onChange={changeActivity}
      >
        <option value='1.2'>
          Малоактивний. Переважно сиджу (напр. офісний працівник)
        </option>
        <option value='1.375'>
          Помірно активний. Переважно стою (напр. вчитель)
        </option>
        <option value='1.55'>
          Активний. Переважно ходжу (напр. продавець)
        </option>
        <option value='1.725'>
          Дуже активний. Фізично вимоглива робота (будівельник)
        </option>
        <option value='1.9'>
          Надзвичайно активний (дуже інтенсивні фізичні вправи або фізична
          робота)
        </option>
      </select>
      <button
        type='submit'
        className={`bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 focus:from-red-600 focus:to-orange-600    rounded-xl p-4 text-white text-center block active:bg-primary-700 hover:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.3),0_4px_18px_0_rgba(59,113,202,0.2)] shadow-[0_4px_9px_-4px_#3b71ca] dark:shadow-none dark:hover:shadow-none w-full transition-all duration-200`}
      >
        Далі
      </button>
    </form>
  );
};
