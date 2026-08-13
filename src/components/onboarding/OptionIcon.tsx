'use client';

import {
  Armchair,
  Ban,
  BookOpen,
  CalendarCheck,
  CandyOff,
  CircleHelp,
  Cookie,
  CupSoda,
  Dumbbell,
  EggFried,
  FishOff,
  Flame,
  Footprints,
  Frown,
  GraduationCap,
  Ham,
  HandPlatter,
  HardHat,
  HeartHandshake,
  MilkOff,
  MoonStar,
  PersonStanding,
  Pizza,
  Popcorn,
  Salad,
  Scale,
  Smile,
  Sprout,
  Target,
  TrendingDown,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
  WheatOff,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { OptionIconName } from '@/lib/onboarding/types';

// Реєстр іконок варіантів квізу. Record<OptionIconName, …> — тому додана
// в types.ts назва без записи тут не скомпілюється.
const ICONS: Record<OptionIconName, LucideIcon> = {
  TrendingDown,
  Scale,
  Dumbbell,
  TrendingUp,
  Utensils,
  Sprout,
  BookOpen,
  GraduationCap,
  Salad,
  Zap,
  Target,
  HeartHandshake,
  CalendarCheck,
  EggFried,
  WheatOff,
  MilkOff,
  Ham,
  FishOff,
  CandyOff,
  Frown,
  HandPlatter,
  MoonStar,
  UtensilsCrossed,
  Cookie,
  Popcorn,
  Pizza,
  CupSoda,
  Ban,
  Armchair,
  PersonStanding,
  Footprints,
  HardHat,
  Flame,
  Smile,
  CircleHelp,
};

/**
 * Бейдж з іконкою ліворуч від підпису варіанту. Неактивний — світлий sage,
 * вибраний — заливка sage (той самий акцент, що й рамка картки).
 */
export function OptionIcon({
  name,
  active,
}: {
  name: OptionIconName;
  active?: boolean;
}) {
  const Icon = ICONS[name];
  return (
    <span
      aria-hidden
      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
        active
          ? 'bg-sage text-white'
          : 'bg-sage-light/50 text-sage-dark dark:bg-sage/25 dark:text-sage-light'
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}
