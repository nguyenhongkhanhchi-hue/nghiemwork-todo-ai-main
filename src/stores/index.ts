import { create } from 'zustand';
import type { 
  Task, ChatMessage, TimerState, ActiveTimer, TabType, PageType,
  EisenhowerQuadrant, RecurringConfig, UserProfile,
  GamificationState, NotificationSettings, Reward,
  TaskTemplate, TaskFinance, Achievement, Topic, VoiceSettings,
  TaskCategory, ThemeMode, TimeLog, TimeLogType,
} from '@/types';
import { DEFAULT_VOICE_SETTINGS } from '@/types';
import { calculateLevel, checkAchievement, getDefaultGamificationState } from '@/lib/gamification';
import { getNowInTimezone } from '@/lib/notifications';
import { calculateQuadrant, isTaskOverdue, updateTaskQuadrant } from '@/lib/autoQuadrant';
import { checkAutoReminders, initAutoReminders } from '@/lib/autoReminders';
import { checkAutoTimerStart, initAutoTimers } from '@/lib/autoTimer';
import { toast } from '@/lib/toast';
import {
  playTaskCreatedSound,
  playTaskDeleteSound,
  playTimerStartSound,
  playTimerPauseSound,
  playTimerFinishSound,
  playTaskCelebrationSound,
} from '@/lib/soundEffects';
import {
  loadTasksFromDB, saveTasksToDB,
  loadTemplatesFromDB, saveTemplatesToDB,
  loadTopicsFromDB, saveTopicsFromDB,
  loadGamificationFromDB, saveGamificationToDB,
} from '@/lib/db';
import { loadFromStorage, saveToStorage, getUserKey } from '@/lib/storage';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTimeLogStore } from '@/stores/timeLogStore';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ──────────── TASK STORE ────────────
interface TaskStore {
  tasks: Task[];
  activeTab: TabType;
  timer: TimerState;
  timers: ActiveTimer[];
  _userId: string | undefined;
  _version: number;
  // Actions
  initForUser: (userId?: string) => Promise<void>;
  setActiveTab: (tab: TabType) => void;
  addTask: (title: string, manualQuadrant?: EisenhowerQuadrant, deadline?: number, recurring?: RecurringConfig, deadlineDate?: string, deadlineTime?: string, finance?: TaskFinance, templateId?: string, isGroup?: boolean, opts?: Partial<Task>) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  completeTask: (id: string) => void;
  restoreTask: (id: string) => void;
  reorderTasks: (fromIndex: number, toIndex: number) => void;
  startTimer: (taskId: string) => void;
  pauseTimer: (taskId: string) => void;
  resumeTimer: (taskId: string) => void;
  stopTimer: (taskId: string) => void;
  tickTimer: () => void;
  clearAllData: () => void;
  checkAndMarkOverdue: () => void;
  cleanupOldCompletedTasks: () => void;
  checkAutoReminders: () => void;
  checkAutoTimerStart: () => void;
  bumpVersion: () => void;
}

