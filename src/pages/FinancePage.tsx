import { useMemo, useState } from 'react';
import { useTaskStore, useSettingsStore } from '@/stores';
import { getNowInTimezone } from '@/lib/notifications';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown,
  Plus, X, Wallet, Target, Flame,
  PieChart as PieIcon, BarChart2, Filter,
  History, CreditCard, Receipt, PiggyBank,
  ArrowUpRight, ArrowDownLeft, Calendar,
  LayoutDashboard, Activity, Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Period = 'week' | 'month' | 'all';
type ViewMode = 'overview' | 'chart' | 'transactions';

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  work:     { label: 'Công việc', icon: '💼', color: '#60A5FA' },
  personal: { label: 'Cá nhân',  icon: '👤', color: '#F472B6' },
  health:   { label: 'Sức khỏe', icon: '💪', color: '#34D399' },
  learning: { label: 'Học tập',  icon: '📚', color: '#A78BFA' },
  finance:  { label: 'Tài chính',icon: '💰', color: '#FBBF24' },
  social:   { label: 'Xã hội',   icon: '👥', color: '#FB923C' },
  other:    { label: 'Khác',     icon: '📌', color: '#8B8B9E' },
};

interface Budget {
  id: string;
  category: string;
  limit: number;
  period: 'week' | 'month';
}

interface ManualTx {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  note: string;
  category: string;
  date: number;
}

function loadBudgets(): Budget[] {
  try { return JSON.parse(localStorage.getItem('nw_budgets') || '[]'); } catch { return []; }
}
function saveBudgets(b: Budget[]) { localStorage.setItem('nw_budgets', JSON.stringify(b)); }
function loadManualTx(): ManualTx[] {
  try { return JSON.parse(localStorage.getItem('nw_manual_tx') || '[]'); } catch { return []; }
}
function saveManualTx(t: ManualTx[]) { localStorage.setItem('nw_manual_tx', JSON.stringify(t)); }

function formatMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString('vi-VN');
}
function formatMoneyFull(n: number) { return n.toLocaleString('vi-VN') + 'đ'; }

