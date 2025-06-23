import AdvantagesSection from "@/components/section-advanteges/SectionAdvantages";
import HeroSection from "@/components/section-hero/HeroSection";
import Image from "next/image";

export default function Home() {
  return (
    <div className=''>
      <main className=''>
        <HeroSection />
        <AdvantagesSection />
      </main>
      <footer className=''></footer>
    </div>
  );
}
