import { create } from 'zustand';
import type { WaterEntry, WeightEntry, WaistEntry, HealthGoals, WaterReminderSettings } from '@/types';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY_PREFIX = 'nw_health_';

export interface HealthState {
  waterEntries: WaterEntry[];
  weightEntries: WeightEntry[];
  waistEntries: WaistEntry[];
  dailyWaterGoal: number;
  weightUnit: 'kg' | 'lbs';
  goals: HealthGoals;
  waterReminder: WaterReminderSettings;
  _userId: string | null;
  // Actions
  initForUser: (userId?: string) => void;
  addWaterEntry: (amount: number) => void;
  addWeightEntry: (value: number, note?: string) => void;
  addWaistEntry: (value: number, note?: string) => void;
  removeWaterEntry: (id: string) => void;
  removeWeightEntry: (id: string) => void;
  removeWaistEntry: (id: string) => void;
  setDailyWaterGoal: (goal: number) => void;
  setWeightUnit: (unit: 'kg' | 'lbs') => void;
  setGoals: (goals: HealthGoals) => void;
  setWaterReminder: (settings: WaterReminderSettings) => void;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const DEFAULT_STATE = {
  waterEntries: [],
  weightEntries: [],
  waistEntries: [],
  dailyWaterGoal: 2000,
  weightUnit: 'kg' as const,
  goals: {},
  waterReminder: { enabled: false, intervalMinutes: 60, startHour: 7, endHour: 22 },
  _userId: null as string | null,
};

function loadHealthLocal(userId: string) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.goals) parsed.goals = {};
      if (!parsed.waterReminder) parsed.waterReminder = DEFAULT_STATE.waterReminder;
      if (!parsed._userId) parsed._userId = userId;
      return parsed;
    }
  } catch {}
  return { ...DEFAULT_STATE, _userId: userId };
}

function saveHealthLocal(userId: string, state: Omit<HealthState, 'initForUser' | 'addWaterEntry' | 'addWeightEntry' | 'addWaistEntry' | 'removeWaterEntry' | 'removeWeightEntry' | 'removeWaistEntry' | 'setDailyWaterGoal' | 'setWeightUnit' | 'setGoals' | 'setWaterReminder'>) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(state));
}

// Cloud sync helpers
async function loadHealthFromDB(userId: string) {
  try {
    const { data, error } = await supabase
      .from('health_data')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return {
      waterEntries: data.water_entries || [],
      weightEntries: data.weight_entries || [],
      waistEntries: data.waist_entries || [],
      dailyWaterGoal: data.daily_water_goal || 2000,
      weightUnit: data.weight_unit || 'kg',
      goals: data.goals || {},
      waterReminder: data.water_reminder || DEFAULT_STATE.waterReminder,
    };
  } catch {
    return null;
  }
}

