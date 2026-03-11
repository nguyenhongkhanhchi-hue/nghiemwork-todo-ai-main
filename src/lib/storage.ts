// Local storage utilities for persisting data

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error loading from storage: ${key}`, error);
    return defaultValue;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving to storage: ${key}`, error);
  }
}

export function getUserKey(baseKey: string, userId?: string): string {
  return userId ? `${baseKey}_${userId}` : baseKey;
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing from storage: ${key}`, error);
  }
}

export function clearAllUserData(userId: string): void {
  const keys = ['nw_tasks', 'nw_timers', 'nw_topics', 'nw_templates', 'nw_gamification', 'nw_chat', 'nw_time_logs'];
  keys.forEach(key => {
    removeFromStorage(getUserKey(key, userId));
  });
}
