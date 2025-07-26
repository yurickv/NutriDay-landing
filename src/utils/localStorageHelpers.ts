// Функції для роботи з localStorage з перевіркою на window

export function setToLocalStorage(key: string, value: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
}

export function getFromLocalStorage(key: string): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(key);
  }
  return null;
}
