import { create } from 'zustand';
import type { GamificationState, Achievement, Reward } from '@/types';
import { loadFromStorage, saveToStorage, getUserKey } from '@/lib/storage';

interface GamificationStoreState extends GamificationState {
  _userId: string | undefined;
  // Actions
  initForUser: (userId?: string) => void;
  addXP: (amount: number) => void;
  levelUp: () => void;
  addAchievement: (achievement: Achievement) => void;
  addReward: (reward: Reward) => void;
  updateStreak: (streak: number) => void;
}

const DEFAULT_STATE: GamificationStoreState = {
  level: 1,
  xp: 0,
  streak: 0,
  achievements: [],
  rewards: [],
  totalTasksCompleted: 0,
  totalTimeSpent: 0,
  _userId: undefined,
};

export const useGamificationStore = create<GamificationStoreState>((set, get) => ({
  ...DEFAULT_STATE,

  initForUser: (userId = 'admin') => {
    set({ _userId: userId });
    const key = getUserKey('nw_gamification', userId);
    const saved = loadFromStorage<Partial<GamificationStoreState>>(key, {});
    if (saved) {
      set({ ...DEFAULT_STATE, ...saved, _userId: userId });
    }
  },

  addXP: (amount) => {
    const currentXP = get().xp;
    const newXP = currentXP + amount;
    const newLevel = Math.floor(newXP / 100) + 1;
    
    set({
      xp: newXP,
      level: newLevel > get().level ? newLevel : get().level,
    });
    
    const userId = get()._userId;
    saveToStorage(getUserKey('nw_gamification', userId), get());
  },

  levelUp: () => {
    const newLevel = get().level + 1;
    set({ level: newLevel });
    
    const userId = get()._userId;
    saveToStorage(getUserKey('nw_gamification', userId), get());
  },

  addAchievement: (achievement) => {
    const updated = {
      ...get(),
      achievements: [...get().achievements, achievement],
    };
    set(updated);
    
    const userId = get()._userId;
    saveToStorage(getUserKey('nw_gamification', userId), updated);
  },

  addReward: (reward) => {
    const updated = {
      ...get(),
      rewards: [...get().rewards, reward],
    };
    set(updated);
    
    const userId = get()._userId;
    saveToStorage(getUserKey('nw_gamification', userId), updated);
  },

  updateStreak: (streak) => {
    set({ streak });
    
    const userId = get()._userId;
    saveToStorage(getUserKey('nw_gamification', userId), get());
  },
}));