async function saveHealthToDB(userId: string, state: Omit<HealthState, 'initForUser' | 'addWaterEntry' | 'addWeightEntry' | 'addWaistEntry' | 'removeWaterEntry' | 'removeWeightEntry' | 'removeWaistEntry' | 'setDailyWaterGoal' | 'setWeightUnit' | 'setGoals' | 'setWaterReminder'>) {
  try {
    await supabase.from('health_data').upsert({
      user_id: userId,
      water_entries: state.waterEntries,
      weight_entries: state.weightEntries,
      waist_entries: state.waistEntries,
      daily_water_goal: state.dailyWaterGoal,
      weight_unit: state.weightUnit,
      goals: state.goals,
      water_reminder: state.waterReminder,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch (e) {
    console.error('[HealthStore] saveHealthToDB error:', e);
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(userId: string, getState: () => HealthState, state: Partial<Omit<HealthState, 'initForUser' | 'addWaterEntry' | 'addWeightEntry' | 'addWaistEntry' | 'removeWaterEntry' | 'removeWeightEntry' | 'removeWaistEntry' | 'setDailyWaterGoal' | 'setWeightUnit' | 'setGoals' | 'setWaterReminder'>>) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    const currentState = getState();
    const newState = { ...currentState, ...state };
    const dataToSave = {
      waterEntries: newState.waterEntries,
      weightEntries: newState.weightEntries,
      waistEntries: newState.waistEntries,
      dailyWaterGoal: newState.dailyWaterGoal,
      weightUnit: newState.weightUnit,
      goals: newState.goals,
      waterReminder: newState.waterReminder,
      _userId: newState._userId,
    };
    saveHealthLocal(userId, dataToSave);
    if (userId !== 'admin') saveHealthToDB(userId, dataToSave);
  }, 800);
}

export const useHealthStore = create<HealthState>((set, get) => ({
  ...DEFAULT_STATE,
  _userId: null,

  initForUser: (userId = 'admin') => {
    set({ _userId: userId });
    
    // Try to load from DB first, then fallback to local
    if (userId !== 'admin') {
      loadHealthFromDB(userId).then(dbData => {
        if (dbData) {
          set({ ...dbData, _userId: userId });
          saveHealthLocal(userId, { ...dbData, _userId: userId });
        } else {
          // Load from local as fallback
          const localData = loadHealthLocal(userId);
          set(localData);
        }
      });
    } else {
      const localData = loadHealthLocal(userId);
      set(localData);
    }
  },

  addWaterEntry: (amount: number) => {
    const userId = get()._userId || 'admin';
    const now = Date.now();
    const today = getTodayStr();
    const newEntry: WaterEntry = {
      id: genId(),
      amount,
      timestamp: now,
      date: today,
    };
    
    const updated = [...get().waterEntries, newEntry];
    set({ waterEntries: updated });
    debouncedSave(userId, get, { waterEntries: updated });
  },

  addWeightEntry: (value: number, note?: string) => {
    const userId = get()._userId || 'admin';
    const now = Date.now();
    const today = getTodayStr();
    const newEntry: WeightEntry = {
      id: genId(),
      value,
      timestamp: now,
      date: today,
      note,
    };
    
    const updated = [...get().weightEntries, newEntry];
    set({ weightEntries: updated });
    debouncedSave(userId, get, { weightEntries: updated });
  },

  addWaistEntry: (value: number, note?: string) => {
    const userId = get()._userId || 'admin';
    const now = Date.now();
    const today = getTodayStr();
    const newEntry: WaistEntry = {
      id: genId(),
      value,
      timestamp: now,
      date: today,
      note,
    };
    
    const updated = [...get().waistEntries, newEntry];
    set({ waistEntries: updated });
    debouncedSave(userId, get, { waistEntries: updated });
  },

  removeWaterEntry: (id: string) => {
    const userId = get()._userId || 'admin';
    const updated = get().waterEntries.filter(e => e.id !== id);
    set({ waterEntries: updated });
    debouncedSave(userId, get, { waterEntries: updated });
  },

  removeWeightEntry: (id: string) => {
    const userId = get()._userId || 'admin';
    const updated = get().weightEntries.filter(e => e.id !== id);
    set({ weightEntries: updated });
    debouncedSave(userId, get, { weightEntries: updated });
  },

  removeWaistEntry: (id: string) => {
    const userId = get()._userId || 'admin';
    const updated = get().waistEntries.filter(e => e.id !== id);
    set({ waistEntries: updated });
    debouncedSave(userId, get, { waistEntries: updated });
  },

  setDailyWaterGoal: (goal: number) => {
    const userId = get()._userId || 'admin';
    set({ dailyWaterGoal: goal });
    debouncedSave(userId, get, { dailyWaterGoal: goal });
  },

  setWeightUnit: (unit: 'kg' | 'lbs') => {
    const userId = get()._userId || 'admin';
    set({ weightUnit: unit });
    debouncedSave(userId, get, { weightUnit: unit });
  },

  setGoals: (goals: HealthGoals) => {
    const userId = get()._userId || 'admin';
    set({ goals });
    debouncedSave(userId, get, { goals });
  },

  setWaterReminder: (settings: WaterReminderSettings) => {
    const userId = get()._userId || 'admin';
    set({ waterReminder: settings });
    debouncedSave(userId, get, { waterReminder: settings });
  },
}));
