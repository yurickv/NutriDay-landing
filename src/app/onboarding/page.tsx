import CaloriesCalc from "@/components/onboardingPage/calcComponent";
import { TrackEvent } from "@/components/analytics/TrackEvent";

export default function Onboarding() {
  return (
    <div className='min-h-screen bg-white dark:bg-dark-body'>
      <TrackEvent event="onboarding_started" withUtmSource />
      <main className='text-[#21201C] dark:text-main-title-black'>
        <CaloriesCalc />
      </main>
      <footer className=''></footer>
    </div>
  );
}