const defaultTimer: TimerState = {
  taskId: null, isRunning: false, isPaused: false, elapsed: 0,
  startTime: null, pausedAt: null, totalPausedDuration: 0,
};

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  activeTab: 'pending',
  timer: { ...defaultTimer },
  timers: [],
  _userId: undefined,
  _version: 0,

  initForUser: async (userId) => {
    set({ _userId: userId });
    const key = getUserKey('nw_tasks', userId);
    let tasks = loadFromStorage<Task[]>(key, []);
    let restoredTimers: ActiveTimer[] = [];
    const timerKey = getUserKey('nw_timers', userId);
    const savedTimers = loadFromStorage<ActiveTimer[]>(timerKey, []);
    if (savedTimers.length > 0) {
      restoredTimers = savedTimers;
    } else {
      const legacySavedTimer = loadFromStorage<TimerState>(getUserKey('nw_timer', userId), defaultTimer);
      if (legacySavedTimer.taskId) {
        restoredTimers = [{ ...legacySavedTimer, taskId: legacySavedTimer.taskId! }];
      }
    }
    set({ tasks, _userId: userId, timers: restoredTimers });
    get().checkAndMarkOverdue();
    get().cleanupOldCompletedTasks();
    
    // Initialize auto reminders
    initAutoReminders();
    
    // Initialize auto timers
    initAutoTimers();
    
    // Set up interval to check reminders every minute
    const reminderInterval = setInterval(() => {
      get().checkAutoReminders();
    }, 60000);
    
    // Set up interval to check auto timers every 30 seconds
    const timerInterval = setInterval(() => {
      get().checkAutoTimerStart();
    }, 30000);
    
    // Store interval IDs for cleanup (optional)
    (window as any)._reminderInterval = reminderInterval;
    (window as any)._timerInterval = timerInterval;
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  bumpVersion: () => set(s => ({ _version: s._version + 1 })),

  addTask: (title, manualQuadrant, deadline, recurring = { type: 'none' }, deadlineDate, deadlineTime, finance, templateId, isGroup, opts) => {
    const tasks = get().tasks;
    const userId = get()._userId;
    const id = generateId();
    
    const quadrant = calculateQuadrant(deadline, opts?.importance || 'medium', manualQuadrant);
    
    // Build reminder objects if reminderSettings provided
    let reminders: import('@/types').Reminder[] | undefined;
    if (opts?.reminderSettings?.enabled && deadline) {
      const { minutesBefore, repeatTimes, repeatInterval } = opts.reminderSettings;
      const triggerTime = deadline - minutesBefore * 60 * 1000;
      reminders = Array.from({ length: repeatTimes }, (_, i) => ({
        id: generateId(),
        taskId: id,
        triggerTime: triggerTime + (i * repeatInterval * 1000),
        sent: false,
        type: 'deadline' as const,
      }));
    }

    const newTask: Task = {
      id,
      title,
      status: 'pending',
      quadrant,
      createdAt: Date.now(),
      deadline,
      recurring,
      deadlineDate,
      deadlineTime,
      finance,
      templateId,
      isGroup,
      reminders,
      startTime: opts?.startTime,
      estimatedDuration: opts?.estimatedDuration,
      importance: opts?.importance,
    };

    const updated = [...tasks, newTask];
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    playTaskCreatedSound();
    return id;
  },

  updateTask: (id, updates) => {
    const userId = get()._userId;
    const updated = get().tasks.map(t => (t.id === id ? { ...t, ...updates } : t));
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
  },

  removeTask: (id) => {
    const userId = get()._userId;
    const updated = get().tasks.filter(t => t.id !== id);
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    playTaskDeleteSound();
  },

  completeTask: (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;
    const userId = get()._userId;
    const tz = useSettingsStore.getState().timezone;
    const now = getNowInTimezone(tz).getTime();
    const isOnTime = !task.deadline || now <= task.deadline;
    const xpEarned = isOnTime ? 10 : 5;

    // Save elapsed time from active timer before completing
    const activeTimer = get().timers.find(t => t.taskId === id);
    let elapsedExtra = 0;
    if (activeTimer) {
      if (activeTimer.isRunning && !activeTimer.isPaused && activeTimer.startTime) {
        elapsedExtra = Math.floor((Date.now() - activeTimer.startTime) / 1000) - activeTimer.totalPausedDuration;
      } else {
        elapsedExtra = activeTimer.elapsed;
      }
      elapsedExtra = Math.max(0, elapsedExtra);
    }

    const updated = get().tasks.map(t =>
      t.id === id ? {
        ...t,
        status: 'done' as const,
        completedAt: Date.now(),
        duration: (t.duration || 0) + elapsedExtra,
        deadline: undefined,
        deadlineDate: undefined,
        deadlineTime: undefined,
        timeCost: ((t.duration || 0) + elapsedExtra) * (useSettingsStore.getState().dailyTimeCost / 3600),
      } : t
    );

    // Log time if there was an active timer
    if (activeTimer && elapsedExtra > 0) {
      const nowDate = getNowInTimezone(tz);
      const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
      useTimeLogStore.getState().addTimeLog({
        type: 'activity',
        title: task.title,
        startTime: activeTimer.startTime || (Date.now() - elapsedExtra * 1000),
        endTime: Date.now(),
        duration: elapsedExtra,
        date: todayStr,
        taskId: task.id
      });
    }

    saveToStorage(getUserKey('nw_tasks', userId), updated);
    const newTimers = get().timers.filter(t => t.taskId !== id);
    saveToStorage(getUserKey('nw_timers', userId), newTimers);
    set({ tasks: updated, timers: newTimers });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    useGamificationStore.getState().onTaskCompleted(task.quadrant, task.duration || 0, tz, xpEarned);
    playTaskCelebrationSound();
  },

  restoreTask: (id) => {
    const userId = get()._userId;
    const updated = get().tasks.map(t =>
      t.id === id ? { ...t, status: 'pending' as const } : t
    );
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
  },

  reorderTasks: (fromIndex, toIndex) => {
    const userId = get()._userId;
    const pending = get().tasks.filter(t => t.status === 'pending');
    const [moved] = pending.splice(fromIndex, 1);
    pending.splice(toIndex, 0, moved);
    const rest = get().tasks.filter(t => t.status !== 'pending');
    const updated = [...pending, ...rest];
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    set({ tasks: updated });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
  },

  startTimer: (taskId) => {
    const userId = get()._userId;
    const existingTimer = get().timers.find(t => t.taskId === taskId);
    if (existingTimer) {
      toast('Timer đã chạy cho việc này');
      return;
    }

    const newTimer: ActiveTimer = {
      taskId,
      isRunning: true,
      isPaused: false,
      elapsed: 0,
      startTime: Date.now(),
      pausedAt: null,
      totalPausedDuration: 0,
    };

    const newTimers = [...get().timers, newTimer];
    const updatedTasks = get().tasks.map(t =>
      t.id === taskId ? { ...t, status: 'in_progress' as const } : t
    );

    saveToStorage(getUserKey('nw_timers', userId), newTimers);
    saveToStorage(getUserKey('nw_tasks', userId), updatedTasks);
    set({ timers: newTimers, tasks: updatedTasks });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updatedTasks);
    playTimerStartSound();
  },

  pauseTimer: (taskId) => {
    const userId = get()._userId;
    const timer = get().timers.find(t => t.taskId === taskId);
    if (!timer || !timer.isRunning) return;

    const elapsed = timer.elapsed + Math.floor((Date.now() - timer.startTime) / 1000) - timer.totalPausedDuration;
    const updatedTimer = {
      ...timer,
      isRunning: false,
      isPaused: true,
      elapsed,
      pausedAt: Date.now(),
    };

    const newTimers = get().timers.map(t => t.taskId === taskId ? updatedTimer : t);
    const updatedTasks = get().tasks.map(t =>
      t.id === taskId ? { ...t, status: 'paused' as const } : t
    );

    saveToStorage(getUserKey('nw_timers', userId), newTimers);
    saveToStorage(getUserKey('nw_tasks', userId), updatedTasks);
    set({ timers: newTimers, tasks: updatedTasks });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updatedTasks);
    playTimerPauseSound();
  },

  resumeTimer: (taskId) => {
    const userId = get()._userId;
    const timer = get().timers.find(t => t.taskId === taskId);
    if (!timer || !timer.isPaused) return;

    const pauseDuration = timer.pausedAt ? Math.floor((Date.now() - timer.pausedAt) / 1000) : 0;
    const updatedTimer = {
      ...timer,
      isRunning: true,
      isPaused: false,
      totalPausedDuration: timer.totalPausedDuration + pauseDuration,
      pausedAt: null,
    };

    const newTimers = get().timers.map(t => t.taskId === taskId ? updatedTimer : t);
    const updatedTasks = get().tasks.map(t =>
      t.id === taskId ? { ...t, status: 'in_progress' as const } : t
    );

    saveToStorage(getUserKey('nw_timers', userId), newTimers);
    saveToStorage(getUserKey('nw_tasks', userId), updatedTasks);
    set({ timers: newTimers, tasks: updatedTasks });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updatedTasks);
  },

  stopTimer: (taskId) => {
    const t = get().timers.find(timer => timer.taskId === taskId);
    if (!t) return;
    const userId = get()._userId;
    let elapsed = 0;
    if (t.isRunning && !t.isPaused && t.startTime) {
      elapsed = Math.floor((Date.now() - t.startTime) / 1000) - t.totalPausedDuration;
    } else {
      elapsed = t.elapsed;
    }
    elapsed = Math.max(0, elapsed);

    const updated = get().tasks.map(tk => {
      if (tk.id === taskId) {
        const newDuration = (tk.duration || 0) + elapsed;
        const newStatus = tk.status === 'in_progress' ? 'paused' as const : tk.status;
        return { ...tk, duration: newDuration, status: newStatus };
      }
      return tk;
    });
    const newTimers = get().timers.filter(timer => timer.taskId !== taskId);
    saveToStorage(getUserKey('nw_tasks', userId), updated);
    saveToStorage(getUserKey('nw_timers', userId), newTimers);
    set({ tasks: updated, timers: newTimers });
    if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    playTimerFinishSound();
  },

  tickTimer: () => {
    const currentTimers = get().timers;
    const runningTimers = currentTimers.filter(t => t.isRunning && t.startTime && !t.isPaused);
    if (runningTimers.length === 0) return;

    const userId = get()._userId;
    const now = Date.now();
    const updatedTimers = currentTimers.map(timer => {
      if (timer.isRunning && !timer.isPaused && timer.startTime) {
        return { ...timer, elapsed: Math.floor((now - timer.startTime) / 1000) - timer.totalPausedDuration };
      }
      return timer;
    });

    saveToStorage(getUserKey('nw_timers', userId), updatedTimers);
    set({ timers: updatedTimers });
  },

  clearAllData: () => {
    const userId = get()._userId;
    if (!userId) return;
    saveToStorage(getUserKey('nw_tasks', userId), []);
    saveToStorage(getUserKey('nw_timers', userId), []);
    set({ tasks: [], timers: [] });
    if (userId && userId !== 'admin') saveTasksToDB(userId, []);
  },

  checkAndMarkOverdue: () => {
    const userId = get()._userId;
    const tz = useSettingsStore.getState().timezone;
    let changed = false;
    
    const updated = get().tasks.map(t => {
      const newQuadrant = updateTaskQuadrant(t);
      
      if (newQuadrant !== t.quadrant) {
        changed = true;
        return { ...t, quadrant: newQuadrant };
      }
      
      return t;
    });
    
    if (changed) {
      saveToStorage(getUserKey('nw_tasks', userId), updated);
      set({ tasks: updated });
      if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    }
  },

  cleanupOldCompletedTasks: () => {
    const userId = get()._userId;
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    
    const updated = get().tasks.filter(t => {
      return t.status !== 'done' || (t.completedAt && t.completedAt > threeDaysAgo);
    });
    
    if (updated.length < get().tasks.length) {
      saveToStorage(getUserKey('nw_tasks', userId), updated);
      set({ tasks: updated });
      if (userId && userId !== 'admin') saveTasksToDB(userId, updated);
    }
  },

  checkAutoReminders: () => {
    const tasks = get().tasks;
    const timezone = useSettingsStore.getState().timezone;
    checkAutoReminders(tasks, timezone);
  },

  checkAutoTimerStart: () => {
    const tasks = get().tasks;
    const timers = get().timers;
    const timezone = useSettingsStore.getState().timezone;
    checkAutoTimerStart(tasks, timezone, get().startTimer, timers);
  },
}));

