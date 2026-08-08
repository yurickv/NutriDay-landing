import { describe, it, expect } from 'vitest';
import { calcSummary } from './summary';

describe('calcSummary', () => {
  it('computes BMR/TDEE/goal, BMI and macro grams', () => {
    // Жінка, 65 кг, 170 см, 30 років, activity 1.2, maintain:
    // BMR = 10*65 + 6.25*170 - 5*30 - 161 = 1401.5 → 1402 (Math.round)
    // TDEE = round(1402 * 1.2) = 1682; maintain → goal 1682
    const s = calcSummary({
      sex: 'female',
      weight: '65',
      height: '170',
      age: '30',
      activity: '1.2',
      mainGoal: 'maintain_weight',
    });
    expect(s.bmr).toBe(1402);
    expect(s.tdee).toBe(1682);
    expect(s.goalCalories).toBe(1682);
    expect(s.bmi).toBe(22.5); // 65 / 1.7²
    expect(s.proteinG).toBe(Math.round((1682 * 0.3) / 4));
    expect(s.fatG).toBe(Math.round((1682 * 0.3) / 9));
    expect(s.carbsG).toBe(Math.round((1682 * 0.4) / 4));
  });

  it('is defensive about missing values', () => {
    const s = calcSummary({});
    expect(s.bmi).toBe(0);
    expect(Number.isFinite(s.goalCalories)).toBe(true);
  });
});
