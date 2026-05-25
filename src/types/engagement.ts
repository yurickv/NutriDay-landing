import { AIMeal } from './meals';

export interface Tip {
  _id?: string;
  text: string;
  category: 'nutrition' | 'hydration' | 'motivation' | 'cooking' | 'lifestyle';
  tags: string[];
  isActive: boolean;
  displayWeight: number;
}

export interface StreakBadge {
  id: string;
  earnedAt: Date;
}

export interface UserStreak {
  userEmail: string;
  currentStreak: number;
  longestStreak: number;
  lastCheckedDate: Date;
  totalDaysCompleted: number;
  badges: StreakBadge[];
}

export interface WaterLogEntry {
  amountMl: number;
  loggedAt: Date;
}

export interface WaterLog {
  userEmail: string;
  date: Date;
  amountMl: number;
  goalMl: number;
  logs: WaterLogEntry[];
}

export interface WeightLog {
  _id?: string;
  userEmail: string;
  date: Date;
  weight: number;
  note: string | null;
  createdAt: Date;
}

export interface FavoriteMeal {
  _id?: string;
  userEmail: string;
  meal: AIMeal;
  savedAt: Date;
  timesGenerated: number;
}
