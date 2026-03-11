// Database operations using Supabase
import { supabase } from './supabase';
import type { Task, TaskTemplate, Topic, GamificationState } from '@/types';

const TABLE_TASKS = 'tasks';
const TABLE_TEMPLATES = 'templates';
const TABLE_TOPICS = 'topics';
const TABLE_GAMIFICATION = 'gamification';

// Tasks
export async function saveTasksToDB(userId: string, tasks: Task[]): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLE_TASKS)
      .upsert(
        tasks.map(task => ({
          id: task.id,
          user_id: userId,
          title: task.title,
          status: task.status,
          quadrant: task.quadrant,
          created_at: task.createdAt,
          completed_at: task.completedAt,
          deadline: task.deadline,
          deadline_date: task.deadlineDate,
          deadline_time: task.deadlineTime,
          recurring: JSON.stringify(task.recurring),
          finance: task.finance ? JSON.stringify(task.finance) : null,
          template_id: task.templateId,
          is_group: task.isGroup,
          reminders: task.reminders ? JSON.stringify(task.reminders) : null,
          start_time: task.startTime,
          estimated_duration: task.estimatedDuration,
          importance: task.importance,
          duration: task.duration,
          time_cost: task.timeCost,
        })),
        { onConflict: 'id' }
      );
    
    if (error) throw error;
  } catch (error) {
    console.error('Error saving tasks to DB:', error);
  }
}

export async function loadTasksFromDB(userId: string): Promise<Task[] | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE_TASKS)
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    if (!data) return null;
    
    return data.map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
      quadrant: row.quadrant,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      deadline: row.deadline,
      deadlineDate: row.deadline_date,
      deadlineTime: row.deadline_time,
      recurring: row.recurring ? JSON.parse(row.recurring) : { type: 'none' },
      finance: row.finance ? JSON.parse(row.finance) : undefined,
      templateId: row.template_id,
      isGroup: row.is_group,
      reminders: row.reminders ? JSON.parse(row.reminders) : undefined,
      startTime: row.start_time,
      estimatedDuration: row.estimated_duration,
      importance: row.importance,
      duration: row.duration,
      timeCost: row.time_cost,
    }));
  } catch (error) {
    console.error('Error loading tasks from DB:', error);
    return null;
  }
}

// Templates
export async function saveTemplatesToDB(userId: string, templates: TaskTemplate[]): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLE_TEMPLATES)
      .upsert(
        templates.map(template => ({
          id: template.id,
          user_id: userId,
          name: template.name,
          tasks: JSON.stringify(template.tasks),
          category: template.category,
          is_group: template.isGroup,
          created_at: template.createdAt,
        })),
        { onConflict: 'id' }
      );
    
    if (error) throw error;
  } catch (error) {
    console.error('Error saving templates to DB:', error);
  }
}

export async function loadTemplatesFromDB(userId: string): Promise<TaskTemplate[] | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE_TEMPLATES)
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    if (!data) return null;
    
    return data.map(row => ({
      id: row.id,
      name: row.name,
      tasks: JSON.parse(row.tasks || '[]'),
      category: row.category,
      isGroup: row.is_group,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error loading templates from DB:', error);
    return null;
  }
}

// Topics
export async function saveTopicsToDB(userId: string, topics: Topic[]): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLE_TOPICS)
      .upsert(
        topics.map(topic => ({
          id: topic.id,
          user_id: userId,
          name: topic.name,
          params: JSON.stringify(topic.params),
        })),
        { onConflict: 'id' }
      );
    
    if (error) throw error;
  } catch (error) {
    console.error('Error saving topics to DB:', error);
  }
}

export async function loadTopicsFromDB(userId: string): Promise<Topic[] | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE_TOPICS)
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    if (!data) return null;
    
    return data.map(row => ({
      id: row.id,
      name: row.name,
      params: JSON.parse(row.params || '[]'),
    }));
  } catch (error) {
    console.error('Error loading topics from DB:', error);
    return null;
  }
}

// Gamification
export async function saveGamificationToDB(userId: string, gamification: GamificationState): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLE_GAMIFICATION)
      .upsert({
        id: userId,
        user_id: userId,
        xp: gamification.xp,
        level: gamification.level,
        streak: gamification.streak,
        achievements: JSON.stringify(gamification.achievements),
        daily_xp_history: JSON.stringify(gamification.dailyXpHistory),
        last_activity_date: gamification.lastActivityDate,
      }, { onConflict: 'id' });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error saving gamification to DB:', error);
  }
}

export async function loadGamificationFromDB(userId: string): Promise<GamificationState | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE_GAMIFICATION)
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    if (!data) return null;
    
    return {
      xp: data.xp,
      level: data.level,
      streak: data.streak,
      achievements: JSON.parse(data.achievements || '[]'),
      dailyXpHistory: JSON.parse(data.daily_xp_history || '{}'),
      lastActivityDate: data.last_activity_date,
    };
  } catch (error) {
    console.error('Error loading gamification from DB:', error);
    return null;
  }
}