// ──────────── TOPIC STORE ────────────
interface TopicStore {
  topics: Topic[];
  _userId: string | undefined;
  initForUser: (userId?: string) => void;
  addTopic: (name: string) => string;
  removeTopic: (id: string) => void;
  addTopicParam: (topicId: string, paramName: string) => void;
  removeTopicParam: (topicId: string, paramName: string) => void;
}

export const useTopicStore = create<TopicStore>((set, get) => ({
  topics: [],
  _userId: undefined,

  initForUser: (userId = 'admin') => {
    set({ _userId: userId });
    const key = getUserKey('nw_topics', userId);
    const topics = loadFromStorage<Topic[]>(key, []);
    set({ topics });
  },

  addTopic: (name) => {
    const userId = get()._userId;
    const id = generateId();
    const newTopic: Topic = { id, name, params: [] };
    const updated = [...get().topics, newTopic];
    saveToStorage(getUserKey('nw_topics', userId), updated);
    set({ topics: updated });
    return id;
  },

  removeTopic: (id) => {
    const userId = get()._userId;
    const updated = get().topics.filter(t => t.id !== id);
    saveToStorage(getUserKey('nw_topics', userId), updated);
    set({ topics: updated });
  },

  addTopicParam: (topicId, paramName) => {
    const userId = get()._userId;
    const updated = get().topics.map(topic => {
      if (topic.id === topicId) {
        return {
          ...topic,
          params: [...topic.params, { id: generateId(), name, value: '' }]
        };
      }
      return topic;
    });
    saveToStorage(getUserKey('nw_topics', userId), updated);
    set({ topics: updated });
  },

  removeTopicParam: (topicId, paramName) => {
    const userId = get()._userId;
    const updated = get().topics.map(topic => {
      if (topic.id === topicId) {
        return {
          ...topic,
          params: topic.params.filter(p => p.name !== paramName)
        };
      }
      return topic;
    });
    saveToStorage(getUserKey('nw_topics', userId), updated);
    set({ topics: updated });
  },
}));

