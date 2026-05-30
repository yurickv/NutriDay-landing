'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UtensilsCrossed, ShoppingCart, User } from 'lucide-react';

const navItems = [
  { href: '/menu', label: 'Меню', icon: UtensilsCrossed },
  { href: '/shopping-list', label: 'Покупки', icon: ShoppingCart },
  { href: '/profile', label: 'Профіль', icon: User },
];

export function BottomNavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 pb-safe">
      <div className="flex items-stretch justify-around max-w-[1400px] mx-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-3 min-h-[56px] transition-colors ${
                isActive
                  ? 'text-main'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-main'
              }`}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold leading-none">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
