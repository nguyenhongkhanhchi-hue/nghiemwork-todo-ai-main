import { getNowInTimezone, sendNotification, speakNotification, canSendNotification } from '@/lib/notifications';
import type { Task } from '@/types';

// Auto reminder intervals (in minutes before deadline)
const AUTO_REMINDER_INTERVALS = [60, 30, 10]; // 1 tiếng, 30 phút, 10 phút

interface ReminderState {
  lastCheck: number;
  notifiedTasks: Set<string>;
}

// Global reminder state
let reminderState: ReminderState = {
  lastCheck: 0,
  notifiedTasks: new Set()
};

/**
 * Check and send auto reminders for tasks with deadlines
 */
export function checkAutoReminders(tasks: Task[], timezone: string): void {
  if (!canSendNotification()) return;

  const now = getNowInTimezone(timezone).getTime();
  
  // Check every minute
  if (now - reminderState.lastCheck < 60000) return;
  reminderState.lastCheck = now;

  tasks.forEach(task => {
    // Skip completed tasks and tasks without deadlines
    if (task.status === 'done' || !task.deadline) return;

    const timeUntil = task.deadline - now;

    // Check each reminder interval
    AUTO_REMINDER_INTERVALS.forEach(minutesBefore => {
      const reminderKey = `${task.id}_${minutesBefore}`;
      const triggerTime = task.deadline - (minutesBefore * 60 * 1000);
      
      // Send reminder if we're within the reminder window
      if (
        now >= triggerTime && 
        now <= triggerTime + 60000 && // Within 1 minute window
        timeUntil > 0 && // Not overdue yet
        !reminderState.notifiedTasks.has(reminderKey)
      ) {
        sendAutoReminder(task, minutesBefore, timeUntil);
        reminderState.notifiedTasks.add(reminderKey);
      }
    });

    // Clean up old notifications for this task
    cleanupOldNotifications(task);
  });
}

/**
 * Send auto reminder notification
 */
function sendAutoReminder(task: Task, minutesBefore: number, timeUntil: number): void {
  const minsLeft = Math.ceil(timeUntil / 60000);
  const timeText = minutesBefore === 1 ? '1 tiếng' : `${minutesBefore} phút`;
  
  // Send notification
  sendNotification(
    `⏰ Nhắc nhở: ${task.title}`,
    `Còn khoảng ${timeText} nữa là hết hạn! (${minsLeft} phút còn lại)`,
    `reminder-${task.id}-${minutesBefore}`
  );

  // Speak notification
  speakNotification(`Nhắc nhở, việc ${task.title} sẽ hết hạn trong ${timeText}`);
}

/**
 * Clean up old notifications for a task
 */
function cleanupOldNotifications(task: Task): void {
  const now = Date.now();
  
  AUTO_REMINDER_INTERVALS.forEach(minutesBefore => {
    const reminderKey = `${task.id}_${minutesBefore}`;
    const triggerTime = task.deadline - (minutesBefore * 60 * 1000);
    
    // Remove notification if we're past the reminder window by more than 5 minutes
    if (now > triggerTime + 300000) { // 5 minutes after reminder window
      reminderState.notifiedTasks.delete(reminderKey);
    }
  });
}

/**
 * Reset reminder state (call when user logs out or data changes)
 */
export function resetReminderState(): void {
  reminderState = {
    lastCheck: 0,
    notifiedTasks: new Set()
  };
}

/**
 * Initialize auto reminders system
 */
export function initAutoReminders(): void {
  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  resetReminderState();
}