// ──────────── USER STORE ────────────
interface UserStore {
  user: UserProfile | null;
  initUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,

  initUser: async () => {
    try {
      const { data: { session } } = await import('@/lib/supabase').then(({ supabase }) => 
        supabase.auth.getSession()
      );
      if (session?.user) {
        const profile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || '',
          avatar: session.user.user_metadata?.avatar || '',
          timezone: session.user.user_metadata?.timezone || 'Asia/Ho_Chi_Minh',
          dailyTimeCost: session.user.user_metadata?.dailyTimeCost || 200000,
          voiceSettings: session.user.user_metadata?.voiceSettings || DEFAULT_VOICE_SETTINGS,
          theme: (session.user.user_metadata?.theme || 'auto') as ThemeMode,
        };
        set({ user: profile });
      }
    } catch (error) {
      console.error('Failed to init user:', error);
    }
  },

  login: async (email, password) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast(error.message);
        return false;
      }
      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.name || '',
          avatar: data.user.user_metadata?.avatar || '',
          timezone: data.user.user_metadata?.timezone || 'Asia/Ho_Chi_Minh',
          dailyTimeCost: data.user.user_metadata?.dailyTimeCost || 200000,
          voiceSettings: data.user.user_metadata?.voiceSettings || DEFAULT_VOICE_SETTINGS,
          theme: (data.user.user_metadata?.theme || 'auto') as ThemeMode,
        };
        set({ user: profile });
        return true;
      }
    } catch (error) {
      toast('Đăng nhập thất bại');
      return false;
    }
    return false;
  },

  register: async (email, password) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            name: email.split('@')[0],
            timezone: 'Asia/Ho_Chi_Minh',
            dailyTimeCost: 200000,
            voiceSettings: DEFAULT_VOICE_SETTINGS,
            theme: 'auto' as ThemeMode,
          }
        }
      });
      if (error) {
        toast(error.message);
        return false;
      }
      if (data.user) {
        toast('Đăng ký thành công!');
        return true;
      }
    } catch (error) {
      toast('Đăng ký thất bại');
      return false;
    }
    return false;
  },

  logout: () => {
    localStorage.setItem('nw_signed_out', 'true');
    localStorage.removeItem('nw_admin_session');
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();
    } catch {}
    set({ user: null });
  },

  updateProfile: (updates) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    set({ user: updated });
    try {
      import('@/lib/supabase').then(({ supabase }) => {
        supabase.auth.updateUser({
          data: updates
        });
      });
    } catch {}
  },
}));