// ─── Summary Card ───
function SummaryCard({ label, value, icon: Icon, color, trend }: {
  label: string; value: number; icon: any; color: string; trend?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-elevated)] rounded-3xl p-5 border border-[var(--border-subtle)] relative overflow-hidden group hover:shadow-xl transition-all duration-300"
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-opacity" style={{ background: color }} />
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}30, ${color}10)`, border: `1px solid ${color}40` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
      </div>
      <div className="flex items-end justify-between">
        <h3 className="text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
          {formatMoney(value)}
        </h3>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {trend}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Budget Ring ───
function BudgetRing({ spent, limit, color }: { spent: number; limit: number; color: string }) {
  const pct = Math.min(100, limit > 0 ? (spent / limit) * 100 : 0);
  const r = 24; const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const isOver = pct >= 100;
  return (
    <div className="relative flex items-center justify-center size-16">
      <svg width="64" height="64" className="transform -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--bg-surface)" strokeWidth="6" />
        <motion.circle
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          cx="32" cy="32" r={r} fill="none"
          stroke={isOver ? 'var(--error)' : color} strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-[11px] font-black ${isOver ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

// ─── Insight Card ───
function InsightCard({ icon, text, color, title }: { icon: string; text: string; color: string; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-4 bg-[var(--bg-elevated)] rounded-2xl p-4 border-l-4 shadow-sm"
      style={{ borderLeftColor: color }}
    >
      <div className="size-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-xl shadow-inner flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1">{title}</h4>
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed font-medium">{text}</p>
      </div>
    </motion.div>
  );
}

export default function FinancePage() {
  const tasks = useTaskStore(s => s.tasks);
  const timezone = useSettingsStore(s => s.timezone);
  const [period, setPeriod] = useState<Period>('month');
  const [view, setView] = useState<ViewMode>('overview');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>(loadBudgets);
  const [manualTx, setManualTx] = useState<ManualTx[]>(loadManualTx);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txCategory, setTxCategory] = useState('other');
  const [budgetCat, setBudgetCat] = useState('other');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<'week' | 'month'>('month');

  const now = getNowInTimezone(timezone);

  const cutoffTime = useMemo(() => {
    const cutoff = period === 'week' ? 7 : period === 'month' ? 30 : 9999;
    return now.getTime() - cutoff * 86400000;
  }, [period, now.getTime()]);

  const taskTx = useMemo(() => {
    const txs: any[] = [];
    tasks.forEach(t => {
      if (t.status === 'done' && t.finance && t.completedAt && t.completedAt >= cutoffTime) {
        if (Array.isArray(t.finance)) {
          t.finance.forEach((f: any) => {
            if (f.amount > 0) {
              txs.push({
                id: f.id || `${t.id}-${Math.random()}`,
                type: f.type, amount: f.amount,
                note: f.note ? `${t.title} - ${f.note}` : t.title,
                category: f.category || t.category || 'other',
                date: t.completedAt!, source: 'task', taskId: t.id,
              });
            }
          });
        } else {
          const f = t.finance as any;
          if (f.amount > 0) {
            txs.push({
              id: t.id, type: f.type, amount: f.amount, note: t.title,
              category: t.category || 'other', date: t.completedAt!, source: 'task', taskId: t.id,
            });
          }
        }
      }
    });
    return txs;
  }, [tasks, cutoffTime]);

  const allTx = useMemo(() => [
    ...taskTx,
    ...manualTx.filter(tx => tx.date >= cutoffTime).map(tx => ({ ...tx, source: 'manual' as const })),
  ].sort((a, b) => b.date - a.date), [taskTx, manualTx, cutoffTime]);

  const filtered = useMemo(() =>
    filterType === 'all' ? allTx : allTx.filter(tx => tx.type === filterType),
    [allTx, filterType]);

  const stats = useMemo(() => {
    let income = 0, expense = 0;
    allTx.forEach(tx => { if (tx.type === 'income') income += tx.amount; else expense += tx.amount; });
    return { income, expense, net: income - expense, txCount: allTx.length };
  }, [allTx]);

  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; income: number; expense: number; net: number }> = {};
    allTx.forEach(tx => {
      const d = new Date(tx.date);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      if (!days[key]) days[key] = { date: key, income: 0, expense: 0, net: 0 };
      if (tx.type === 'income') { days[key].income += tx.amount; days[key].net += tx.amount; }
      else { days[key].expense += tx.amount; days[key].net -= tx.amount; }
    });
    return Object.values(days).slice(-14);
  }, [allTx]);

  const categoryData = useMemo(() => {
    const cats: Record<string, { name: string; icon: string; color: string; income: number; expense: number }> = {};
    allTx.forEach(tx => {
      const cfg = CATEGORY_CONFIG[tx.category] || CATEGORY_CONFIG.other;
      if (!cats[tx.category]) cats[tx.category] = { name: cfg.label, icon: cfg.icon, color: cfg.color, income: 0, expense: 0 };
      if (tx.type === 'income') cats[tx.category].income += tx.amount;
      else cats[tx.category].expense += tx.amount;
    });
    return Object.entries(cats)
      .map(([key, v]) => ({ ...v, key, total: v.expense }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [allTx]);

  const insights = useMemo(() => {
    const result: { icon: string; text: string; color: string; title: string }[] = [];
    if (stats.net > 0) result.push({ icon: '📈', title: 'Phân tích số dư', text: `Bạn đang tiết kiệm được ${formatMoneyFull(stats.net)} trong kỳ này. Tốt lắm!`, color: 'var(--success)' });
    else if (stats.net < 0) result.push({ icon: '⚠️', title: 'Cảnh báo chi tiêu', text: `Chi vượt thu ${formatMoneyFull(-stats.net)}. Hãy xem lại ngân sách.`, color: 'var(--warning)' });
    if (categoryData[0]) result.push({ icon: '🔍', title: 'Hạng mục đứng đầu', text: `Danh mục chi nhiều nhất: ${categoryData[0].icon} ${categoryData[0].name} (${formatMoneyFull(categoryData[0].expense)})`, color: 'var(--info)' });
    if (allTx.length === 0) result.push({ icon: '💡', title: 'Bắt đầu theo dõi', text: 'Chưa có giao dịch. Thêm thu/chi khi tạo task hoặc nhấn nút + bên dưới.', color: 'var(--text-muted)' });
    return result;
  }, [stats, categoryData, allTx]);

  const addTransaction = () => {
    if (!txAmount || isNaN(Number(txAmount))) return;
    const tx: ManualTx = {
      id: Date.now().toString(36),
      type: txType, amount: parseInt(txAmount),
      note: txNote || 'Giao dịch thủ công',
      category: txCategory, date: Date.now(),
    };
    const updated = [tx, ...manualTx];
    saveManualTx(updated); setManualTx(updated);
    setTxAmount(''); setTxNote(''); setShowAddTx(false);
  };

  const addBudget = () => {
    if (!budgetLimit || isNaN(Number(budgetLimit))) return;
    const b: Budget = { id: Date.now().toString(36), category: budgetCat, limit: parseInt(budgetLimit), period: budgetPeriod };
    const updated = [...budgets.filter(x => x.category !== budgetCat), b];
    saveBudgets(updated); setBudgets(updated);
    setBudgetLimit(''); setShowAddBudget(false);
  };

  const deleteTx = (id: string) => {
    const updated = manualTx.filter(tx => tx.id !== id);
    saveManualTx(updated); setManualTx(updated);
  };

  const deleteBudget = (id: string) => {
    const updated = budgets.filter(b => b.id !== id);
    saveBudgets(updated); setBudgets(updated);
  };

  const getBudgetSpent = (cat: string) =>
    allTx.filter(tx => tx.type === 'expense' && tx.category === cat).reduce((s, tx) => s + tx.amount, 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  };

  return (
    <div className="flex flex-col h-full pb-24 overflow-y-auto bg-[var(--bg-base)]">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 glass-strong border-b border-[var(--border-subtle)] px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-0.5">
            <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="text-[var(--accent-primary)]" size={22} />
              Dòng Tiền
            </h1>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[9px] font-bold text-[var(--accent-primary)] bg-[var(--accent-dim)] px-2 py-0.5 rounded-full uppercase tracking-widest">
                <CreditCard size={9} /> {allTx.length} GD
              </span>
              <span className="text-[10px] font-medium text-[var(--text-muted)]">
                {period === 'week' ? '7 ngày qua' : period === 'month' ? '30 ngày qua' : 'Tất cả'}
              </span>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => setShowAddTx(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--accent-primary)] text-[var(--bg-base)] text-xs font-black shadow-lg shadow-[var(--accent-glow)]"
          >
            <Plus size={16} strokeWidth={3} /> Thêm
          </motion.button>
        </div>

        {/* View Tabs */}
        <div className="flex p-1 gap-1 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
          {(['overview', 'chart', 'transactions'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                view === v
                  ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] shadow-md ring-1 ring-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {v === 'overview' ? <LayoutDashboard size={13} /> : v === 'chart' ? <BarChart2 size={13} /> : <History size={13} />}
              {v === 'overview' ? 'Tổng quan' : v === 'chart' ? 'Phân tích' : 'Lịch sử'}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-5 pt-5 space-y-5"
      >

        {/* Period Selector */}
        <div className="flex justify-center">
          <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-full p-1 border border-[var(--border-subtle)] shadow-lg">
            {(['week', 'month', 'all'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-5 py-1.5 rounded-full text-[10px] font-black transition-all ${
                  period === p ? 'bg-[var(--accent-primary)] text-[var(--bg-base)] shadow-md' : 'text-[var(--text-muted)]'
                }`}
              >
                {p === 'week' ? '7 NGÀY' : p === 'month' ? '30 NGÀY' : 'TẤT CẢ'}
              </button>
            ))}
          </div>
        </div>

        {/* ════════════ OVERVIEW TAB ════════════ */}
        {view === 'overview' && (
          <>
            {/* Hero Balance Card */}
            <motion.div variants={itemVariants}
              className="relative h-44 bg-[var(--bg-elevated)] rounded-[2rem] p-7 border border-[var(--border-subtle)] overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-br from-[var(--accent-primary)] to-transparent opacity-[0.05] rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/3" />
              <div className="relative h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Số dư khả dụng</span>
                  </div>
                  <h2 className={`text-4xl font-black font-mono tracking-tighter tabular-nums ${stats.net >= 0 ? 'text-[var(--text-primary)]' : 'text-[var(--error)]'}`}>
                    {stats.net >= 0 ? '+' : ''}{formatMoneyFull(stats.net)}
                  </h2>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center">
                      <Wallet size={18} className="text-[var(--accent-primary)]" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Trạng thái</p>
                      <p className="text-[11px] font-black text-[var(--text-secondary)]">
                        {stats.net >= 0 ? 'An toàn & Ổn định' : 'Cần kiểm soát chi'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Hoạt động</p>
                    <p className="text-[11px] font-black text-[var(--text-secondary)]">{stats.txCount} GD</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stats Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
              <SummaryCard label="Tổng thu" value={stats.income} icon={TrendingUp} color="#10B981" />
              <SummaryCard label="Tổng chi" value={stats.expense} icon={TrendingDown} color="#EF4444" />
            </motion.div>

            {/* Category Breakdown */}
            <motion.div variants={itemVariants} className="bg-[var(--bg-elevated)] rounded-[1.75rem] p-6 border border-[var(--border-subtle)] shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-black text-[var(--text-primary)] flex items-center gap-2 uppercase tracking-wider">
                  <PieIcon size={15} className="text-[var(--accent-primary)]" /> Cơ cấu chi phí
                </h2>
                <span className="text-[9px] font-bold text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-1 rounded-lg">Top 5</span>
              </div>
              <div className="space-y-5">
                {categoryData.length === 0 ? (
                  <div className="py-10 text-center text-[var(--text-muted)] text-[11px] italic">Chưa có dữ liệu chi tiêu</div>
                ) : (
                  categoryData.slice(0, 5).map((cat, idx) => {
                    const pct = stats.expense > 0 ? (cat.expense / stats.expense) * 100 : 0;
                    return (
                      <motion.div key={cat.key}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08 }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-xl flex items-center justify-center bg-[var(--bg-surface)]">
                              <span className="text-base">{cat.icon}</span>
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-[var(--text-primary)]">{cat.name}</p>
                              <p className="text-[9px] font-bold text-[var(--text-muted)]">{Math.round(pct)}% tổng chi</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-mono font-black text-[var(--error)]">-{formatMoney(cat.expense)}</p>
                            {cat.income > 0 && <p className="text-[9px] font-mono text-[var(--success)]">+{formatMoney(cat.income)}</p>}
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.9, delay: idx * 0.08 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>

            {/* Budgets */}
            <motion.div variants={itemVariants} className="bg-[var(--bg-elevated)] rounded-[1.75rem] border border-[var(--border-subtle)] shadow-xl overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-black text-[var(--text-primary)] flex items-center gap-2 uppercase tracking-wider">
                    <Target size={15} className="text-[var(--info)]" /> Ngân sách ({budgets.length})
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                    onClick={() => setShowAddBudget(true)}
                    className="size-8 rounded-xl bg-[var(--accent-dim)] text-[var(--accent-primary)] flex items-center justify-center"
                  >
                    <Plus size={15} strokeWidth={3} />
                  </motion.button>
                </div>
                <div className="space-y-3">
                  {budgets.length === 0 ? (
                    <div className="py-10 flex flex-col items-center gap-3 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl">
                      <Target size={28} className="text-[var(--text-muted)] opacity-30" />
                      <p className="text-[11px] text-[var(--text-muted)] font-bold text-center">Thiết lập ngân sách để<br/>kiểm soát chi tiêu.</p>
                    </div>
                  ) : (
                    budgets.map((b, idx) => {
                      const spent = getBudgetSpent(b.category);
                      const cfg = CATEGORY_CONFIG[b.category] || CATEGORY_CONFIG.other;
                      const isOver = spent > b.limit;
                      return (
                        <motion.div key={b.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08 }}
                          className="group flex items-center gap-3 bg-[var(--bg-surface)] rounded-2xl p-3.5 border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-all"
                        >
                          <BudgetRing spent={spent} limit={b.limit} color={cfg.color} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-sm">{cfg.icon}</span>
                              <span className="text-[11px] font-black text-[var(--text-primary)]">{cfg.label}</span>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase ${isOver ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                {b.period === 'month' ? 'T' : '7N'}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-[11px] font-mono font-black ${isOver ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>{formatMoney(spent)}</span>
                              <span className="text-[9px] font-bold text-[var(--text-muted)]">/ {formatMoney(b.limit)}</span>
                            </div>
                            {isOver && (
                              <p className="text-[9px] font-black text-[var(--error)] flex items-center gap-0.5 mt-0.5">
                                <Flame size={9} /> Vượt {formatMoney(spent - b.limit)}
                              </p>
                            )}
                          </div>
                          <button onClick={() => deleteBudget(b.id)}
                            className="size-7 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-red-500/10 transition-all"
                          >
                            <X size={13} />
                          </button>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>

            {/* Insights */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <LayoutDashboard size={13} className="text-[var(--accent-primary)]" />
                <h2 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Trí tuệ tài chính</h2>
              </div>
              <div className="space-y-3">
                {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
              </div>
            </div>
          </>
        )}

        {/* ════════════ ANALYTICS TAB ════════════ */}
        {view === 'chart' && (
          <div className="space-y-5">
            {/* Chart Type Pill */}
            <div className="flex justify-center">
              <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-2xl p-1 border border-[var(--border-subtle)] shadow-lg">
                {(['bar', 'line', 'pie'] as const).map(ct => (
                  <button key={ct} onClick={() => setChartType(ct)}
                    className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${
                      chartType === ct ? 'bg-[var(--accent-primary)] text-[var(--bg-base)] shadow-md' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {ct === 'bar' ? 'CỘT' : ct === 'line' ? 'XU HƯỚNG' : 'TỶ LỆ'}
                  </button>
                ))}
              </div>
            </div>

            <motion.div
              key={chartType}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[var(--bg-elevated)] rounded-[2rem] p-6 border border-[var(--border-subtle)] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-black text-[var(--text-primary)] tracking-tight">
                    {chartType === 'bar' ? 'Biến động Thu - Chi' : chartType === 'line' ? 'Xu hướng Số dư ròng' : 'Cơ cấu Chi tiêu'}
                  </h2>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Dữ liệu thời gian thực</p>
                </div>
                {chartType !== 'pie' && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-[#34D399]" /><span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Thu</span></div>
                    {chartType === 'bar' && <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-[#F87171]" /><span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Chi</span></div>}
                  </div>
                )}
              </div>

              {dailyData.length === 0 && categoryData.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                  <BarChart2 size={44} className="opacity-10" />
                  <p className="text-[11px] font-bold italic">Chưa đủ dữ liệu để hiển thị</p>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34D399" stopOpacity={0.85}/>
                            <stop offset="100%" stopColor="#34D399" stopOpacity={0.2}/>
                          </linearGradient>
                          <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#F87171" stopOpacity={0.85}/>
                            <stop offset="100%" stopColor="#F87171" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-muted)' }} dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-muted)' }} width={42} tickFormatter={v => formatMoney(v)} />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                          contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
                          formatter={(v: number, name: string) => [formatMoneyFull(v), name === 'income' ? 'Thu nhập' : 'Chi phí']}
                        />
                        <Bar dataKey="income" fill="url(#ig)" radius={[5, 5, 0, 0]} maxBarSize={14} />
                        <Bar dataKey="expense" fill="url(#eg)" radius={[5, 5, 0, 0]} maxBarSize={14} />
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="ng" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-muted)' }} dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-muted)' }} width={42} tickFormatter={v => formatMoney(v)} />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
                          formatter={(v: number) => [formatMoneyFull(v), 'Số dư ròng']}
                        />
                        <Area type="monotone" dataKey="net" stroke="var(--accent-primary)" strokeWidth={3} fill="url(#ng)" />
                      </AreaChart>
                    ) : (
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="expense" strokeWidth={0}>
                          {categoryData.map((cat, i) => <Cell key={i} fill={cat.color} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
                          formatter={(v: number, _, props) => [formatMoneyFull(v), props.payload?.name]}
                        />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
              {chartType === 'pie' && categoryData.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-5 justify-center">
                  {categoryData.map(cat => (
                    <div key={cat.key} className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)]">
                      <div className="size-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wide">{cat.icon} {cat.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Performance stats */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg-elevated)] rounded-3xl p-5 border border-[var(--border-subtle)] shadow-xl">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-3">Tỷ lệ chi</p>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black font-mono text-[var(--success)] leading-none">
                    {stats.income > 0 ? Math.round((stats.expense / stats.income) * 100) : 0}%
                  </span>
                  <div className="size-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center">
                    <TrendingUp size={16} className="text-[var(--success)]" />
                  </div>
                </div>
              </div>
              <div className="bg-[var(--bg-elevated)] rounded-3xl p-5 border border-[var(--border-subtle)] shadow-xl">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-3">Tổng GD</p>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black font-mono text-[var(--info)] leading-none">{stats.txCount}</span>
                  <div className="size-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center">
                    <Receipt size={16} className="text-[var(--info)]" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* ════════════ TRANSACTIONS TAB ════════════ */}
        {view === 'transactions' && (
          <div className="space-y-5">
            {/* Filter */}
            <div className="flex justify-center">
              <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-full p-1 border border-[var(--border-subtle)] shadow-lg">
                {(['all', 'income', 'expense'] as const).map(f => (
                  <button key={f} onClick={() => setFilterType(f)}
                    className={`px-4 py-1.5 rounded-full text-[9px] font-black transition-all ${
                      filterType === f ? 'bg-[var(--accent-primary)] text-[var(--bg-base)] shadow-md' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {f === 'all' ? 'TẤT CẢ' : f === 'income' ? 'THU NHẬP' : 'CHI TIÊU'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center">
                  <Search size={12} className="text-[var(--text-muted)]" />
                </div>
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{filtered.length} giao dịch</p>
              </div>
              <div className="size-7 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center">
                <Filter size={12} className="text-[var(--text-muted)]" />
              </div>
            </div>

            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 bg-[var(--bg-elevated)] rounded-[2rem] border-2 border-dashed border-[var(--border-subtle)]"
              >
                <div className="size-16 rounded-full bg-[var(--bg-surface)] flex items-center justify-center mb-4">
                  <Receipt size={32} className="text-[var(--text-muted)] opacity-20" />
                </div>
                <p className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest">Không có giao dịch</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2 italic text-center px-8">Nhấn + để thêm giao dịch đầu tiên.</p>
              </motion.div>
            ) : (
              <div className="space-y-2.5">
                {filtered.map((tx, idx) => {
                  const cfg = CATEGORY_CONFIG[tx.category] || CATEGORY_CONFIG.other;
                  const isIncome = tx.type === 'income';
                  return (
                    <motion.div key={tx.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="group flex items-center gap-3.5 bg-[var(--bg-elevated)] rounded-2xl p-4 border border-[var(--border-subtle)] hover:border-[var(--border-accent)] hover:shadow-lg transition-all duration-200"
                    >
                      <div className="size-11 rounded-2xl flex items-center justify-center text-xl bg-[var(--bg-surface)] flex-shrink-0">
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-[var(--text-primary)] truncate">{tx.note}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-0.5 text-[8px] font-bold text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-md uppercase">
                            <Calendar size={7} /> {new Date(tx.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </span>
                          <span className="text-[8px] font-bold uppercase tracking-tight" style={{ color: `${cfg.color}CC` }}>{cfg.label}</span>
                          {(tx as any).source === 'manual' && (
                            <span className="text-[7px] font-black bg-[var(--accent-dim)] px-1.5 py-0.5 rounded text-[var(--accent-primary)] uppercase">Manual</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`text-[13px] font-mono font-black tabular-nums ${isIncome ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                            {isIncome ? '+' : '-'}{formatMoney(tx.amount)}
                          </p>
                          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">{isIncome ? 'Thu' : 'Chi'}</p>
                        </div>
                        {(tx as any).source === 'manual' && (
                          <button onClick={() => deleteTx(tx.id)}
                            className="size-7 rounded-lg opacity-0 group-hover:opacity-100 bg-red-500/10 flex items-center justify-center text-[var(--error)] transition-all"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ════════════ ADD TRANSACTION MODAL ════════════ */}
      <AnimatePresence>
        {showAddTx && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowAddTx(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 200 }}
              className="w-full max-w-lg bg-[var(--bg-elevated)] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 border border-[var(--border-subtle)] shadow-2xl relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-[var(--accent-primary)] to-transparent opacity-[0.06] rounded-full blur-3xl" />
              <div className="relative flex items-center justify-between mb-7">
                <div>
                  <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">Thêm Giao Dịch</h3>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Ghi chép thu chi nhanh chóng</p>
                </div>
                <button onClick={() => setShowAddTx(false)}
                  className="size-9 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-red-500/10 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Income/Expense Toggle */}
              <div className="flex gap-2 mb-5 bg-[var(--bg-surface)] rounded-2xl p-1 border border-[var(--border-subtle)]">
                {(['income', 'expense'] as const).map(t => (
                  <button key={t} onClick={() => setTxType(t)}
                    className={`flex-1 py-3 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                      txType === t
                        ? t === 'income' ? 'bg-[var(--success)] text-white shadow-lg' : 'bg-[var(--error)] text-white shadow-lg'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {t === 'income' ? <ArrowUpRight size={14} strokeWidth={3} /> : <ArrowDownLeft size={14} strokeWidth={3} />}
                    {t === 'income' ? 'THU NHẬP' : 'CHI TIÊU'}
                  </button>
                ))}
              </div>

              <div className="space-y-3 mb-7">
                <div className="relative">
                  <DollarSign size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="number" value={txAmount}
                    onChange={e => setTxAmount(e.target.value)}
                    placeholder="Số tiền (VND)" inputMode="numeric"
                    className="w-full bg-[var(--bg-surface)] rounded-2xl pl-11 pr-4 py-4 text-lg font-black font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] transition-all"
                  />
                </div>
                <div className="relative">
                  <History size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text" value={txNote}
                    onChange={e => setTxNote(e.target.value)}
                    placeholder="Ghi chú giao dịch"
                    className="w-full bg-[var(--bg-surface)] rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] transition-all"
                  />
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">Danh mục</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                      <button key={k} onClick={() => setTxCategory(k)}
                        className={`py-2.5 rounded-2xl flex flex-col items-center gap-1 text-[9px] font-black transition-all border ${
                          txCategory === k
                            ? 'bg-[var(--accent-dim)] border-[var(--accent-primary)] text-[var(--accent-primary)] scale-105'
                            : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-muted)]'
                        }`}
                      >
                        <span className="text-lg">{v.icon}</span>
                        <span className="uppercase tracking-tighter">{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={addTransaction} disabled={!txAmount}
                className="w-full py-4 rounded-[1.5rem] text-sm font-black text-[var(--bg-base)] bg-[var(--accent-primary)] disabled:opacity-30 shadow-xl shadow-[var(--accent-glow)] flex items-center justify-center gap-2"
              >
                <Plus size={17} strokeWidth={3} /> LƯU GIAO DỊCH
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════ ADD BUDGET MODAL ════════════ */}
      <AnimatePresence>
        {showAddBudget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowAddBudget(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 200 }}
              className="w-full max-w-lg bg-[var(--bg-elevated)] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 border border-[var(--border-subtle)] shadow-2xl relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-[var(--info)] to-transparent opacity-[0.06] rounded-full blur-3xl" />
              <div className="relative flex items-center justify-between mb-7">
                <div>
                  <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">Thiết Lập Ngân Sách</h3>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Kiểm soát chi tiêu thông minh</p>
                </div>
                <button onClick={() => setShowAddBudget(false)}
                  className="size-9 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-red-500/10 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mb-5">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">Chọn danh mục</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <button key={k} onClick={() => setBudgetCat(k)}
                      className={`py-2.5 rounded-2xl flex flex-col items-center gap-1 text-[9px] font-black transition-all border ${
                        budgetCat === k
                          ? 'bg-[var(--accent-dim)] border-[var(--info)] text-[var(--info)] scale-105'
                          : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-muted)]'
                      }`}
                    >
                      <span className="text-lg">{v.icon}</span>
                      <span className="uppercase tracking-tighter">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 mb-7">
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-1">Chu kỳ</p>
                  <div className="flex gap-2 bg-[var(--bg-surface)] rounded-2xl p-1 border border-[var(--border-subtle)]">
                    {(['week', 'month'] as const).map(p => (
                      <button key={p} onClick={() => setBudgetPeriod(p)}
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${
                          budgetPeriod === p ? 'bg-[var(--accent-dim)] text-[var(--accent-primary)] shadow-sm' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {p === 'week' ? 'HẰNG TUẦN' : 'HẰNG THÁNG'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <Target size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="number" value={budgetLimit}
                    onChange={e => setBudgetLimit(e.target.value)}
                    placeholder="Hạn mức (VND)" inputMode="numeric"
                    className="w-full bg-[var(--bg-surface)] rounded-2xl pl-11 pr-4 py-4 text-lg font-black font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] transition-all"
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={addBudget} disabled={!budgetLimit}
                className="w-full py-4 rounded-[1.5rem] text-sm font-black text-[var(--bg-base)] bg-[var(--accent-primary)] disabled:opacity-30 shadow-xl shadow-[var(--accent-glow)] flex items-center justify-center gap-2"
              >
                <Target size={17} strokeWidth={3} /> THIẾT LẬP NGAY
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
