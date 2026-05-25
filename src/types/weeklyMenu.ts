import { DayMeals } from './meals';

export interface MenuDay {
  date: Date;
  dayLabel: string;
  meals: DayMeals;
  totalCalories: number;
  totalPrepMinutes: number;
  isCompleted: boolean;
  completedAt: Date | null;
}

export interface WeeklyMenu {
  _id: string;
  userEmail: string;
  weekStartDate: Date;
  goalCaloriesAtGeneration: number;
  aiModel: string;
  status: 'active' | 'archived';
  days: MenuDay[];
  createdAt: Date;
  updatedAt: Date;
}
