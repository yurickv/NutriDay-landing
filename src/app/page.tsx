import AboutUsSection from "@/components/section-about-us/SectionAboutUs";
import AdvantagesSection from "@/components/section-advanteges/SectionAdvantages";
import ExampleWorkSection from "@/components/section-exampleWork/ExampleWorkSection";
import HeroSection from "@/components/section-hero/HeroSection";
import ReviewsSection from "@/components/section-reviews/SectionReviews";

export default function Home() {
  return (
    <div className=''>
      <main className='text-[#21201C]'>
        <HeroSection />
        <AdvantagesSection />
        <AboutUsSection />
        <ExampleWorkSection />
        <ReviewsSection />
      </main>
      <footer className=''></footer>
    </div>
  );
}
