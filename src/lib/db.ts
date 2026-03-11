import { supabase } from '@/lib/supabase';
import type { Task, TaskTemplate, Topic, GamificationState } from '@/types';

// Tasks
export async function loadTasksFromDB(userId: string): Promise<Task[] | null> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading tasks from DB:', error);
      return null;
    }
    
    return data || null;
  } catch (error) {
    console.error('Failed to load tasks from DB:', error);
    return null;
  }
}

export async function saveTasksToDB(userId: string, tasks: Task[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('tasks')
      .upsert({
        user_id: userId,
        tasks: tasks,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (error) {
      console.error('Error saving tasks to DB:', error);
    }
  } catch (error) {
    console.error('Failed to save tasks to DB:', error);
  }
}

// Templates
export async function loadTemplatesFromDB(userId: string): Promise<TaskTemplate[] | null> {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading templates from DB:', error);
      return null;
    }
    
    return data || null;
  } catch (error) {
    console.error('Failed to load templates from DB:', error);
    return null;
  }
}

export async function saveTemplatesToDB(userId: string, templates: TaskTemplate[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('templates')
      .upsert({
        user_id: userId,
        templates: templates,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (error) {
      console.error('Error saving templates to DB:', error);
    }
  } catch (error) {
    console.error('Failed to save templates to DB:', error);
  }
}

// Topics
export async function loadTopicsFromDB(userId: string): Promise<Topic[] | null> {
  try {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading topics from DB:', error);
      return null;
    }
    
    return data || null;
  } catch (error) {
    console.error('Failed to load topics from DB:', error);
    return null;
  }
}

export async function saveTopicsToDB(userId: string, topics: Topic[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('topics')
      .upsert({
        user_id: userId,
        topics: topics,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (error) {
      console.error('Error saving topics to DB:', error);
    }
  } catch (error) {
    console.error('Failed to save topics to DB:', error);
  }
}

// Gamification
export async function loadGamificationFromDB(userId: string): Promise<GamificationState | null> {
  try {
    const { data, error } = await supabase
      .from('gamification')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error loading gamification from DB:', error);
      return null;
    }
    
    return data || null;
  } catch (error) {
    console.error('Failed to load gamification from DB:', error);
    return null;
  }
}

export async function saveGamificationToDB(userId: string, state: GamificationState): Promise<void> {
  try {
    const { error } = await supabase
      .from('gamification')
      .upsert({
        user_id: userId,
        ...state,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (error) {
      console.error('Error saving gamification to DB:', error);
    }
  } catch (error) {
    console.error('Failed to save gamification to DB:', error);
  }
}
