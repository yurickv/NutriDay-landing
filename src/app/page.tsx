import AboutUsSection from "@/components/MainPage/section-about-us/SectionAboutUs";
import AdvantagesSection from "@/components/MainPage/section-advanteges/SectionAdvantages";
import ExampleWorkSection from "@/components/MainPage/section-exampleWork/ExampleWorkSection";
import HeroSection from "@/components/MainPage/section-hero/HeroSection";
import ReviewsSection from "@/components/MainPage/section-reviews/SectionReviews";
import Footer from "@/components/Footer";

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
      <Footer />
    </div>
  );
}
