import { describe, it, expect } from 'vitest';
import {
  visibleSteps,
  questionProgress,
  nextStepKey,
  prevStepKey,
  firstUnansweredKey,
  isAccessible,
  verbosity,
  showHint,
  resolveInfoContent,
} from './engine';
import { getStep } from './steps';

// Повний набір відповідей для maintain_weight (без target_weight).
const answeredAll: Record<string, unknown> = {
  sex: 'female',
  mainGoal: 'maintain_weight',
  nutritionKnowledge: 'advanced',
  shortGoal: ['boost_energy'],
  breakfastTime: '06_08',
  lunchTime: '12_14',
  dinnerTime: '18_20',
  dietaryPreferences: ['none'],
  eatingHabits: ['none'],
  cravings: ['none'],
  foodTracking: 'never',
  mealsPerDay: 'three',
  batchCooking: 'no',
  height: '170',
  weight: '65',
  age: '30',
  activity: '1.2',
  confidence: 'sure',
};

describe('visibleSteps', () => {
  it('hides target_weight until a matching goal is chosen', () => {
    const keys = visibleSteps({}).map((s) => s.key);
    expect(keys).not.toContain('target_weight');
  });

  it('shows target_weight for lose_weight and hides for maintain_weight', () => {
    expect(visibleSteps({ mainGoal: 'lose_weight' }).map((s) => s.key)).toContain('target_weight');
    expect(visibleSteps({ mainGoal: 'maintain_weight' }).map((s) => s.key)).not.toContain('target_weight');
  });
});

describe('questionProgress', () => {
  it('counts only questions, respecting conditions', () => {
    expect(questionProgress('gender', {})).toEqual({ index: 1, total: 18 });
    expect(questionProgress('gender', { mainGoal: 'lose_weight' })).toEqual({ index: 1, total: 19 });
  });

  it('returns null for info screens', () => {
    expect(questionProgress('goal_promise', {})).toBeNull();
  });
});

describe('navigation', () => {
  it('walks forward and backward', () => {
    expect(nextStepKey('gender', {})).toBe('main_goal');
    expect(prevStepKey('main_goal', {})).toBe('gender');
    expect(prevStepKey('gender', {})).toBeNull();
    expect(nextStepKey('analyzing', {})).toBeNull();
  });

  it('skips hidden target_weight', () => {
    expect(nextStepKey('current_weight', { mainGoal: 'maintain_weight' })).toBe('age');
    expect(nextStepKey('current_weight', { mainGoal: 'lose_weight' })).toBe('target_weight');
  });
});

describe('firstUnansweredKey / isAccessible', () => {
  it('gates on the first unanswered question', () => {
    expect(firstUnansweredKey({})).toBe('gender');
    expect(firstUnansweredKey({ sex: 'female' })).toBe('main_goal');
    expect(isAccessible('gender', {})).toBe(true);
    expect(isAccessible('height', {})).toBe(false);
    expect(isAccessible('unknown_step', {})).toBe(false);
  });

  it('info screen right after the gate is reachable', () => {
    // main_goal відповіли → goal_promise (info) доступний, наступне питання теж
    const a = { sex: 'female', mainGoal: 'lose_weight' };
    expect(isAccessible('goal_promise', a)).toBe(true);
    expect(isAccessible('nutrition_knowledge', a)).toBe(true);
    expect(isAccessible('short_goal', a)).toBe(false);
  });

  it('your_profile gates on email + consent, then analyzing opens', () => {
    expect(firstUnansweredKey(answeredAll)).toBe('your_profile');
    expect(isAccessible('analyzing', answeredAll)).toBe(false);
    const done = { ...answeredAll, email: 'a@b.co', personalDataConsent: true };
    expect(firstUnansweredKey(done)).toBe('analyzing');
    expect(isAccessible('analyzing', done)).toBe(true);
  });
});

describe('verbosity / hints / info content', () => {
  it('defaults to beginner before the knowledge question', () => {
    expect(verbosity({})).toBe('beginner');
    expect(verbosity({ nutritionKnowledge: 'advanced' })).toBe('advanced');
  });

  it('shows plain hints to beginners only, hintAlways to everyone', () => {
    const breakfast = getStep('breakfast_time')!; // hint без hintAlways
    const diet = getStep('diet_type')!; // hintAlways
    expect(showHint(breakfast, {})).toBe(true);
    expect(showHint(breakfast, { nutritionKnowledge: 'advanced' })).toBe(false);
    expect(showHint(diet, { nutritionKnowledge: 'advanced' })).toBe(true);
  });

  it('resolves goal_promise variant and bodyShort for advanced', () => {
    const promise = getStep('goal_promise')!;
    expect(resolveInfoContent(promise, { mainGoal: 'lose_weight' }).title).toBe(
      'Схуднути можна без голоду'
    );
    const kbju = getStep('calories_done_for_you')!;
    expect(resolveInfoContent(kbju, { nutritionKnowledge: 'advanced' }).body).toBe(
      kbju.bodyShort
    );
    expect(resolveInfoContent(kbju, {}).body).toBe(kbju.body);
  });
});
