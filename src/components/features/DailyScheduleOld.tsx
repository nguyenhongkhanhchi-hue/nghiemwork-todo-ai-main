import React, { useState, useEffect } from 'react';
import { format, addMinutes, startOfDay, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useTaskStore } from '@/stores';
import type { Task, ScheduledTask } from '@/types';
import { Clock, Calendar, Play, Pause, Check } from 'lucide-react';

interface DailyScheduleProps {
  selectedDate: string; // YYYY-MM-DD
  onTaskClick?: (task: Task) => void;
}

export function DailySchedule({ selectedDate, onTaskClick }: DailyScheduleProps) {
  const tasks = useTaskStore(s => s.tasks);
  const timers = useTaskStore(s => s.timers);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Calculate scheduled tasks from tasks with startTime
  useEffect(() => {
    const scheduled: ScheduledTask[] = tasks
      .filter(task => task.startTime && task.estimatedDuration)
      .map(task => {
        const startTime = new Date(task.startTime);
        const endTime = addMinutes(startTime, task.estimatedDuration || 0);
        const timer = timers.find(t => t.taskId === task.id);
        
        return {
          taskId: task.id,
          startTime: startTime.getTime(),
          endTime: endTime.getTime(),
          estimatedDuration: task.estimatedDuration || 0,
          actualDuration: timer ? Math.floor(timer.elapsed / 60) : undefined,
          status: timer?.isRunning ? 'in_progress' as const : 
                  timer?.isPaused ? 'scheduled' as const :
                  task.status === 'done' ? 'completed' as const : 'scheduled' as const
        };
      })
      .filter(scheduled => {
        const taskDate = format(new Date(scheduled.startTime), 'yyyy-MM-dd');
        return taskDate === selectedDate;
      })
      .sort((a, b) => a.startTime - b.startTime);

    setScheduledTasks(scheduled);
  }, [tasks, timers, selectedDate]);

  // Generate 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = startOfDay(new Date(selectedDate));
    hour.setHours(i);
    return hour;
  });

  const getTaskForHour = (hour: Date) => {
    return scheduledTasks.filter(scheduled => {
      const taskStart = new Date(scheduled.startTime);
      const taskEnd = new Date(scheduled.endTime);
      return isWithinInterval(hour, { start: taskStart, end: taskEnd }) ||
             isWithinInterval(addMinutes(hour, 59), { start: taskStart, end: taskEnd });
    });
  };

  const getTaskHeight = (scheduled: ScheduledTask) => {
    const duration = scheduled.actualDuration || scheduled.estimatedDuration;
    return Math.max((duration / 60) * 100, 20); // Minimum 20% height
  };

  const getTaskPosition = (scheduled: ScheduledTask) => {
    const startHour = new Date(scheduled.startTime).getHours();
    const startMinute = new Date(scheduled.startTime).getMinutes();
    return startHour + (startMinute / 60);
  };

  const isCurrentTime = (hour: Date) => {
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const hourNum = hour.getHours();
    
    if (currentMinute === 0) {
      return currentHour === hourNum;
    }
    
    return currentHour === hourNum && currentMinute < 60;
  };

  const getTaskById = (taskId: string) => {
    return tasks.find(t => t.id === taskId);
  };

  return (
    <div className="daily-schedule bg-[var(--bg-elevated)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-[var(--accent-primary)]" />
        <h3 className="font-semibold text-[var(--text-primary)]">
          Lịch biểu hàng ngày - {format(new Date(selectedDate), 'dd/MM/yyyy', { locale: vi })}
        </h3>
      </div>

      <div className="relative">
        {/* Current time indicator */}
        <div 
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ 
            top: `${(currentTime.getHours() + currentTime.getMinutes() / 60) * 60}px`,
            transition: 'top 1s linear'
          }}
        >
          <div className="flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <div className="flex-1 h-0.5 bg-red-500"></div>
          </div>
        </div>

        {/* Time slots */}
        <div className="space-y-0">
          {hours.map((hour, index) => {
            const hourTasks = getTaskForHour(hour);
            const isCurrent = isCurrentTime(hour);
            
            return (
              <div 
                key={index} 
                className={`flex border-b border-[var(--border-subtle)] relative ${
                  isCurrent ? 'bg-red-50/20' : ''
                }`}
                style={{ height: '60px' }}
              >
                {/* Time label */}
                <div className="w-16 py-2 text-right pr-3 text-sm text-[var(--text-muted)] font-mono">
                  {format(hour, 'HH:mm')}
                </div>

                {/* Task area */}
                <div className="flex-1 relative">
                  {hourTasks.map((scheduled, taskIndex) => {
                    const task = getTaskById(scheduled.taskId);
                    if (!task) return null;

                    const position = getTaskPosition(scheduled);
                    const height = getTaskHeight(scheduled);
                    const topOffset = (position - Math.floor(position)) * 60;

                    return (
                      <div
                        key={scheduled.taskId}
                        className={`absolute left-0 right-0 rounded-lg p-2 cursor-pointer transition-all ${
                          scheduled.status === 'in_progress' ? 'bg-green-100 border-green-300' :
                          scheduled.status === 'completed' ? 'bg-blue-100 border-blue-300' :
                          'bg-[var(--bg-base)] border-[var(--border-subtle)]'
                        } border`}
                        style={{
                          top: `${topOffset}px`,
                          height: `${Math.min(height, 60 - topOffset)}px`,
                          zIndex: taskIndex + 1
                        }}
                        onClick={() => onTaskClick?.(task)}
                      >
                        <div className="flex items-center gap-1">
                          {scheduled.status === 'in_progress' && <Play className="w-3 h-3 text-green-600" />}
                          {scheduled.status === 'completed' && <Check className="w-3 h-3 text-blue-600" />}
                          <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {scheduled.actualDuration ? `${scheduled.actualDuration} phút` : `${scheduled.estimatedDuration} phút`}
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
      <div className="flex gap-4 mt-4 text-xs text-[var(--text-muted)]">
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
    </div>
  );
}
