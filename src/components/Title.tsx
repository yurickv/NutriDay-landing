type TitleProps = {
  text: string;
};

export default function Title({ text }: TitleProps) {
  return (
    <h2
      className={`font-bold text-[30px] md:text-[35px] xl:text-[44px] font-heading`}
    >
      {text}
    </h2>
  );
}
