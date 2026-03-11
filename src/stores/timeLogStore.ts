import { create } from 'zustand';
import type { TimeLog, TimeLogType } from '@/types';
import { loadFromStorage, saveToStorage, getUserKey } from '@/lib/storage';
import { getNowInTimezone } from '@/lib/notifications';
import { useSettingsStore } from './settingsStore';

interface TimeLogStore {
  timeLogs: TimeLog[];
  _userId: string | undefined;
  initForUser: (userId?: string) => void;
  addTimeLog: (log: Omit<TimeLog, 'id'>) => void;
  removeTimeLog: (id: string) => void;
  getLogsForDate: (date: string) => TimeLog[];
  getTotalDurationForDate: (date: string) => number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const useTimeLogStore = create<TimeLogStore>((set, get) => ({
  timeLogs: [],
  _userId: undefined,

  initForUser: (userId = 'admin') => {
    set({ _userId: userId });
    const key = getUserKey('nw_time_logs', userId);
    const logs = loadFromStorage<TimeLog[]>(key, []);
    set({ timeLogs: logs });
  },

  addTimeLog: (log) => {
    const userId = get()._userId;
    const id = generateId();
    const newLog: TimeLog = { ...log, id };
    const updated = [...get().timeLogs, newLog];
    saveToStorage(getUserKey('nw_time_logs', userId), updated);
    set({ timeLogs: updated });
  },

  removeTimeLog: (id) => {
    const userId = get()._userId;
    const updated = get().timeLogs.filter(l => l.id !== id);
    saveToStorage(getUserKey('nw_time_logs', userId), updated);
    set({ timeLogs: updated });
  },

  getLogsForDate: (date) => {
    return get().timeLogs.filter(l => l.date === date);
  },

  getTotalDurationForDate: (date) => {
    return get().timeLogs
      .filter(l => l.date === date)
      .reduce((sum, l) => sum + l.duration, 0);
  },
}));
