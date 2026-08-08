import { describe, it, expect } from 'vitest';
import { STEPS, getStep, labelFor, plainLabel } from './steps';

// Канон значень із src/components/profilePage/FoodPreferencesEditor.tsx —
// щоб dietaryPreferences лягли в профіль без мапінгу.
const DIETARY_CANON = [
  'вегетаріанське',
  'веганське',
  'кето',
  'без глютену',
  'без молочних',
  'без свинини',
  'без морепродуктів',
  'без цукру',
];

describe('STEPS integrity', () => {
  it('has unique keys', () => {
    const keys = STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every question has a field and inputs config', () => {
    for (const s of STEPS.filter((x) => x.type === 'question')) {
      expect(s.field, s.key).toBeTruthy();
      expect(s.questionType, s.key).toBeTruthy();
      if (s.questionType === 'number') {
        expect(s.min, s.key).toBeTypeOf('number');
        expect(s.max, s.key).toBeTypeOf('number');
        expect(s.unit, s.key).toBeTruthy();
      } else {
        expect(s.options?.length, s.key).toBeGreaterThan(1);
      }
    }
  });

  it('starts with gender and ends with the loader', () => {
    expect(STEPS[0].key).toBe('gender');
    expect(STEPS[STEPS.length - 1]).toMatchObject({ key: 'analyzing', type: 'loader' });
  });

  it('diet_type values match the profile editor canon', () => {
    const step = getStep('diet_type')!;
    const values = step.options!.filter((o) => !o.isNone).map((o) => o.value);
    expect(values).toEqual(DIETARY_CANON);
    expect(step.options![0].isNone).toBe(true); // «Їм усе» першим
  });

  it('sex options are canonical male/female', () => {
    const values = getStep('gender')!.options!.map((o) => o.value);
    expect(values).toEqual(['female', 'male']);
  });

  it('target_weight is conditional on mainGoal', () => {
    expect(getStep('target_weight')!.condition).toEqual([
      { field: 'mainGoal', op: 'in', values: ['lose_weight', 'gain_weight', 'build_muscle'] },
    ]);
  });

  it('goal_promise has a variant for every main goal', () => {
    const goals = getStep('main_goal')!.options!.map((o) => o.value);
    const variants = Object.keys(getStep('goal_promise')!.variants!);
    expect(variants.sort()).toEqual([...goals].sort());
  });

  it('labelFor strips emoji and falls back to the raw value', () => {
    expect(plainLabel('📉 Схуднути')).toBe('Схуднути');
    expect(labelFor('mainGoal', 'lose_weight')).toBe('Схуднути');
    expect(labelFor('shortGoal', 'meal_planning')).toBe('Не думати що приготувати завтра');
    expect(labelFor('mainGoal', 'unknown_key')).toBe('unknown_key');
  });
});
