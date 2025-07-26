import Link from "next/link";
import Image from "next/image";
import profilePic from "../../../public/bg-hero.webp";
import { CaloriesCalcList } from "./CaloriesCalcList";
import { CaloriesDescription } from "./CaloriesDescription";

const CaloriesCalc = () => {
  return (
    <main>
      <section className='relative'>
        <div
          className='div-container py-[44px] mx-auto text-center flex flex-col gap-5 md:gap-10
         z-10 relative bg-white dark:bg-dark-body'
        >
          {/* <h2 className='sr-only'>
            Калькулятор для визначення денної потреби калорій
          </h2>
          <h3 className=' text-left text-mainTitleBlack flex gap-2'>
           <Link
              href='/calcs'
              className='flex gap-2 items-center font-semibold'
            >
              <span className='sr-only md:not-sr-only'>&gt; Калькулятори</span>
            </Link>
            <span className='font-semibold'> &gt; Потреба калорій</span>
          </h3> */}
          <h1 className='text-4xl md:text-5xl font-bold text-center mt-14 text-main-title dark:text-main-title-black'>
            Давайте створимо ваш індивідуальний план!
          </h1>
        </div>
        {/* <Image
          alt='Adrenalin gym foto'
          src={profilePic}
          placeholder='blur'
          fill
          priority
          sizes='100vw'
          style={{
            objectFit: "cover",
          }}
        /> */}
      </section>
      <section className='bg-white dark:bg-dark-body'>
        <div className='div-container  py-[20px] md:py-[44px]  mx-auto text-center'>
          {/* <p className='font-bold text-base md:text-lg my-10 md:my-12 text-main-text dark:text-main-text-black'>
            Для отримання розрахунку переміщуйте мишкою повзунок на лінії, або
            введіть дані вручну
          </p> */}
          <div className='flex flex-col gap-6 md:gap-10 justify-between items-center'>
            <div
              className='p-12 bg-[#F5F5F5] dark:bg-[#676465] flex flex-col max-w-[500px] 
            text-center basis-1/2 float-left max-h-[960px] md:mr-6 md:mb-6 rounded-xl
            shadow-[0px_4px_20px_0px_rgba(133,119,123,0.30)] dark:shadow-[0px_4px_15px_0px_rgba(116,116,116,0.30)]'
            >
              <CaloriesCalcList />
              {/* <ButtonGroup /> */}
            </div>
            {/* <CaloriesDescription /> */}
          </div>
        </div>
      </section>
    </main>
  );
};
export default CaloriesCalc;
