import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600"],
});

type TitleProps = {
  text: string;
};

export default function Title({ text }: TitleProps) {
  return (
    <h2
      className={`font-semibold text-[30px] md:text-[35px] xl:text-[48px] ${poppins.className}`}
    >
      {text}
    </h2>
  );
}
