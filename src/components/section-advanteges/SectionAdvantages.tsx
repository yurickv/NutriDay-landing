import Title from "../Title";
import AdvantagesCard from "./AdvantagesCard";

export default function AdvantagesSection() {
  return (
    <section className='text-white bg-[#323030]'>
      <div className='w-full h-full px-6 xl:px-10'>
        <div className='h-full lg:h-[720px] text-start mx-auto flex flex-col justify-center mt-10 lg:mt-0'>
          <Title text='Зробіть здорове харчування простим і швидким' />
          <AdvantagesCard />
        </div>
      </div>
    </section>
  );
}
