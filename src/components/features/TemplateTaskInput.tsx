import { useState, useEffect } from 'react';
import { useTaskStore, useTemplateStore, useSettingsStore } from '@/stores';
import { X, Clock, Calendar, Check, ChevronDown } from 'lucide-react';
import type { RecurringConfig, TaskFinance } from '@/types';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';

interface TemplateTaskInputProps {
  templateId: string;
  onClose: () => void;
}

export function TemplateTaskInput({ templateId, onClose }: TemplateTaskInputProps) {
  const templates = useTemplateStore(s => s.templates);
  const template = templates.find(t => t.id === templateId);
  
  const [startTime, setStartTime] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [estimatedDuration, setEstimatedDuration] = useState(30); // minutes
  const [importance, setImportance] = useState<'high' | 'medium' | 'low'>('medium');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedAdvanced, setExpandedAdvanced] = useState(false);
  
  // Advanced options
  const [deadlineDate, setDeadlineDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [notes, setNotes] = useState(template?.notes || '');
  const [showDeadline, setShowDeadline] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [financeItems, setFinanceItems] = useState<TaskFinance[]>(template?.finance ? [template.finance] : []);
  
  const addTask = useTaskStore(s => s.addTask);
  const financeCategories = useSettingsStore(s => s.financeCategories);

  useEffect(() => {
    if (template?.finance) {
      setFinanceItems([template.finance]);
    }
  }, [template]);

  const toggleAdvanced = () => {
    setShowAdvanced(!showAdvanced);
    setExpandedAdvanced(!showAdvanced);
  };

  const addFinanceItem = () => {
    setFinanceItems([
      ...financeItems,
      {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        type: 'expense',
        amount: 0,
        category: financeCategories[0]?.id || 'other',
        note: ''
      }
    ]);
  };

  const removeFinanceItem = (index: number) => {
    const newItems = [...financeItems];
    newItems.splice(index, 1);
    setFinanceItems(newItems);
  };

  const updateFinanceItem = (index: number, updates: Partial<TaskFinance>) => {
    const newItems = [...financeItems];
    newItems[index] = { ...newItems[index], ...updates };
    setFinanceItems(newItems);
  };

  const handleSubmit = () => {
    if (!template) {
      toast.error('Không tìm thấy mẫu việc');
      return;
    }

    if (!startTime) {
      toast.error('Vui lòng nhập Thời điểm bắt đầu');
      return;
    }

    if (estimatedDuration <= 0) {
      toast.error('Thời lượng ước tính phải lớn hơn 0');
      return;
    }

    // Calculate start timestamp
    const startTimestamp = new Date(`${startDate}T${startTime}:00`).getTime();
    
    // Calculate deadline if provided
    let deadline: number | undefined;
    if (showDeadline && deadlineDate) {
      deadline = new Date(`${deadlineDate}T${deadlineTime}:00`).getTime();
    }

    // Handle finance
    let finance: TaskFinance[] | undefined;
    const validItems = financeItems.filter(f => f.amount > 0);
    if (validItems.length > 0) finance = validItems;

    const taskId = addTask(
      template.title,
      undefined,
      deadline,
      template.recurring,
      showDeadline ? deadlineDate : undefined,
      showDeadline ? deadlineTime : undefined,
      finance,
      template.id,
      false,
      {
        showDeadline,
        showRecurring: false,
        showFinance: financeItems.length > 0,
        showNotes,
        notes: showNotes ? notes : undefined,
        startTime: startTimestamp,
        estimatedDuration,
        importance
      }
    );

    if (taskId) {
      // Update task with start time and estimated duration
      const { updateTask } = useTaskStore.getState();
      updateTask(taskId, {
        startTime: startTimestamp,
        estimatedDuration
      });
      
      toast.success('Đã thêm việc từ mẫu');
      onClose();
    }
  };

  if (!template) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
        <div className="bg-[var(--bg-elevated)] rounded-2xl p-6 max-w-sm">
          <p className="text-[var(--text-primary)]">Không tìm thấy mẫu việc</p>
          <button onClick={onClose} className="mt-4 w-full py-2 rounded-lg bg-[var(--accent-primary)] text-white">
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] bg-[var(--bg-elevated)] rounded-t-2xl overflow-hidden flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Thêm từ mẫu: {template.title}</h2>
          <button onClick={onClose} className="size-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {/* Template info */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border-subtle)]">
            <h3 className="font-medium text-[var(--text-primary)] mb-1">{template.title}</h3>
            {template.notes && (
              <p className="text-sm text-[var(--text-muted)]">{template.notes}</p>
            )}
          </div>

          {/* Required fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Thời điểm bắt đầu <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 bg-[var(--bg-surface)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[38px]"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="flex-1 bg-[var(--bg-surface)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[38px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Thời lượng ước tính (phút) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="480"
                value={estimatedDuration}
                onChange={e => setEstimatedDuration(parseInt(e.target.value) || 30)}
                className="w-full bg-[var(--bg-surface)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Mức độ quan trọng
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'high' as const, label: 'Cao', color: 'bg-red-100 text-red-600 border-red-300' },
                  { value: 'medium' as const, label: 'Trung bình', color: 'bg-yellow-100 text-yellow-600 border-yellow-300' },
                  { value: 'low' as const, label: 'Thấp', color: 'bg-gray-100 text-gray-600 border-gray-300' }
                ].map(level => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setImportance(level.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      importance === level.value 
                        ? level.color 
                        : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Advanced options */}
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            <button type="button" onClick={toggleAdvanced} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div className="flex items-center gap-2">
                <div className={`size-4 rounded border flex items-center justify-center ${showAdvanced ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]' : 'border-[var(--text-muted)]'}`}>
                  {showAdvanced && <Check size={10} className="text-[var(--bg-base)]" />}
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)]">Tùy chọn nâng cao</span>
              </div>
              <ChevronDown size={16} className={`text-[var(--text-muted)] transition-transform ${expandedAdvanced ? 'rotate-180' : ''}`} />
            </button>
            
            {expandedAdvanced && (
              <div className="px-4 pb-3 pt-0 border-t border-[var(--border-subtle)] space-y-3">
                {/* Deadline */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] mb-2">
                    <input
                      type="checkbox"
                      checked={showDeadline}
                      onChange={e => setShowDeadline(e.target.checked)}
                      className="rounded"
                    />
                    <Calendar className="w-4 h-4" />
                    Hạn chót
                  </label>
                  {showDeadline && (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={deadlineDate}
                        onChange={e => setDeadlineDate(e.target.value)}
                        className="flex-1 bg-[var(--bg-elevated)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[38px]"
                      />
                      <input
                        type="time"
                        value={deadlineTime}
                        onChange={e => setDeadlineTime(e.target.value)}
                        className="flex-1 bg-[var(--bg-elevated)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)] min-h-[38px]"
                      />
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] mb-2">
                    <input
                      type="checkbox"
                      checked={showNotes}
                      onChange={e => setShowNotes(e.target.checked)}
                      className="rounded"
                    />
                    Ghi chú
                  </label>
                  {showNotes && (
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Ghi chú..."
                      rows={2}
                      className="w-full bg-[var(--bg-elevated)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] resize-none"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 pt-2">
          <button 
            onClick={handleSubmit} 
            disabled={!startTime || estimatedDuration <= 0}
            className="w-full py-3 rounded-xl text-sm font-semibold text-[var(--bg-base)] bg-[var(--accent-primary)] disabled:opacity-30 active:opacity-80 min-h-[44px] flex items-center justify-center"
          >
            Thêm việc
          </button>
        </div>
      </div>
    </div>
  );
}
