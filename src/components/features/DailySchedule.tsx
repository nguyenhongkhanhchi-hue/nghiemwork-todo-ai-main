import React, { useState, useEffect, useMemo } from 'react';
import { format, addMinutes, startOfDay, isWithinInterval, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useTaskStore } from '@/stores';
import type { Task, ScheduledTask } from '@/types';
import { Clock, Calendar, Play, Pause, Check } from 'lucide-react';

interface DailyScheduleProps {
  selectedDate: string; // YYYY-MM-DD
  onTaskClick?: (task: Task) => void;
}

const HOUR_HEIGHT = 60; // pixels per hour
const MIN_TASK_HEIGHT = 20; // minimum pixels

export function DailySchedule({ selectedDate, onTaskClick }: DailyScheduleProps) {
  const tasks = useTaskStore(s => s.tasks);
  const timer = useTaskStore(s => s.timer);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate scheduled tasks from tasks with startTime
  const scheduledTasks = useMemo(() => {
    const selectedDateStart = startOfDay(parseISO(selectedDate));
    const selectedDateEnd = addMinutes(selectedDateStart, 24 * 60 - 1);

    return tasks
      .filter(task => {
        // Filter tasks that have startTime and are on the selected date
        if (!task.startTime || !task.estimatedDuration) return false;
        
        const taskStart = new Date(task.startTime);
        const taskDate = startOfDay(taskStart);
        
        return taskDate.getTime() === selectedDateStart.getTime();
      })
      .map(task => {
        const startTime = new Date(task.startTime);
        const endTime = addMinutes(startTime, task.estimatedDuration);
        
        // Determine status
        let status: ScheduledTask['status'] = 'scheduled';
        if (task.status === 'done') {
          status = 'completed';
        } else if (timer.taskId === task.id) {
          status = timer.isRunning ? 'in_progress' : 'scheduled';
        }
        
        return {
          taskId: task.id,
          startTime: startTime.getTime(),
          endTime: endTime.getTime(),
          estimatedDuration: task.estimatedDuration,
          actualDuration: timer.taskId === task.id ? Math.floor(timer.elapsed / 60) : undefined,
          status
        };
      })
      .sort((a, b) => a.startTime - b.startTime); // Sort by start time
  }, [tasks, timer, selectedDate]);

  // Calculate task position and height
  const getTaskLayout = (scheduled: ScheduledTask) => {
    const startHour = new Date(scheduled.startTime);
    const endHour = new Date(scheduled.endTime);
    
    // Calculate position from start of day in minutes
    const dayStart = startOfDay(parseISO(selectedDate));
    const startMinutes = Math.floor((startHour.getTime() - dayStart.getTime()) / (1000 * 60));
    const durationMinutes = Math.ceil((endHour.getTime() - startHour.getTime()) / (1000 * 60));
    
    // Convert to pixels
    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, MIN_TASK_HEIGHT);
    
    return { top, height };
  };

  // Generate 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = startOfDay(parseISO(selectedDate));
    hour.setHours(i);
    return hour;
  });

  // Get tasks for specific hour
  const getTasksForHour = (hour: Date) => {
    const hourStart = hour;
    const hourEnd = addMinutes(hour, 60);
    
    return scheduledTasks.filter(scheduled => {
      const taskStart = new Date(scheduled.startTime);
      const taskEnd = new Date(scheduled.endTime);
      
      // Check if task overlaps with this hour
      return (
        isWithinInterval(taskStart, { start: hourStart, end: hourEnd }) ||
        isWithinInterval(taskEnd, { start: hourStart, end: hourEnd }) ||
        (taskStart <= hourStart && taskEnd >= hourEnd)
      );
    });
  };

  // Check if current time is in specific hour
  const isCurrentHour = (hour: Date) => {
    const currentHour = currentTime.getHours();
    return hour.getHours() === currentHour;
  };

  // Get task by ID
  const getTaskById = (taskId: string) => {
    return tasks.find(t => t.id === taskId);
  };

  // Current time indicator position
  const currentTimePosition = useMemo(() => {
    const now = currentTime;
    const dayStart = startOfDay(parseISO(selectedDate));
    const minutesSinceStart = (now.getTime() - dayStart.getTime()) / (1000 * 60);
    return (minutesSinceStart / 60) * HOUR_HEIGHT;
  }, [currentTime, selectedDate]);

  return (
    <div className="daily-schedule bg-[var(--bg-elevated)] rounded-xl p-4 h-full overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <Calendar className="w-5 h-5 text-[var(--accent-primary)]" />
        <h3 className="font-semibold text-[var(--text-primary)]">
          Lịch biểu 24 giờ - {format(parseISO(selectedDate), 'dd/MM/yyyy', { locale: vi })}
        </h3>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* Current time indicator */}
        <div 
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ 
            top: `${currentTimePosition}px`,
            transition: 'top 1s linear'
          }}
        >
          <div className="flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full shadow-sm"></div>
            <div className="flex-1 h-0.5 bg-red-500 opacity-60"></div>
          </div>
        </div>

        {/* Schedule grid */}
        <div 
          className="relative"
          style={{ height: `${HOUR_HEIGHT * 24}px` }}
        >
          {/* Hour lines and labels */}
          {hours.map((hour, index) => {
            const hourTasks = getTasksForHour(hour);
            const isCurrent = isCurrentHour(hour);
            
            return (
              <div 
                key={index} 
                className={`flex border-b border-[var(--border-subtle)] relative ${
                  isCurrent ? 'bg-red-50/10' : ''
                }`}
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {/* Time label */}
                <div className="w-16 py-2 text-right pr-3 text-sm text-[var(--text-muted)] font-mono flex-shrink-0">
                  {format(hour, 'HH:mm')}
                </div>

                {/* Task area */}
                <div className="flex-1 relative">
                  {hourTasks.map((scheduled) => {
                    const task = getTaskById(scheduled.taskId);
                    if (!task) return null;

                    const layout = getTaskLayout(scheduled);
                    
                    // Calculate position relative to current hour
                    const hourStart = startOfDay(hour);
                    const taskStart = new Date(scheduled.startTime);
                    const minutesIntoHour = Math.floor((taskStart.getTime() - hourStart.getTime()) / (1000 * 60));
                    const topOffset = (minutesIntoHour / 60) * HOUR_HEIGHT;
                    
                    // Adjust height to not exceed hour boundary
                    const remainingMinutesInHour = 60 - minutesIntoHour;
                    const maxTaskHeight = (remainingMinutesInHour / 60) * HOUR_HEIGHT;
                    const adjustedHeight = Math.min(layout.height, maxTaskHeight);

                    return (
                      <div
                        key={scheduled.taskId}
                        className={`absolute left-0 right-0 rounded-lg p-2 cursor-pointer transition-all hover:shadow-md ${
                          scheduled.status === 'in_progress' 
                            ? 'bg-green-100 border-green-300 shadow-sm' 
                            : scheduled.status === 'completed' 
                            ? 'bg-blue-100 border-blue-300 opacity-80' 
                            : 'bg-[var(--bg-base)] border-[var(--border-subtle] hover:bg-[var(--bg-surface)]'
                        } border`}
                        style={{
                          top: `${topOffset}px`,
                          height: `${Math.max(adjustedHeight, MIN_TASK_HEIGHT)}px`,
                          zIndex: 10
                        }}
                        onClick={() => onTaskClick?.(task)}
                      >
                        <div className="flex items-center gap-1">
                          {scheduled.status === 'in_progress' && (
                            <Play className="w-3 h-3 text-green-600" fill="currentColor" />
                          )}
                          {scheduled.status === 'completed' && (
                            <Check className="w-3 h-3 text-blue-600" />
                          )}
                          <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {format(taskStart, 'HH:mm')} - {format(new Date(scheduled.endTime), 'HH:mm')}
                          {scheduled.actualDuration && ` (${scheduled.actualDuration} phút)`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-[var(--text-muted)] flex-shrink-0">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
          <span>Đang thực hiện</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
          <span>Hoàn thành</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded"></div>
          <span>Đã lên lịch</span>
        </div>
      </div>

      {/* Empty state */}
      {scheduledTasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Clock className="w-12 h-12 text-[var(--text-muted)] opacity-30 mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">Không có việc nào được lên lịch</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Thêm việc từ Mẫu với thời điểm bắt đầu</p>
          </div>
        </div>
      )}
    </div>
  );
}
