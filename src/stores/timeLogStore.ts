import { create } from 'zustand';
import type { TimeLog, TimeLogType } from '@/types';
import { loadFromStorage, saveToStorage, getUserKey } from '@/lib/storage';

interface TimeLogState {
  logs: TimeLog[];
  _userId: string | undefined;
  // Actions
  initForUser: (userId?: string) => void;
  addTimeLog: (log: Omit<TimeLog, 'id'>) => void;
  clearLogs: () => void;
}

export const useTimeLogStore = create<TimeLogState>((set, get) => ({
  logs: [],
  _userId: undefined,

  initForUser: (userId = 'admin') => {
    set({ _userId: userId });
    const key = getUserKey('nw_timeLogs', userId);
    const logs = loadFromStorage<TimeLog[]>(key, []);
    set({ logs, _userId: userId });
  },

  addTimeLog: (log) => {
    const userId = get()._userId;
    const newLog: TimeLog = {
      ...log,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
      createdAt: Date.now(),
    };
    
    const updated = [...get().logs, newLog];
    saveToStorage(getUserKey('nw_timeLogs', userId), updated);
    set({ logs: updated });
  },

  clearLogs: () => {
    const userId = get()._userId;
    saveToStorage(getUserKey('nw_timeLogs', userId), []);
    set({ logs: [] });
  },
}));
