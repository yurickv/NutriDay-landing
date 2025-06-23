import AboutUsSection from "@/components/section-about-us/SectionAboutUs";
import AdvantagesSection from "@/components/section-advanteges/SectionAdvantages";
import HeroSection from "@/components/section-hero/HeroSection";

export default function Home() {
  return (
    <div className=''>
      <main className=''>
        <HeroSection />
        <AdvantagesSection />
        <AboutUsSection />
      </main>
      <footer className=''></footer>
    </div>
  );
}
