import { create } from 'zustand';
import type { GamificationState, EisenhowerQuadrant } from '@/types';
import { calculateLevel, checkAchievement, getDefaultGamificationState } from '@/lib/gamification';
import { loadFromStorage, saveToStorage, getUserKey } from '@/lib/storage';
import { getNowInTimezone } from '@/lib/notifications';
import { saveGamificationToDB } from '@/lib/db';

interface GamificationStore {
  gamification: GamificationState;
  _userId: string | undefined;
  initForUser: (userId?: string) => void;
  onTaskCompleted: (quadrant: EisenhowerQuadrant, duration: number, timezone: string, xpEarned: number) => void;
  addXP: (amount: number) => void;
  claimReward: (rewardId: string) => void;
}

export const useGamificationStore = create<GamificationStore>((set, get) => ({
  gamification: getDefaultGamificationState(),
  _userId: undefined,

  initForUser: (userId = 'admin') => {
    set({ _userId: userId });
    const key = getUserKey('nw_gamification', userId);
    const saved = loadFromStorage<GamificationState>(key, null);
    
    if (saved) {
      // Restore saved state
      set({ gamification: saved });
    } else {
      // Use default state
      set({ gamification: getDefaultGamificationState() });
    }
  },

  onTaskCompleted: (quadrant, duration, timezone, xpEarned) => {
    const userId = get()._userId;
    const current = get().gamification;
    const now = getNowInTimezone(timezone);
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Check if this is the first task today
    const isFirstTaskToday = !current.dailyCompletionDates.includes(todayStr);
    
    // Calculate streak
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    let newStreak = current.streak;
    if (current.dailyCompletionDates.includes(yesterdayStr)) {
      newStreak = current.streak + 1;
    } else if (!current.dailyCompletionDates.includes(todayStr)) {
      newStreak = 1;
    }
    
    // Calculate new XP and level
    const newXP = current.xp + xpEarned;
    const newLevel = calculateLevel(newXP);
    
    // Check for new achievements
    const newAchievements = [...current.achievements];
    const newTotalTasks = current.totalTasksCompleted + 1;
    
    // Check if new achievements unlocked
    const unlockedAchievements = checkAchievement({
      totalTasksCompleted: newTotalTasks,
      streak: newStreak,
      level: newLevel,
      xp: newXP,
    }, current.achievements);
    
    unlockedAchievements.forEach(achievement => {
      if (!newAchievements.find(a => a.id === achievement.id)) {
        newAchievements.push({ ...achievement, unlockedAt: Date.now() });
      }
    });
    
    const updated: GamificationState = {
      ...current,
      xp: newXP,
      level: newLevel,
      streak: newStreak,
      lastActiveDate: todayStr,
      totalTasksCompleted: newTotalTasks,
      totalTimerSeconds: current.totalTimerSeconds + duration,
      earlyBirdCount: now.getHours() < 9 ? current.earlyBirdCount + 1 : current.earlyBirdCount,
      dailyCompletionDates: isFirstTaskToday 
        ? [...current.dailyCompletionDates, todayStr]
        : current.dailyCompletionDates,
      achievements: newAchievements,
    };
    
    saveToStorage(getUserKey('nw_gamification', userId), updated);
    if (userId && userId !== 'admin') {
      saveGamificationToDB(userId, updated);
    }
    set({ gamification: updated });
  },

  addXP: (amount) => {
    const userId = get()._userId;
    const current = get().gamification;
    const newXP = current.xp + amount;
    const newLevel = calculateLevel(newXP);
    
    const updated: GamificationState = {
      ...current,
      xp: newXP,
      level: newLevel,
    };
    
    saveToStorage(getUserKey('nw_gamification', userId), updated);
    if (userId && userId !== 'admin') {
      saveGamificationToDB(userId, updated);
    }
    set({ gamification: updated });
  },

  claimReward: (rewardId) => {
    const userId = get()._userId;
    const current = get().gamification;
    const reward = current.rewards.find(r => r.id === rewardId);
    
    if (!reward || reward.claimedAt || current.xp < reward.xpCost) return;
    
    const updated: GamificationState = {
      ...current,
      xp: current.xp - reward.xpCost,
      rewards: current.rewards.map(r => 
        r.id === rewardId ? { ...r, claimedAt: Date.now() } : r
      ),
    };
    
    saveToStorage(getUserKey('nw_gamification', userId), updated);
    if (userId && userId !== 'admin') {
      saveGamificationToDB(userId, updated);
    }
    set({ gamification: updated });
  },
}));
