import { getNowInTimezone, sendNotification, speakNotification } from '@/lib/notifications';
import type { Task } from '@/types';

interface AutoTimerState {
  lastCheck: number;
  startedTasks: Set<string>;
}

// Global auto timer state
let autoTimerState: AutoTimerState = {
  lastCheck: 0,
  startedTasks: new Set()
};

/**
 * Check and auto-start timers for tasks with startTime
 */
export function checkAutoTimerStart(tasks: Task[], timezone: string, startTimer: (taskId: string) => void, timers: any[]): void {
  const now = getNowInTimezone(timezone).getTime();
  
  // Check every 30 seconds
  if (now - autoTimerState.lastCheck < 30000) return;
  autoTimerState.lastCheck = now;

  tasks.forEach(task => {
    // Skip tasks without startTime, completed tasks, or already started
    if (!task.startTime || task.status === 'done' || autoTimerState.startedTasks.has(task.id)) {
      return;
    }

    const taskStartTime = task.startTime;
    const timeUntilStart = taskStartTime - now;

    // Auto-start timer if we're within 1 minute of start time
    if (
      timeUntilStart >= 0 && 
      timeUntilStart <= 60000 && // Within 1 minute after start time
      !isTimerActive(task.id, timers) // No active timer for this task
    ) {
      autoStartTaskTimer(task, startTimer);
      autoTimerState.startedTasks.add(task.id);
    }

    // Clean up old entries for tasks that are far past their start time
    if (timeUntilStart < -300000) { // More than 5 minutes past start time
      autoTimerState.startedTasks.delete(task.id);
    }
  });
}

/**
 * Auto-start timer for a task
 */
function autoStartTaskTimer(task: Task, startTimer: (taskId: string) => void): void {
  // Start the timer
  startTimer(task.id);
  
  // Send notification
  sendNotification(
    `⏰ Bắt đầu tự động: ${task.title}`,
    `Đã đến thời gian bắt đầu việc!`,
    `auto-start-${task.id}`
  );

  // Speak notification
  speakNotification(`Bắt đầu việc ${task.title}`);
}

/**
 * Check if a task has an active timer
 */
function isTimerActive(taskId: string, timers: any[]): boolean {
  return timers.some(t => t.taskId === taskId && (t.isRunning || t.isPaused));
}

/**
 * Reset auto timer state (call when user logs out or data changes)
 */
export function resetAutoTimerState(): void {
  autoTimerState = {
    lastCheck: 0,
    startedTasks: new Set()
  };
}

/**
 * Initialize auto timer system
 */
export function initAutoTimers(): void {
  resetAutoTimerState();
}