// ──────────── GAMIFICATION STORE ────────────
import { useGamificationStore } from '@/stores/gamificationStore';
export { useGamificationStore };

// ──────────── TEMPLATE STORE ────────────
interface TemplateStore {
  templates: TaskTemplate[];
  _userId: string | undefined;
  initForUser: (userId?: string) => void;
  addTemplate: (template: Omit<TaskTemplate, 'id'>) => string;
  updateTemplate: (id: string, updates: Partial<TaskTemplate>) => void;
  removeTemplate: (id: string) => void;
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],
  _userId: undefined,

  initForUser: async (userId = 'admin') => {
    set({ _userId: userId });
    const key = getUserKey('nw_templates', userId);
    let templates = loadFromStorage<TaskTemplate[]>(key, []);
    
    // Try to load from DB for non-admin users
    if (userId !== 'admin') {
      try {
        const dbTemplates = await loadTemplatesFromDB(userId);
        if (dbTemplates && dbTemplates.length > 0) {
          templates = dbTemplates;
          saveToStorage(key, templates);
        }
      } catch {}
    }
    
    set({ templates });
  },

  addTemplate: (template) => {
    const userId = get()._userId;
    const id = generateId();
    const newTemplate = { ...template, id };
    const updated = [...get().templates, newTemplate];
    saveToStorage(getUserKey('nw_templates', userId), updated);
    set({ templates: updated });
    if (userId && userId !== 'admin') saveTemplatesToDB(userId, updated);
    return id;
  },

  updateTemplate: (id, updates) => {
    const userId = get()._userId;
    const updated = get().templates.map(t => (t.id === id ? { ...t, ...updates } : t));
    saveToStorage(getUserKey('nw_templates', userId), updated);
    set({ templates: updated });
    if (userId && userId !== 'admin') saveTemplatesToDB(userId, updated);
  },

  removeTemplate: (id) => {
    const userId = get()._userId;
    const updated = get().templates.filter(t => t.id !== id);
    saveToStorage(getUserKey('nw_templates', userId), updated);
    set({ templates: updated });
    if (userId && userId !== 'admin') saveTemplatesToDB(userId, updated);
  },
}));

// Export health store
export { useHealthStore } from './healthStore';
