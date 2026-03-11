import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useHealthStore, useAuthStore } from '@/stores';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Line,
} from 'recharts';
import {
  Droplets, Weight, Ruler, Plus, Trash2, Settings2, ChevronDown,
  RotateCcw, Target, Bell, BellOff, Activity, Cloud, CloudOff,
  RefreshCw, FileText, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import type { HealthViewPeriod, HealthGoals, WaterReminderSettings } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDateLabel(timestamp: number, period: HealthViewPeriod): string {
  const d = new Date(timestamp);
  if (period === 'day') return `${d.getHours()}h`;
  if (period === 'week') return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
  if (period === 'month') return `${d.getDate()}/${d.getMonth() + 1}`;
  return `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
}

function filterByPeriod<T extends { timestamp: number }>(entries: T[], period: HealthViewPeriod): T[] {
  const now = Date.now();
  const ms: Record<HealthViewPeriod, number> = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };
  return entries.filter(e => now - e.timestamp <= ms[period]);
}

function aggregateByDay<T extends { timestamp: number; value?: number; amount?: number }>(
  entries: T[], period: HealthViewPeriod, field: 'value' | 'amount', mode: 'last' | 'sum'
): { label: string; value: number; timestamp: number }[] {
  const filtered = filterByPeriod(entries, period);
  if (filtered.length === 0) return [];

  if (period === 'day') {
    const hours: Record<number, T[]> = {};
    filtered.forEach(e => {
      const h = new Date(e.timestamp).getHours();
      if (!hours[h]) hours[h] = [];
      hours[h].push(e);
    });
    return Object.entries(hours).map(([h, items]) => {
      const sum = items.reduce((s, i) => s + ((i as any)[field] || 0), 0);
      const last = items[items.length - 1];
      return { label: `${h}h`, value: mode === 'sum' ? sum : (last as any)[field], timestamp: last.timestamp };
    }).sort((a, b) => a.timestamp - b.timestamp);
  }

  const groups: Record<string, T[]> = {};
  filtered.forEach(e => {
    const d = new Date(e.timestamp);
    let key: string;
    if (period === 'week' || period === 'month') {
      key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    } else {
      key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  return Object.entries(groups).map(([, items]) => {
    const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
    const sum = items.reduce((s, i) => s + ((i as any)[field] || 0), 0);
    const last = sorted[sorted.length - 1];
    return {
      label: getDateLabel(last.timestamp, period),
      value: mode === 'sum' ? sum : (last as any)[field],
      timestamp: last.timestamp,
    };
  }).sort((a, b) => a.timestamp - b.timestamp);
}

function calcBMI(weightKg: number, heightCm: number): number {
  if (!heightCm || heightCm <= 0) return 0;
  const h = heightCm / 100;
  return weightKg / (h * h);
}

function getBMICategory(bmi: number): { label: string; color: string; emoji: string } {
  if (bmi <= 0) return { label: '—', color: 'var(--text-muted)', emoji: '—' };
  if (bmi < 18.5) return { label: 'Thiếu cân', color: '#60A5FA', emoji: '🔵' };
  if (bmi < 25) return { label: 'Bình thường', color: '#34D399', emoji: '🟢' };
  if (bmi < 30) return { label: 'Thừa cân', color: '#FBBF24', emoji: '🟡' };
  return { label: 'Béo phì', color: '#F87171', emoji: '🔴' };
}

// ── Period Selector ──────────────────────────────────────────────────────────
function PeriodSelector({ value, onChange }: { value: HealthViewPeriod; onChange: (p: HealthViewPeriod) => void }) {
  const opts: { v: HealthViewPeriod; label: string }[] = [
    { v: 'day', label: 'Ngày' }, { v: 'week', label: 'Tuần' },
    { v: 'month', label: 'Tháng' }, { v: 'year', label: 'Năm' },
  ];
  return (
    <div className="flex gap-1 p-1 bg-[var(--bg-surface)] rounded-lg">
      {opts.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === o.v
              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function HealthPage() {
  const user = useAuthStore(s => s.user);
  
  // Health store state
  const waterEntries = useHealthStore(s => s.waterEntries);
  const weightEntries = useHealthStore(s => s.weightEntries);
  const waistEntries = useHealthStore(s => s.waistEntries);
  const dailyWaterGoal = useHealthStore(s => s.dailyWaterGoal);
  const weightUnit = useHealthStore(s => s.weightUnit);
  const goals = useHealthStore(s => s.goals);
  const waterReminder = useHealthStore(s => s.waterReminder);
  
  // Health store actions
  const initForUser = useHealthStore(s => s.initForUser);
  const addWaterEntry = useHealthStore(s => s.addWaterEntry);
  const addWeightEntry = useHealthStore(s => s.addWeightEntry);
  const addWaistEntry = useHealthStore(s => s.addWaistEntry);
  const removeWaterEntry = useHealthStore(s => s.removeWaterEntry);
  const removeWeightEntry = useHealthStore(s => s.removeWeightEntry);
  const removeWaistEntry = useHealthStore(s => s.removeWaistEntry);
  const setDailyWaterGoal = useHealthStore(s => s.setDailyWaterGoal);
  const setWeightUnit = useHealthStore(s => s.setWeightUnit);
  const setGoals = useHealthStore(s => s.setGoals);
  const setWaterReminder = useHealthStore(s => s.setWaterReminder);

  // UI state
  const [viewPeriod, setViewPeriod] = useState<HealthViewPeriod>('week');
  const [showSettings, setShowSettings] = useState(false);
  const [waterAmount, setWaterAmount] = useState(250);
  const [weightValue, setWeightValue] = useState('');
  const [waistValue, setWaistValue] = useState('');
  const [weightNote, setWeightNote] = useState('');
  const [waistNote, setWaistNote] = useState('');

  // Initialize store for user
  useEffect(() => {
    if (user) {
      initForUser(user.id);
    } else {
      initForUser('admin');
    }
  }, [user, initForUser]);

  // Today's water intake
  const todayWaterIntake = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return waterEntries
      .filter(e => e.date === today)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [waterEntries]);

  // Chart data
  const waterChartData = useMemo(() => {
    return aggregateByDay(waterEntries, viewPeriod, 'amount', 'sum');
  }, [waterEntries, viewPeriod]);

  const weightChartData = useMemo(() => {
    return aggregateByDay(weightEntries, viewPeriod, 'value', 'last');
  }, [weightEntries, viewPeriod]);

  const waistChartData = useMemo(() => {
    return aggregateByDay(waistEntries, viewPeriod, 'value', 'last');
  }, [waistEntries, viewPeriod]);

  // BMI calculation
  const latestWeight = weightEntries[weightEntries.length - 1]?.value || 0;
  const bmi = useMemo(() => {
    if (goals.height && latestWeight) {
      return calcBMI(latestWeight, goals.height);
    }
    return 0;
  }, [latestWeight, goals.height]);

  const bmiCategory = getBMICategory(bmi);

  // Quick add water
  const handleAddWater = (amount: number) => {
    addWaterEntry(amount);
  };

  const handleAddWeight = () => {
    const value = parseFloat(weightValue);
    if (value && value > 0) {
      addWeightEntry(value, weightNote || undefined);
      setWeightValue('');
      setWeightNote('');
    }
  };

  const handleAddWaist = () => {
    const value = parseFloat(waistValue);
    if (value && value > 0) {
      addWaistEntry(value, waistNote || undefined);
      setWaistValue('');
      setWaistNote('');
    }
  };

  return (
    <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Sức khỏe</h1>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="size-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)]"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {/* Period Selector */}
      <div className="mb-4">
        <PeriodSelector value={viewPeriod} onChange={setViewPeriod} />
      </div>

      {/* Water Intake */}
      <div className="bg-[var(--bg-elevated)] rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Droplets className="text-blue-500" size={20} />
            <h2 className="font-semibold text-[var(--text-primary)]">Nước uống</h2>
          </div>
          <span className="text-sm text-[var(--text-muted)]">
            {todayWaterIntake}ml / {dailyWaterGoal}ml
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-[var(--bg-surface)] rounded-full h-2 mb-3">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, (todayWaterIntake / dailyWaterGoal) * 100)}%` }}
          />
        </div>

        {/* Quick add buttons */}
        <div className="flex gap-2 mb-3">
          {[100, 250, 500].map(amount => (
            <button
              key={amount}
              onClick={() => handleAddWater(amount)}
              className="flex-1 py-2 bg-blue-500/10 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-500/20 transition-colors"
            >
              +{amount}ml
            </button>
          ))}
        </div>

        {/* Water chart */}
        {waterChartData.length > 0 && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Weight & Waist */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Weight */}
        <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Weight className="text-green-500" size={16} />
            <h3 className="font-medium text-[var(--text-primary)] text-sm">Cân nặng</h3>
          </div>
          
          <div className="space-y-2">
            <input
              type="number"
              value={weightValue}
              onChange={e => setWeightValue(e.target.value)}
              placeholder="kg"
              className="w-full px-2 py-1.5 bg-[var(--bg-surface)] rounded-lg text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)]"
            />
            <button
              onClick={handleAddWeight}
              disabled={!weightValue}
              className="w-full py-1.5 bg-green-500/10 text-green-600 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              Thêm
            </button>
            
            {latestWeight > 0 && (
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--text-primary)]">{latestWeight}kg</p>
                {bmi > 0 && goals.height && (
                  <p className="text-xs" style={{ color: bmiCategory.color }}>
                    {bmiCategory.emoji} BMI: {bmi.toFixed(1)} ({bmiCategory.label})
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Waist */}
        <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Ruler className="text-purple-500" size={16} />
            <h3 className="font-medium text-[var(--text-primary)] text-sm">Vòng bụng</h3>
          </div>
          
          <div className="space-y-2">
            <input
              type="number"
              value={waistValue}
              onChange={e => setWaistValue(e.target.value)}
              placeholder="cm"
              className="w-full px-2 py-1.5 bg-[var(--bg-surface)] rounded-lg text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)]"
            />
            <button
              onClick={handleAddWaist}
              disabled={!waistValue}
              className="w-full py-1.5 bg-purple-500/10 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            >
              Thêm
            </button>
            
            {waistEntries.length > 0 && (
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  {waistEntries[waistEntries.length - 1].value}cm
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-lg max-h-[85vh] bg-[var(--bg-elevated)] rounded-t-2xl overflow-hidden flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Cài đặt sức khỏe</h2>
              <button onClick={() => setShowSettings(false)} className="size-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)]">
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
              {/* Daily Water Goal */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Mục tiêu nước uống hàng ngày (ml)
                </label>
                <input
                  type="number"
                  value={dailyWaterGoal}
                  onChange={e => setDailyWaterGoal(parseInt(e.target.value) || 2000)}
                  className="w-full px-3 py-2 bg-[var(--bg-surface)] rounded-lg text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)]"
                />
              </div>

              {/* Weight Unit */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Đơn vị cân nặng
                </label>
                <div className="flex gap-2">
                  {(['kg', 'lbs'] as const).map(unit => (
                    <button
                      key={unit}
                      onClick={() => setWeightUnit(unit)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                        weightUnit === unit
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                      }`}
                    >
                      {unit.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goals */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Mục tiêu sức khỏe
                </label>
                <div className="space-y-2">
                  <input
                    type="number"
                    value={goals.targetWeight || ''}
                    onChange={e => setGoals({ ...goals, targetWeight: parseFloat(e.target.value) || undefined })}
                    placeholder="Cân nặng mục tiêu (kg)"
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] rounded-lg text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)]"
                  />
                  <input
                    type="number"
                    value={goals.targetWaist || ''}
                    onChange={e => setGoals({ ...goals, targetWaist: parseFloat(e.target.value) || undefined })}
                    placeholder="Vòng bụng mục tiêu (cm)"
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] rounded-lg text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)]"
                  />
                  <input
                    type="number"
                    value={goals.height || ''}
                    onChange={e => setGoals({ ...goals, height: parseFloat(e.target.value) || undefined })}
                    placeholder="Chiều cao (cm) - để tính BMI"
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] rounded-lg text-sm text-[var(--text-primary)] outline-none border border-[var(--border-subtle)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
