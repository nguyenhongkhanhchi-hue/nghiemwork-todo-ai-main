import { useState, useMemo } from 'react';
import { useTaskStore, useSettingsStore } from '@/stores';
import { TaskViewModal } from '@/components/features/TaskViewModal';
import { TaskEditModal } from '@/components/features/TaskEditModal';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { QUADRANT_LABELS } from '@/types';
import type { Task, EisenhowerQuadrant } from '@/types';
import { isTaskOverdue } from '@/lib/autoQuadrant';
import { playTabSound } from '@/lib/soundEffects';
import { Play, Pause, Check, Trash2, RotateCcw, Search, X, ArrowUpDown, DollarSign } from 'lucide-react';

// Tab types
type ActiveTab = 'overdue' | 'do_first';
type DoFirstTab = 'pending' | 'in_progress' | 'paused' | 'done';

export function TaskList() {
  const tasks = useTaskStore(s => s.tasks);
  const timers = useTaskStore(s => s.timers);
  const { dailyTimeCost } = useSettingsStore();
  const startTimer = useTaskStore(s => s.startTimer);
  const pauseTimer = useTaskStore(s => s.pauseTimer);
  const resumeTimer = useTaskStore(s => s.resumeTimer);
  const completeTask = useTaskStore(s => s.completeTask);
  const removeTask = useTaskStore(s => s.removeTask);
  const restoreTask = useTaskStore(s => s.restoreTask);
  const reorderTasks = useTaskStore(s => s.reorderTasks);

  const [activeTab, setActiveTab] = useState<ActiveTab>('do_first');
  const [doFirstTab, setDoFirstTab] = useState<DoFirstTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'deadline' | 'title' | 'created' | 'none'>('none');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [lastClickTime, setLastClickTime] = useState<{ [key: string]: number }>({});
  const DOUBLE_CLICK_DELAY = 300;

  const now = Date.now();

  // Get tasks by active tab
  const tabTasks = useMemo(() => {
    if (activeTab === 'overdue') {
      return tasks.filter(t => isTaskOverdue(t));
    }
    if (activeTab === 'do_first') {
      return tasks.filter(t => t.quadrant === 'do_first');
    }
    return [];
  }, [tasks, activeTab]);

  // Count overdue tasks
  const overdueCount = useMemo(() => {
    return tasks.filter(isTaskOverdue).length;
  }, [tasks]);

  // Count do first (today) tasks
  const doFirstCount = useMemo(() => {
    return tasks.filter(t => t.quadrant === 'do_first' && t.status !== 'done').length;
  }, [tasks]);

  // Filter tasks based on active tab and sub-tab
  const filteredTasks = useMemo(() => {
    let result = tabTasks;

    // Filter by tab-specific sub-tab
    if (activeTab === 'do_first') {
      result = result.filter(t => t.status === doFirstTab && (doFirstTab !== 'pending' || !isTaskOverdue(t)));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      result = result.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    if (sortBy !== 'none') {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'deadline':
            if (!a.deadline && !b.deadline) comparison = 0;
            else if (!a.deadline) comparison = 1;
            else if (!b.deadline) comparison = -1;
            else comparison = a.deadline - b.deadline;
            break;
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'created':
            comparison = a.createdAt - b.createdAt;
            break;
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [tabTasks, activeTab, doFirstTab, searchQuery, sortBy, sortOrder]);

  const { draggedIndex, onDragStart, onDragOver, onDragEnd } = useDragAndDrop(reorderTasks);

  const formatTimeRemaining = (deadline: number) => {
    const abs = Math.abs(deadline - now);
    if (deadline < now) {
      const mins = Math.max(1, Math.floor(abs / 60000));
      const hrs = Math.floor(abs / 3600000);
      const days = Math.floor(abs / 86400000);
      if (days > 0) return { text: `Quá hạn ${days} ngày`, color: 'var(--error)', urgent: true };
      if (hrs > 0) return { text: `Quá hạn ${hrs} giờ`, color: 'var(--error)', urgent: true };
      return { text: `Quá hạn ${mins} phút`, color: 'var(--error)', urgent: true };
    }
    const hours = Math.floor((deadline - now) / 3600000);
    const minutes = Math.floor(((deadline - now) % 3600000) / 60000);
    const days = Math.floor(hours / 24);
    if (hours < 1) return { text: `Còn ${minutes} phút`, color: '#F87171', urgent: true };
    if (hours < 24) return { text: `Còn ${hours} giờ ${minutes % 60} phút`, color: '#FBBF24', urgent: true };
    if (days < 7) return { text: `Còn ${days} ngày`, color: '#60A5FA', urgent: false };
    return { text: `Còn ${days} ngày`, color: 'var(--text-muted)', urgent: false };
  };

  const canStartTimer = (task: Task) => {
    return task.quadrant === 'do_first' || isTaskOverdue(task);
  };

  const handleTaskClick = (task: Task) => {
    const currentTime = Date.now();
    const lastTime = lastClickTime[task.id] || 0;
    
    if (currentTime - lastTime < DOUBLE_CLICK_DELAY) {
      // Double click - edit task
      setEditTask(task);
    } else {
      // Single click - view task
      setViewTask(task);
    }
    
    setLastClickTime({ ...lastClickTime, [task.id]: currentTime });
  };

  const handleTaskAction = (task: Task, action: 'timer' | 'pause' | 'resume' | 'complete' | 'restore' | 'delete') => {
    switch (action) {
      case 'timer':
        if (canStartTimer(task)) startTimer(task.id);
        break;
      case 'pause':
        pauseTimer(task.id);
        break;
      case 'resume':
        resumeTimer(task.id);
        break;
      case 'complete':
        completeTask(task.id);
        break;
      case 'restore':
        restoreTask(task.id);
        break;
      case 'delete':
        removeTask(task.id);
        break;
    }
  };

  const getActiveTimer = (taskId: string) => {
    return timers.find(t => t.taskId === taskId);
  };

  return (
    <>
      {/* Main Tabs - Only Overdue and Do First */}
      <div className="flex gap-0.5 mb-2 p-0.5 bg-[var(--bg-elevated)] rounded-xl overflow-x-auto">
        {/* Overdue Tab */}
        <button onClick={() => { setActiveTab('overdue'); playTabSound(); }}
          className={`flex-shrink-0 flex-1 py-2 rounded-lg text-[10px] font-medium min-h-[36px] flex flex-col items-center justify-center gap-0.5 ${activeTab === 'overdue' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
          style={activeTab === 'overdue' ? { backgroundColor: 'rgba(248,113,113,0.15)', color: '#F87171' } : {}}>
          <span>🔥</span>
          <span className="leading-none">Quá hạn</span>
          {overdueCount > 0 && <span className="text-[8px] font-mono bg-[var(--bg-base)] px-1 rounded">{overdueCount}</span>}
        </button>
        
        {/* Do First Tab - Only show today's tasks */}
        <button onClick={() => { setActiveTab('do_first'); playTabSound(); }}
          className={`flex-shrink-0 flex-1 py-2 rounded-lg text-[10px] font-medium min-h-[36px] flex flex-col items-center justify-center gap-0.5 ${activeTab === 'do_first' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
          style={activeTab === 'do_first' ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' } : {}}>
          <span>🔴</span>
          <span className="leading-none">Hôm nay</span>
          {doFirstCount > 0 && <span className="text-[8px] font-mono bg-[var(--bg-base)] px-1 rounded">{doFirstCount}</span>}
        </button>
      </div>

      {/* Sub-tabs - Only for Do First */}
      <div className="mb-2">
        <div className="flex items-center gap-1">
          {/* Sub-tabs for Do First */}
          {activeTab === 'do_first' && (
            <div className="flex-1 flex gap-1 overflow-x-auto pb-0.5">
              {([
                { key: 'pending' as DoFirstTab, label: 'Chưa làm', icon: '⏳' },
                { key: 'in_progress' as DoFirstTab, label: 'Đang làm', icon: '▶️' },
                { key: 'paused' as DoFirstTab, label: 'Tạm dừng', icon: '⏸️' },
                { key: 'done' as DoFirstTab, label: 'Hoàn thành', icon: '✅' },
              ]).map(tab => {
                const count = tabTasks.filter(t => t.status === tab.key && (tab.key !== 'pending' || !isTaskOverdue(t))).length;
                return (
                  <button key={tab.key} onClick={() => { setDoFirstTab(tab.key); playTabSound(); }}
                    className={`flex-shrink-0 px-2 py-1 rounded-lg text-[9px] font-medium h-auto flex items-center gap-0.5 ${doFirstTab === tab.key ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                    {tab.icon} {tab.label} {count > 0 && <span className="font-mono text-[8px]">({count})</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Search and Sort */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm việc..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-elevated)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] focus:border-[var(--accent-primary)]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="size-4 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setSortMenuOpen(!sortMenuOpen)} className="px-3 py-2 bg-[var(--bg-elevated)] rounded-lg text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] flex items-center gap-1">
            <ArrowUpDown className="size-4" />
            Sắp xếp
          </button>
          {sortMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-lg z-10 min-w-[150px]">
              {[
                { key: 'none' as const, label: 'Mặc định' },
                { key: 'deadline' as const, label: 'Hạn chót' },
                { key: 'title' as const, label: 'Tiêu đề' },
                { key: 'created' as const, label: 'Ngày tạo' },
              ].map(option => (
                <button
                  key={option.key}
                  onClick={() => {
                    setSortBy(option.key);
                    setSortMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-surface)] ${
                    sortBy === option.key ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              {sortBy !== 'none' && (
                <>
                  <div className="border-t border-[var(--border-subtle)]" />
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-surface)] text-[var(--text-primary)]"
                  >
                    {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-2xl mb-2">{activeTab === 'overdue' ? '🔥' : '🔴'}</span>
            <p className="text-xs text-[var(--text-muted)]">
              {searchQuery ? 'Không tìm thấy việc nào' : activeTab === 'overdue' ? 'Không có việc quá hạn' : 'Chưa có việc hôm nay'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task, index) => {
              const activeTimer = getActiveTimer(task.id);
              const isDone = task.status === 'done';
              const taskIsOverdue = isTaskOverdue(task);
              
              return (
                <div
                  key={task.id}
                  className={`bg-[var(--bg-elevated)] rounded-xl p-3 cursor-pointer transition-all hover:shadow-sm ${
                    activeTimer?.isRunning ? 'border-2 border-green-500' : 'border border-[var(--border-subtle)]'}`}
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'} break-words`}>
                            {task.title}
                          </p>
                          
                          {/* Time Remaining */}
                          {task.deadline && !isDone && !taskIsOverdue && activeTab === 'do_first' && (() => {
                            const timeInfo = formatTimeRemaining(task.deadline);
                            return (
                              <div className={`flex items-center gap-1 mt-1 px-2 py-1 rounded-lg ${timeInfo.urgent ? 'bg-[rgba(248,113,113,0.15)]' : 'bg-[var(--bg-surface)]'}`}>
                                <span className="text-[9px]" style={{ color: timeInfo.color }}>
                                  {timeInfo.text}
                                </span>
                              </div>
                            );
                          })()}
                          
                          {/* Time Cost */}
                          {dailyTimeCost > 0 && activeTimer && (
                            <div className="flex items-center gap-1 mt-1 px-2 py-1 rounded-lg bg-[rgba(34,197,94,0.15)]">
                              <DollarSign className="size-3 text-green-600" />
                              <span className="text-[9px] text-green-600">
                                {((activeTimer.elapsed / 3600000) * dailyTimeCost).toFixed(0)}đ
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {!isDone && canStartTimer(task) && (
                        <>
                          {activeTimer?.isPaused ? (
                            <button onClick={() => handleTaskAction(task, 'resume')} className="size-6 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                              <Play size={10} fill="currentColor" />
                            </button>
                          ) : activeTimer?.isRunning ? (
                            <button onClick={() => handleTaskAction(task, 'pause')} className="size-6 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600">
                              <Pause size={10} />
                            </button>
                          ) : (
                            <button onClick={() => handleTaskAction(task, 'timer')} className="size-6 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                              <Play size={10} />
                            </button>
                          )}
                          <button onClick={() => handleTaskAction(task, 'complete')} className="size-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                            <Check size={10} />
                          </button>
                        </>
                      )}
                      
                      {/* Overdue: Restore + Delete buttons */}
                      {activeTab === 'overdue' ? (
                        <>
                          <button onClick={() => handleTaskAction(task, 'restore')} className="size-6 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                            <RotateCcw size={10} />
                          </button>
                          <button onClick={() => handleTaskAction(task, 'delete')} className="size-6 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                            <Trash2 size={10} />
                          </button>
                        </>
                      ) : isDone && (
                        <button onClick={() => handleTaskAction(task, 'restore')} className="size-6 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                          <RotateCcw size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {viewTask && <TaskViewModal task={viewTask} onClose={() => setViewTask(null)} onEdit={() => { setEditTask(viewTask); setViewTask(null); }} />}
      {editTask && <TaskEditModal task={editTask} onClose={() => setEditTask(null)} />}
    </>
  );
}
