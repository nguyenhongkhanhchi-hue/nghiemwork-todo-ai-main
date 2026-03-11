import { create } from 'zustand';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import type { PageType, NotificationSettings, VoiceSettings, ThemeMode } from '@/types';
import { DEFAULT_VOICE_SETTINGS } from '@/types';

interface SettingsState {
  currentPage: PageType;
  fontScale: number;
  timezone: string;
  screenBrightness: number;
  lockTouch: boolean;
  notificationSettings: NotificationSettings;
  voiceSettings: VoiceSettings;
  theme: ThemeMode;
  dailyTimeCost: number;
  // Actions
  setCurrentPage: (page: PageType) => void;
  setFontScale: (scale: number) => void;
  setTimezone: (tz: string) => void;
  setScreenBrightness: (brightness: number) => void;
  setLockTouch: (lock: boolean) => void;
  setNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  setVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  setTheme: (theme: ThemeMode) => void;
  setDailyTimeCost: (cost: number) => void;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  beforeDeadline: 15,
  dailyReminder: false,
  dailyReminderTime: '09:00',
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  // Load initial state from localStorage
  const savedSettings = loadFromStorage('nw_settings', {});
  
  return {
    currentPage: savedSettings.currentPage || 'tasks',
    fontScale: savedSettings.fontScale || 1,
    timezone: savedSettings.timezone || 'Asia/Ho_Chi_Minh',
    screenBrightness: savedSettings.screenBrightness || 100,
    lockTouch: savedSettings.lockTouch || false,
    notificationSettings: savedSettings.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS,
    voiceSettings: savedSettings.voiceSettings || DEFAULT_VOICE_SETTINGS,
    theme: savedSettings.theme || 'dark',
    dailyTimeCost: savedSettings.dailyTimeCost || 200000,

    setCurrentPage: (page) => {
      set({ currentPage: page });
      saveToStorage('nw_settings', { ...get(), currentPage: page });
    },

    setFontScale: (scale) => {
      set({ fontScale: scale });
      const settings = get();
      saveToStorage('nw_settings', { ...settings, fontScale: scale });
    },

    setTimezone: (tz) => {
      set({ timezone: tz });
      const settings = get();
      saveToStorage('nw_settings', { ...settings, timezone: tz });
    },

    setScreenBrightness: (brightness) => {
      set({ screenBrightness: brightness });
      const settings = get();
      saveToStorage('nw_settings', { ...settings, screenBrightness: brightness });
    },

    setLockTouch: (lock) => {
      set({ lockTouch: lock });
      const settings = get();
      saveToStorage('nw_settings', { ...settings, lockTouch: lock });
    },

    setNotificationSettings: (settings) => {
      const updated = { ...get().notificationSettings, ...settings };
      set({ notificationSettings: updated });
      const currentSettings = get();
      saveToStorage('nw_settings', { ...currentSettings, notificationSettings: updated });
    },

    setVoiceSettings: (settings) => {
      const updated = { ...get().voiceSettings, ...settings };
      set({ voiceSettings: updated });
      const currentSettings = get();
      saveToStorage('nw_settings', { ...currentSettings, voiceSettings: updated });
    },

    setTheme: (theme) => {
      set({ theme });
      const settings = get();
      saveToStorage('nw_settings', { ...settings, theme });
    },

    setDailyTimeCost: (cost) => {
      set({ dailyTimeCost: cost });
      const settings = get();
      saveToStorage('nw_settings', { ...settings, dailyTimeCost: cost });
    },
  };
});

// Also export as alias for compatibility
export const useSettingsStore2 = useSettingsStore;
