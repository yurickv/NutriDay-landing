import { useState } from 'react';

/**
 * Повертає останнє не-null значення. Потрібно шторкам (BottomSheet): батько обнуляє
 * дані одразу при закритті, а контент має лишатися видимим упродовж leave-анімації,
 * і сам Dialog має бути змонтованим постійно (інакше Headless UI не анімує вхід/вихід).
 */
export function useLastNonNull<T>(value: T | null | undefined): T | null {
  const [last, setLast] = useState<T | null>(value ?? null);
  if (value != null && value !== last) {
    setLast(value);
    return value;
  }
  return last;
}
