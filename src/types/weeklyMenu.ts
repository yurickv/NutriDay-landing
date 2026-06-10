import { DayMeals, CustomEntry } from './meals';

export interface MenuDay {
  date: Date;
  dayLabel: string;
  meals: DayMeals;
  totalCalories: number;
  totalPrepMinutes: number;
  isCompleted: boolean;
  completedAt: Date | null;
  customEntries?: CustomEntry[]; // user-added eaten foods outside the AI menu
}

export interface WeeklyMenu {
  _id: string;
  userEmail: string;
  weekStartDate: Date;
  goalCaloriesAtGeneration: number;
  aiModel: string;
  status: 'active' | 'archived';
  days: MenuDay[];
  pendingDayIndices?: number[]; // 0=Пн…6=Нд, дні поточного тижня ще не згенеровані
  createdAt: Date;
  updatedAt: Date;
}
