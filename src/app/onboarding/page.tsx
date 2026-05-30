import CaloriesCalc from "@/components/onboardingPage/calcComponent";

export default function Onboarding() {
  return (
    <div className='min-h-screen bg-white dark:bg-dark-body'>
      <main className='text-[#21201C] dark:text-main-title-black'>
        <CaloriesCalc />
      </main>
      <footer className=''></footer>
    </div>
  );
}
