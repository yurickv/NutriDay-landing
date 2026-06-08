import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';

const FOOTER_LINKS = [
  {
    name: 'Публічна оферта (умови, ФОП, повернення)',
    href: '/oferta',
  },
  {
    name: 'Тарифи та послуги',
    href: '/payment/plan',
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#323030] text-gray-300 py-10">
      <div className="div-container mx-auto flex flex-col gap-8 md:flex-row md:justify-between">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-base font-semibold text-white">NutriDay</span>
          <span>ФОП Теслюк Юрій Леонідович</span>
          <span>ІПН: 3090301550</span>
          <span>м. Тернопіль, вул. Сергія Корольова 8/7</span>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <a
            href="mailto:yurickv@gmail.com"
            className="flex items-center gap-2 hover:text-white transition-colors"
          >
            <Mail className="w-4 h-4" />
            yurickv@gmail.com
          </a>
          <a
            href="tel:+380979601371"
            className="flex items-center gap-2 hover:text-white transition-colors"
          >
            <Phone className="w-4 h-4" />
            +38 (097) 960-1371
          </a>
        </div>

        <nav className="flex flex-col gap-2 text-sm">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-white underline-offset-4 hover:underline transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="div-container mx-auto mt-8 pt-6 border-t border-white/10 text-xs text-gray-400">
        © {new Date().getFullYear()} NutriDay. Усі права захищені.
      </div>
    </footer>
  );
}
