import { create } from 'zustand';
import type { 
  NotificationSettings, 
  VoiceSettings, 
  ThemeMode 
} from '@/types';

interface SettingsState {
  notifications: NotificationSettings;
  voice: VoiceSettings;
  theme: ThemeMode;
  timezone: string;
  dailyTimeCost: number;
  pomodoroTime: number;
  shortBreakTime: number;
  longBreakTime: number;
  autoStartBreak: boolean;
  // Actions
  updateSettings: (settings: Partial<SettingsState>) => void;
}

const DEFAULT_SETTINGS: SettingsState = {
  notifications: {
    enabled: true,
    sound: true,
    vibration: true,
    desktop: true,
  },
  voice: {
    enabled: true,
    rate: 1,
    pitch: 1,
    volume: 1,
  },
  theme: 'auto',
  timezone: 'Asia/Ho_Chi_Minh',
  dailyTimeCost: 200000,
  pomodoroTime: 25,
  shortBreakTime: 5,
  longBreakTime: 15,
  autoStartBreak: false,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,

  updateSettings: (updates) => {
    set(updates);
    // Save to localStorage
    try {
      localStorage.setItem('nw_settings', JSON.stringify({ ...get(), ...updates }));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },
}));

// Initialize settings from localStorage
try {
  const saved = localStorage.getItem('nw_settings');
  if (saved) {
    const parsed = JSON.parse(saved);
    useSettingsStore.setState(parsed);
  }
} catch (error) {
  console.error('Failed to load settings:', error);
}
