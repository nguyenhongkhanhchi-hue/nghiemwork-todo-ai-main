// Auto-calculate quadrant based on deadline and importance
import type { EisenhowerQuadrant, Task } from '@/types';

// Get end of today (23:59:59.999)
function getEndOfToday(): number {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.getTime();
}

// Get end of tomorrow (23:59:59.999 tomorrow)
function getEndOfTomorrow(): number {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  now.setHours(23, 59, 59, 999);
  return now.getTime();
}

// Get end of this week (Sunday 23:59:59.999)
function getEndOfWeek(): number {
  const now = new Date();
  const daysUntilSunday = 7 - now.getDay();
  now.setDate(now.getDate() + daysUntilSunday);
  now.setHours(23, 59, 59, 999);
  return now.getTime();
}

/**
 * Calculate quadrant based on deadline and importance using Eisenhower Matrix
 * 
 * Quadrant logic:
 * - DO_FIRST (Urgent + Important): High importance + deadline within 2 days
 * - SCHEDULE (Not Urgent + Important): High/Medium importance + deadline > 2 days
 * - DELEGATE (Urgent + Not Important): Low importance + deadline within 2 days  
 * - ELIMINATE (Not Urgent + Not Important): Low importance + no deadline or deadline > 1 week
 */
export function calculateQuadrant(
  deadline: number | undefined,
  importance: 'high' | 'medium' | 'low' = 'medium',
  manualQuadrant?: 'delegate' | 'eliminate'
): Exclude<EisenhowerQuadrant, 'overdue'> {
  // Manual quadrants take priority
  if (manualQuadrant === 'delegate') return 'delegate';
  if (manualQuadrant === 'eliminate') return 'eliminate';

  const now = Date.now();
  const endOfToday = getEndOfToday();
  const endOfTomorrow = getEndOfTomorrow();
  const endOfWeek = getEndOfWeek();
  const twoDaysFromNow = now + (2 * 24 * 60 * 60 * 1000);

  // Overdue = deadline has passed
  if (deadline && deadline < now) {
    // Quá hạn → ưu tiên cao nhất
    return 'do_first';
  }

  // Calculate urgency based on deadline
  let urgency: 'high' | 'medium' | 'low' = 'low';
  if (deadline) {
    if (deadline <= endOfToday) {
      urgency = 'high'; // Today
    } else if (deadline <= twoDaysFromNow) {
      urgency = 'medium'; // Within 2 days
    } else {
      urgency = 'low'; // More than 2 days
    }
  }

  // Eisenhower Matrix logic
  if (importance === 'high') {
    if (urgency === 'high' || urgency === 'medium') {
      // High + Urgent/Not Urgent = DO FIRST
      return 'do_first';
    } else {
      // High + Low Urgency = SCHEDULE
      return 'schedule';
    }
  } else if (importance === 'medium') {
    if (urgency === 'high') {
      // Medium + High Urgency = DO FIRST
      return 'do_first';
    } else {
      // Medium + Medium/Low Urgency = SCHEDULE
      return 'schedule';
    }
  } else { // importance === 'low'
    if (urgency === 'high') {
      // Low + High Urgency = DELEGATE
      return 'delegate';
    } else if (urgency === 'medium') {
      // Low + Medium Urgency = DELEGATE (if has deadline) or ELIMINATE
      return deadline ? 'delegate' : 'eliminate';
    } else {
      // Low + Low/No Urgency = ELIMINATE
      return 'eliminate';
    }
  }
}

/**
 * Runtime check if task is overdue
 * This is the ONLY way to determine overdue status
 */
export function isTaskOverdue(task: { deadline?: number; status?: string; quadrant?: string }): boolean {
  // Overdue = có deadline + deadline < now + chưa done + không trong thùng rác
  return !!(
    task.deadline && 
    task.deadline < Date.now() &&
    task.status !== 'done' &&
    task.quadrant !== 'eliminate'
  );
}

/**
 * Auto-update task quadrant based on current deadline and importance
 */
export function updateTaskQuadrant(task: Task): EisenhowerQuadrant {
  if (task.quadrant === 'overdue') {
    // Keep overdue status for runtime filter
    return task.quadrant;
  }
  
  const newQuadrant = calculateQuadrant(task.deadline, task.importance);
  return newQuadrant;
}

/**
 * Batch update quadrants for all tasks
 */
export function batchUpdateQuadrants(tasks: Task[]): Task[] {
  return tasks.map(task => ({
    ...task,
    quadrant: updateTaskQuadrant(task)
  }));
}
