import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, BarChart, Bar,
} from 'recharts';
import { analyticsAPI, transactionsAPI, incomeAPI } from '../api';
import { useAuthStore, useUIStore } from '../store/authStore';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import { CardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { RegretBadge } from '../components/ui/Badge';
import { formatINR, formatCompact } from '../utils/formatCurrency';
import { getCategoryMeta, CHART_COLORS } from '../constants/categories';
import { chartDefaults } from '../utils/chartTheme';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Flame, AlertTriangle, ChevronRight, ChevronDown, Plus, Sun, Cloud, CloudRain, Landmark, Banknote, Wallet, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

import MobilePage from '../components/layout/MobilePage';
import TransactionRow from '../components/features/TransactionRow';
import { useIsMobile } from '../hooks/useMediaQuery';

const listContainer = { animate: { transition: { staggerChildren: 0.06 } } };
const listItem = { initial: { opacity: 0, x: -12 }, animate: { opacity: 1, x: 0 } };

// ─── Feature 2: Pool Usage Progress Ring ────────────────────────────────────
function ProgressRing({ pct }) {
  const size = 48, stroke = 4, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = pct > 100 ? 100 : pct < 0 ? 0 : pct;
  const color = fill < 70 ? '#10b981' : fill < 90 ? '#f59e0b' : '#ef4444';
  const dashOffset = useRef(circ);
  useEffect(() => { dashOffset.current = circ - (fill / 100) * circ; }, [fill, circ]);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (fill / 100) * circ }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <span style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 11, fontWeight: 700,
        color, fontFamily: 'Outfit',
      }}>{fill}%</span>
    </div>
  );
}

// ─── Feature 5: Regret Score Breakdown ──────────────────────────────────────
function RegretBreakdownAccordion({ breakdown, regretScore }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="kpi-card-regret" style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }} onClick={() => setOpen(o => !o)}>
        <div>
          <p className="text-xs text-vault-text-muted uppercase tracking-wide mb-1">Regret score</p>
          <p className="kpi-number kpi-number-red mb-2">{regretScore || 0}%</p>
          <p className="text-xs text-vault-text-muted mt-2">of rated spends</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ marginTop: 4 }}>
          <ChevronDown size={14} className="text-vault-text-muted" />
        </motion.div>
      </div>
      <AnimatePresence>
        {open && breakdown && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', marginTop: 10, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { key: 'regret',   label: '✗ Regret',   color: '#ef4444' },
                { key: 'okay',     label: '~ Okay',     color: '#f59e0b' },
                { key: 'worth_it', label: '✓ Worth it', color: '#10b981' },
              ].map(({ key, label, color }) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Inter', fontSize: 11, color }}>{label}</span>
                  <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#9295A8' }}>
                    {breakdown[key]?.count || 0} · {formatINR(breakdown[key]?.total || 0)}
                  </span>
                </div>
              ))}
              <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', marginTop: 4, paddingTop: 6 }}>
                <span style={{ fontFamily: 'Inter', fontSize: 10, color: '#4A4E65' }}>
                  {breakdown.rated} of {breakdown.total} rated this month
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Feature 6: Zero-Day Streak Badges ──────────────────────────────────────
const STREAK_MILESTONES = [
  { days: 30, emoji: '💎', label: 'Monthly Master',   color: '#a78bfa', border: 'rgba(167,139,250,0.35)' },
  { days: 14, emoji: '🥇', label: '2 Week Champion',  color: '#f59e0b', border: 'rgba(245,158,11,0.35)'  },
  { days: 7,  emoji: '🥈', label: 'Week Warrior',     color: '#9ca3af', border: 'rgba(156,163,175,0.35)' },
  { days: 3,  emoji: '🥉', label: '3 Day Streak',     color: '#cd7c2f', border: 'rgba(205,124,47,0.35)'  },
];

function StreakMilestoneBadge({ streak }) {
  const badge = STREAK_MILESTONES.find(m => streak >= m.days);
  if (!badge) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontFamily: 'Inter', fontWeight: 600,
      padding: '3px 8px', borderRadius: 100,
      border: `1px solid ${badge.border}`,
      color: badge.color, background: `${badge.border.replace('0.35', '0.08')}`,
      marginTop: 6,
    }}>
      {badge.emoji} {badge.label}
    </span>
  );
}

function useStreakMilestoneToast(streak) {
  useEffect(() => {
    if (!streak) return;
    const milestone = STREAK_MILESTONES.find(m => streak === m.days);
    if (!milestone) return;
    const key = `vault_streak_toast_${milestone.days}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    toast(`🔥 ${milestone.days} day no-spend streak! ${milestone.emoji} Keep it going.`, {
      style: { background: '#1a1206', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' },
      duration: 4500,
    });
  }, [streak]);
}

// ─── Feature 7: Top Regret Category Card ────────────────────────────────────
function TopRegretCategoryCard({ transactions, tfmTab }) {
  if (!transactions?.length) return null;
  const regretTxns = transactions.filter(t => t.regretStatus === 'regret');
  const catMap = {};
  regretTxns.forEach(t => {
    if (!catMap[t.category]) catMap[t.category] = { amount: 0, count: 0 };
    catMap[t.category].amount += t.amount;
    catMap[t.category].count++;
  });
  const sorted = Object.entries(catMap).sort((a, b) => b[1].amount - a[1].amount);
  const noRegrets = sorted.length === 0;

  const periodLabel = 
    tfmTab === 'last_month' ? 'Last Month' :
    tfmTab === '3_months' ? 'Last 3 Months' :
    tfmTab === 'all_time' ? 'All Time' : 'This Month';

  return (
    <Card style={{ background: noRegrets ? 'rgba(16,185,129,0.04)' : undefined, border: noRegrets ? '0.5px solid rgba(16,185,129,0.2)' : undefined }}>
      <p className="text-xs text-vault-text-muted uppercase tracking-wide mb-2">Top Regret Category · {periodLabel}</p>
      {noRegrets ? (
        <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#10b981', fontWeight: 500 }}>
          ✓ No regrets in this period — great discipline!
        </p>
      ) : (
        <>
          <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: '#EAEDF5' }}>
            {sorted[0][0]}
          </p>
          <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#9295A8', marginTop: 3 }}>
            {formatINR(sorted[0][1].amount)} spent · {sorted[0][1].count} transaction{sorted[0][1].count > 1 ? 's' : ''} marked Regret
          </p>
          <p style={{ fontFamily: 'Inter', fontSize: 10, color: '#4A4E65', marginTop: 5 }}>Consider reviewing this category</p>
        </>
      )}
    </Card>
  );
}

// ─── Feature 1 & 3: True Free Money Time Filter + Sparkline ─────────────────
const TFM_TABS = [
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: '3 Months',   value: '3_months' },
  { label: 'All Time',   value: 'all_time' },
];

function AnimatedCounter({ value, prefix = '₹' }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="tabular-nums"
    >
      {prefix}{value?.toLocaleString('en-IN') || '0'}
    </motion.span>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="glass-card px-3 py-2 text-xs">
        <p className="text-vault-text-muted mb-1">Day {label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {formatINR(p.value)}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const { setAddTransactionOpen } = useUIStore();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsAPI.getDashboard().then(r => r.data),
  });

  const [tfmTab, setTfmTab] = useState('this_month');
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
  
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const { data: historicalWf, refetch: refetchTfm } = useQuery({
    queryKey: ['historical-waterfall', tfmTab],
    queryFn: async () => {
      const { analyticsAPI } = await import('../api');
      const res = await analyticsAPI.getTfm(tfmTab).then(r => r.data);
      return {
        income: res.pool,
        budgetPool: res.budgetPool ?? res.pool,
        actualIncome: res.actualIncome,
        isCarryForward: res.isCarryForward ?? false,
        carryForwardAmount: res.carryForwardAmount ?? 0,
        totalCommitments: res.commitmentsTotal,
        variableSpending: res.variableSpend,
        trueFreeMonney: res.trueFreeMoney,
        numberOfMonths: res.numberOfMonths,
      };
    },
    enabled: true,
  });

  // Income entries for This Month
  const { data: incomeData, refetch: refetchIncome } = useQuery({
    queryKey: ['income', currentMonthStr],
    queryFn: () => incomeAPI.get(currentMonthStr).then(r => r.data),
  });

  const logIncomeMutation = useMutation({
    mutationFn: (payload) => incomeAPI.log(payload),
    onSuccess: () => {
      toast.success('Income logged!');
      setIncomeModalOpen(false);
      setIncomeForm({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), note: '' });
      refetchIncome();
      refetchTfm();
      qc.invalidateQueries({ queryKey: ['historical-waterfall', 'this_month'] });
    },
    onError: () => toast.error('Failed to log income'),
  });

  const handleLogIncome = () => {
    const amt = parseFloat(incomeForm.amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    logIncomeMutation.mutate({ amount: amt, date: incomeForm.date, note: incomeForm.note });
  };

  const { data: sparklineData } = useQuery({
    queryKey: ['tfm-sparkline', tfmTab],
    queryFn: async () => {
      const { commitmentsAPI } = await import('../api');
      
      if (tfmTab === '3_months' || tfmTab === 'all_time') {
        const numMonths = tfmTab === '3_months' ? 3 : 6;
        const results = await Promise.all(Array.from({length: numMonths}).map((_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1) + i, 1);
          return commitmentsAPI.getWaterfall({ month: d.getMonth() + 1, year: d.getFullYear() }).then(r => ({
            name: d.toLocaleDateString('en-US', { month: 'short' }),
            value: r.data.trueFreeMonney || 0
          }));
        }));
        return results;
      } else {
        const isThisMonth = tfmTab === 'this_month';
        const targetDate = isThisMonth ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const wf = await commitmentsAPI.getWaterfall({ month: targetDate.getMonth() + 1, year: targetDate.getFullYear() }).then(r => r.data);
        
        const { transactionsAPI } = await import('../api');
        const { startOfMonth, endOfMonth, format } = await import('date-fns');
        const start = startOfMonth(targetDate);
        const end = endOfMonth(targetDate);
        const txnsRes = await transactionsAPI.getAll({ 
          startDate: format(start, 'yyyy-MM-dd'), 
          endDate: format(end, 'yyyy-MM-dd'),
          limit: 10000
        });
        const spendTxns = (txnsRes.data.data || txnsRes.data.transactions || []).filter(t => !t.isATMWithdrawal && t.paymentMode !== 'Cash');
        
        const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
        const basePool = wf.income || 0;
        const totalComm = wf.totalCommitments || 0;
        
        let dailyWf = [];
        let cumulativeSpend = 0;
        
        for (let day = 1; day <= daysInMonth; day++) {
          if (isThisMonth && day > now.getDate()) break;
          const dayTxns = spendTxns.filter(t => new Date(t.date).getDate() === day);
          cumulativeSpend += dayTxns.reduce((s, t) => s + t.amount, 0);
          dailyWf.push({ name: `Day ${day}`, value: basePool - totalComm - cumulativeSpend });
        }
        return dailyWf;
      }
    },
  });

  const { data: chartDataRaw, isLoading: isChartLoading } = useQuery({
    queryKey: ['dashboard-charts-txns', tfmTab],
    queryFn: async () => {
      const { transactionsAPI } = await import('../api');
      const { startOfMonth, endOfMonth, subMonths, format } = await import('date-fns');
      let start, end;
      
      if (tfmTab === 'last_month') {
        const lm = subMonths(now, 1);
        start = startOfMonth(lm);
        end = endOfMonth(lm);
      } else if (tfmTab === '3_months') {
        start = startOfMonth(subMonths(now, 2));
        end = endOfMonth(now);
      } else if (tfmTab === 'all_time') {
        start = new Date(2000, 0, 1);
        end = endOfMonth(now);
      } else {
        start = startOfMonth(now);
        end = endOfMonth(now);
      }
      
      const res = await transactionsAPI.getAll({ 
        startDate: format(start, 'yyyy-MM-dd'), 
        endDate: format(end, 'yyyy-MM-dd'),
        limit: 10000
      });
      return res.data.data || res.data.transactions || [];
    }
  });

  const processedCharts = useMemo(() => {
    if (!chartDataRaw) return { dailySpend: [], categoryBreakdown: [] };
    
    const spendTxns = chartDataRaw.filter(t => !t.isATMWithdrawal && t.paymentMode !== 'Cash');
    
    // Category Breakdown
    const catMap = {};
    spendTxns.forEach(t => {
      if (!catMap[t.category]) catMap[t.category] = { name: t.category, value: 0 };
      catMap[t.category].value += t.amount;
    });
    const categoryBreakdown = Object.values(catMap).sort((a, b) => b.value - a.value);
    
    // Daily Spending
    let dailySpend = [];
    
    if (tfmTab === 'this_month' || tfmTab === 'last_month') {
      const isThisMonth = tfmTab === 'this_month';
      const targetMonth = isThisMonth ? now.getMonth() : (now.getMonth() === 0 ? 11 : now.getMonth() - 1);
      const targetYear = isThisMonth ? now.getFullYear() : (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      
      let cumulative = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const isFuture = isThisMonth && day > now.getDate();
        // Compare using local month/year to avoid UTC offset issues
        const dayTxns = spendTxns.filter(t => {
          const d = new Date(t.date);
          return d.getFullYear() === targetYear && d.getMonth() === targetMonth && d.getDate() === day;
        });
        const dayTotal = dayTxns.reduce((s, t) => s + t.amount, 0);
        if (!isFuture) cumulative += dayTotal;
        dailySpend.push({ 
          day: day.toString(), 
          cumulative: isFuture ? null : cumulative 
        });
      }
    } else if (tfmTab === '3_months') {
      const dateMap = {};
      spendTxns.forEach(t => {
        const dStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dateMap[dStr] = (dateMap[dStr] || 0) + t.amount;
      });
      
      let d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      while (d <= now) {
        const dStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailySpend.push({ day: dStr, cumulative: dateMap[dStr] || 0 });
        d.setDate(d.getDate() + 1);
      }
    } else if (tfmTab === 'all_time') {
      const monthMap = {};
      spendTxns.forEach(t => {
        const dStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthMap[dStr] = (monthMap[dStr] || 0) + t.amount;
      });
      
      const uniqueMonths = [...new Set(spendTxns.map(t => {
        const d = new Date(t.date); return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      }))].sort((a,b) => a - b);
      
      uniqueMonths.forEach(timestamp => {
        const dStr = new Date(timestamp).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        const shortMonth = new Date(timestamp).toLocaleDateString('en-US', { month: 'short' });
        dailySpend.push({ month: shortMonth, amount: monthMap[dStr] || 0 });
      });
    }
    
    return { dailySpend, categoryBreakdown };
  }, [chartDataRaw, tfmTab]);

  const dynamicKpi = useMemo(() => {
    if (!chartDataRaw) return null;
    const spendTxns = chartDataRaw.filter(t => !t.isATMWithdrawal && t.paymentMode !== 'Cash');
    const totalSpend = spendTxns.reduce((s, t) => s + t.amount, 0);
    
    const ratedTxns = spendTxns.filter(t => t.regretStatus !== 'pending' && t.regretStatus !== 'unrated');
    const regretCount = ratedTxns.filter(t => t.regretStatus === 'regret').length;
    const regretScore = ratedTxns.length > 0 ? Math.round((regretCount / ratedTxns.length) * 100) : 0;
    
    const catMap = {};
    const regretTxns = spendTxns.filter(t => t.regretStatus === 'regret');
    regretTxns.forEach(t => {
      if (!catMap[t.category]) catMap[t.category] = { amount: 0, count: 0 };
      catMap[t.category].amount += t.amount;
      catMap[t.category].count++;
    });
    const sortedCats = Object.entries(catMap).sort((a, b) => b[1].amount - a[1].amount);
    const topRegretCategory = sortedCats.length > 0 ? {
      name: sortedCats[0][0],
      amount: sortedCats[0][1].amount,
      count: sortedCats[0][1].count
    } : null;

    return { totalSpend, regretScore, topRegretCategory, spendTxns };
  }, [chartDataRaw]);

  const displayWf = historicalWf;

  const { data: envData } = useQuery({
    queryKey: ['cash-envelope', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => import('../api').then(m => m.cashAPI.getEnvelope({ month: now.getMonth() + 1, year: now.getFullYear() }).then(r => r.data)),
  });

  const rateMutation = useMutation({
    mutationFn: ({ id, rating }) => transactionsAPI.rateRegret(id, rating),
    onMutate: async ({ id, rating }) => {
      await qc.cancelQueries({ queryKey: ['dashboard'] });
      const prev = qc.getQueryData(['dashboard']);
      qc.setQueryData(['dashboard'], old => ({
        ...old,
        pendingRegret: old.pendingRegret.filter(t => t.id !== id),
      }));
      return { prev };
    },
    onError: (_, __, ctx) => { qc.setQueryData(['dashboard'], ctx.prev); toast.error('Failed to rate'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Rated!'); },
  });

  const kpi = data?.kpi;
  useStreakMilestoneToast(kpi?.zeroDayStreak);
  const forecast = data?.forecast;
  const budget = kpi?.budget;
  const budgetPct = kpi?.budgetPercent ?? 0;
  const budgetLeft = kpi?.budgetRemaining;
  const isOverBudget = kpi?.isOverBudget;
  const budgetSource = kpi?.budgetSource || 'none';
  const budgetLabel = kpi?.budgetLabel || 'No budget set';
  const budgetColor = !budget ? '#4A4E65' : budgetPct < 60 ? '#00C896' : budgetPct < 85 ? '#F5A623' : '#FF5A5A';
  const forecastOvershoot = forecast?.overshoot || 0;

  const uiKpi = useMemo(() => {
    if (!dynamicKpi) return null;
    const baseBudget = budget || 0;
    
    let spentLabel = 'SPENT THIS MONTH';
    let poolLabel = 'POOL REMAINING';
    let spentValue = dynamicKpi.totalSpend;
    let poolLine = baseBudget ? `Pool: ${formatINR(baseBudget)}` : 'No budget set';
    let poolLeft = baseBudget - spentValue;
    let progressPct = baseBudget > 0 ? Math.min(Math.round((spentValue / baseBudget) * 100), 100) : 0;
    
    if (tfmTab === 'last_month') {
      spentLabel = 'SPENT LAST MONTH';
      poolLabel = 'LAST MONTH REMAINING';
    } else if (tfmTab === '3_months') {
      spentLabel = 'AVG MONTHLY SPEND';
      poolLabel = 'AVG MONTHLY REMAINING';
      spentValue = Math.round(dynamicKpi.totalSpend / 3);
      poolLeft = baseBudget - spentValue;
      poolLine = baseBudget ? `Monthly avg · ${formatINR(baseBudget)} pool` : 'Monthly avg';
      progressPct = baseBudget > 0 ? Math.min(Math.round((spentValue / baseBudget) * 100), 100) : 0;
    } else if (tfmTab === 'all_time') {
      spentLabel = 'TOTAL SPENT';
      poolLabel = 'AVG MONTHLY REMAINING';
      poolLine = 'Since account created';
      const numMonths = displayWf?.numberOfMonths || 1;
      poolLeft = baseBudget - Math.round(dynamicKpi.totalSpend / numMonths);
      progressPct = baseBudget > 0 && spentValue > baseBudget ? 100 : (baseBudget > 0 ? Math.min(Math.round((spentValue / baseBudget) * 100), 100) : 0);
    }
    
    return { spentLabel, poolLabel, spentValue, poolLine, poolLeft, progressPct };
  }, [dynamicKpi, budget, tfmTab, displayWf]);
  const dayOfMonth = new Date().getDate();
  const forecastConf = forecast?.confidence;
  const forecastMsg  = forecast?.message;

  // Smart weather icon — only relevant from day 5
  const weatherIcon = !budget ? <Cloud size={20} className="text-vault-text-muted" /> :
    forecastOvershoot <= -2000 ? <Sun size={20} className="text-vault-teal" /> :
    forecastOvershoot <= 500   ? <Cloud size={20} className="text-vault-amber" /> :
      <CloudRain size={20} className="text-vault-red" />;
  const weatherMsg = !budget ? 'Set a budget to see spending forecasts' :
    forecastOvershoot <= -2000 ? "You're well under budget! 🌟" :
    forecastOvershoot <= 500   ? "Approaching budget — watch your pace." :
      `On track to overshoot by ${formatINR(Math.abs(forecastOvershoot))}`;

  return (
    <>
    <MobilePage title="Dashboard">
    <PageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-vault-text-primary">
              Hey, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-vault-text-secondary text-sm mt-0.5">
              {format(new Date(), 'EEEE, MMMM d')} — Here's your financial snapshot
            </p>
          </div>
          <button
            onClick={() => setAddTransactionOpen(true)}
            className="hidden md:flex items-center gap-2 btn-amber px-4 py-2 rounded-vault-md text-sm"
          >
            <Plus size={16} /> Add Spend
          </button>
        </div>

        {/* KPI Strip */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <motion.div variants={listContainer} initial="initial" animate="animate" 
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: isMobile ? '10px' : '16px',
            }}>
            {/* Total Spent */}
            <motion.div variants={listItem}>
              <Card className="col-span-1 kpi-card-spent">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-vault-text-muted uppercase tracking-wide mb-1">{uiKpi?.spentLabel || 'Spent'}</p>
                    <p className="kpi-number kpi-number-amber mb-2">
                      <AnimatedCounter value={uiKpi?.spentValue} />
                    </p>
                  </div>
                  {budget && <ProgressRing pct={uiKpi?.progressPct || 0} />}
                </div>
                {budget ? (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-vault-text-muted mb-1">
                      <span>{uiKpi?.poolLine}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs mt-2" style={{ color: '#F5A623' }}>
                    <Link to="/settings" style={{ color: '#F5A623', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>Set a budget in Settings →</Link>
                  </p>
                )}
              </Card>
            </motion.div>

            {/* Budget Remaining */}
            <motion.div variants={listItem}>
              <Card className="kpi-card-budget">
                <p className="text-xs text-vault-text-muted uppercase tracking-wide mb-1">
                  {uiKpi?.poolLabel || 'Pool remaining'}
                </p>
                {budget ? (
                  <>
                    <p className="kpi-number kpi-number-teal mb-2">
                      <AnimatedCounter value={Math.abs(uiKpi?.poolLeft || 0)} />
                    </p>
                    <p className="text-xs mt-2" style={{ color: budgetColor }}>
                      {(uiKpi?.poolLeft || 0) < 0
                        ? <span className="flex items-center gap-1"><TrendingUp size={12} /> Over by {formatINR(Math.abs(uiKpi?.poolLeft))}</span>
                        : (uiKpi?.poolLeft || 0) < budget * 0.2
                        ? <span className="flex items-center gap-1">⚠ Running low</span>
                        : <span className="flex items-center gap-1"><TrendingDown size={12} /> Under budget</span>
                      }
                    </p>
                  </>
                ) : (
                  <p className="kpi-number" style={{ color: '#4A4E65' }}>—</p>
                )}
              </Card>
            </motion.div>

            {/* Regret Score Breakdown */}
            <motion.div variants={listItem}>
              <RegretBreakdownAccordion breakdown={data?.regretBreakdown} regretScore={dynamicKpi?.regretScore} />
            </motion.div>

            {/* Zero Day Streak */}
            <motion.div variants={listItem}>
              <Card className="kpi-card-streak">
                <p className="text-xs text-vault-text-muted uppercase tracking-wide mb-1">Zero-day streak</p>
                <p className="kpi-number kpi-number-purple mb-2 flex items-center gap-2">
                  {(kpi?.zeroDayStreak || 0) > 3 && <Flame size={20} className="text-orange-400 animate-pulse-slow" />}
                  {kpi?.zeroDayStreak || 0} days
                </p>
                <p className="text-xs text-vault-text-muted mt-2">no-spend streak</p>
                <StreakMilestoneBadge streak={kpi?.zeroDayStreak || 0} />
              </Card>
            </motion.div>
          </motion.div>
        )}

        {/* Feature 7: Top Regret Category Card */}
        {!isLoading && dynamicKpi && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TopRegretCategoryCard transactions={dynamicKpi.spendTxns} tfmTab={tfmTab} />
          </div>
        )}

        {/* Safe to Spend + Time Tabs Widget */}
        {displayWf && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '14px',
            marginBottom: '14px',
          }}>
            <Card glow="amber">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Landmark size={18} className="text-vault-amber" />
                  <h2 className="font-display font-semibold text-vault-text-primary">Safe to Spend</h2>
                </div>
                {/* Time Filter Pills */}
                <div className="flex gap-1 bg-white/05 p-1 rounded-full border border-white/10">
                  {TFM_TABS.map(tab => (
                    <button
                      key={tab.value}
                      onClick={() => setTfmTab(tab.value)}
                      className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${
                        tfmTab === tab.value ? 'bg-vault-amber text-[#1a1206]' : 'text-vault-text-muted hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {!data?.hasAccounts ? (
                // No accounts yet
                <div>
                  <p className="text-vault-text-muted text-sm mb-3 leading-relaxed">
                    Add your bank accounts to see your real balance and spending power.
                  </p>
                  <Link to="/my-money" className="btn-amber text-sm px-4 py-2 rounded-vault-md inline-flex items-center gap-2" style={{ textDecoration: 'none' }}>
                    + Add Account
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Main Safe to Spend number */}
                  <div className="flex justify-between items-end gap-2">
                    <div>
                      <p className={`text-3xl font-display font-bold tabular-nums ${
                        (data?.safeToSpend ?? 0) >= 0 ? 'text-vault-teal' : 'text-vault-red'
                      }`}>
                        {(data?.safeToSpend ?? 0) < 0 && <span className="text-xl mr-1">−</span>}
                        <AnimatedCounter value={Math.abs(data?.safeToSpend ?? 0)} />
                      </p>
                      <p className="text-xs text-vault-text-muted mt-1">
                        {formatINR(data?.totalBalance ?? 0)} total
                        {(data?.unpaidCommitments ?? 0) > 0 && (
                          <> · −{formatINR(data?.unpaidCommitments ?? 0)} pending bills</>
                        )}
                      </p>
                      {/* Period spend breakdown */}
                      <p className="text-xs text-vault-text-muted mt-0.5">
                        {formatINR(displayWf.variableSpending)} spent · {formatINR(displayWf.totalCommitments)} committed
                      </p>
                    </div>
                    {/* Sparkline */}
                    {sparklineData && sparklineData.length > 0 && (
                      <div style={{ width: 100, height: 40 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sparklineData}>
                            <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Account breakdown (multi-account only) */}
                  {data?.accounts?.length > 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {data.accounts.map(acc => (
                        <div key={acc._id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 10px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                        }}>
                          <span style={{ fontFamily: 'Inter', fontSize: 12, color: '#9295A8', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: acc.color || '#F5A623', display: 'inline-block', flexShrink: 0 }} />
                            {acc.name}
                          </span>
                          <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 13, color: '#EAEDF5' }}>
                            {formatINR(acc.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link to="/my-money" style={{ fontFamily: 'Inter', fontSize: 11, color: '#4A4E65', textDecoration: 'none', display: 'block' }}>
                    Manage accounts →
                  </Link>
                </div>
              )}
            </Card>

            {/* Feature 2: Cash Envelope Mini-Widget */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Banknote size={18} className="text-vault-teal" />
                  <h2 className="font-display font-semibold text-vault-text-primary">Cash Envelope</h2>
                </div>
                <Link to="/cash-tracker" className="text-xs text-vault-amber flex items-center gap-1 hover:underline">
                  Log cash spend <ChevronRight size={12} />
                </Link>
              </div>
              {envData?.envelope ? (
                <div>
                  <p className="text-2xl font-display font-bold text-vault-text-primary mb-2">
                    {formatINR(envData.envelope.currentBalance)} <span className="text-sm font-normal text-vault-text-secondary">expected in wallet</span>
                  </p>
                  <div className="h-2 bg-white/08 rounded-full overflow-hidden mb-1.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${envData.progressPct}%` }}
                      className="h-full rounded-full"
                      style={{ background: envData.progressPct < 50 ? '#00C896' : envData.progressPct < 80 ? '#F5A623' : '#FF5A5A' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-vault-text-muted">
                    <span>{formatINR(envData.envelope.totalLogged)} used</span>
                    <span>{formatINR(envData.totalIn)} total</span>
                  </div>
                  {envData.envelope.untrackedAmount > 500 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-vault-amber bg-[rgba(245,166,35,0.06)] p-2 rounded border border-[rgba(245,166,35,0.15)]">
                      <AlertTriangle size={14} />
                      {formatINR(envData.envelope.untrackedAmount)} untracked this month — do a wallet count?
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-vault-text-muted text-sm">No cash envelope set</p>
                  <Link to="/cash-tracker" className="text-xs text-vault-amber underline mt-1 block">Set it up →</Link>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Forecast + Ghost alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Forecast banner — day-aware (Only show for This Month) */}
          {tfmTab === 'this_month' ? (
            <Card className="flex items-center gap-3">
              {/* Day 1: too early for forecast */}
              {dayOfMonth === 1 ? (
                <>
                  <Cloud size={20} className="text-vault-text-muted" />
                  <div>
                    <p className="text-sm font-medium text-vault-text-primary">New month started 🎉</p>
                    <p className="text-xs text-vault-text-muted mt-0.5">Forecast will appear once you have a few days of data</p>
                  </div>
                </>
              ) : forecastConf === 'low' ? (
                /* Days 2-4: early estimate */
                <>
                  <Cloud size={20} className="text-vault-amber" />
                  <div>
                    <p className="text-sm font-medium text-vault-text-primary">Early estimate — based on last month</p>
                    <p className="text-xs text-vault-text-muted mt-0.5">
                      Projected {formatINR(forecast?.forecastTotal)} by month end · More accurate after day 5
                    </p>
                  </div>
                </>
              ) : (
                /* Day 5+: normal forecast */
                <>
                  {weatherIcon}
                  <div>
                    <p className="text-sm font-medium text-vault-text-primary">{weatherMsg}</p>
                    <p className="text-xs text-vault-text-muted mt-0.5">
                      Forecast: {formatINR(forecast?.forecastTotal)} by month end · {forecast?.budgetLabel || budgetLabel}
                    </p>
                  </div>
                </>
              )}
            </Card>
          ) : (
            <div className="hidden md:block"></div>
          )}

          {/* Regret alert */}
          {(data?.pendingRegret?.length || 0) > 0 && (
            <Card className="border-l-2 border-vault-amber">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-vault-amber flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-vault-text-primary">
                    {data.pendingRegret.length} unrated spend{data.pendingRegret.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-vault-text-muted">How do you feel about them now?</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.pendingRegret.slice(0, 2).map(t => (
                      <span key={t.id} className="text-xs text-vault-text-secondary bg-white/05 px-2 py-1 rounded-md">
                        {t.title} ({formatINR(t.amount)})
                      </span>
                    ))}
                  </div>
                  <Link to="/regret-tracker" className="text-xs text-vault-amber underline mt-2 block">Rate now →</Link>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Charts row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 360px',
          gap: '16px',
          marginBottom: '16px',
        }}>
          {/* Daily Spend Chart */}
          <Card className="lg:col-span-2" padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Daily Spending</h2>
              <p className="text-xs text-vault-text-muted">
                {tfmTab === 'this_month' ? 'This month — cumulative' : 
                 tfmTab === 'last_month' ? 'Last month — cumulative' : 
                 tfmTab === '3_months' ? 'Last 3 months — daily spend' : 
                 'All time — monthly totals'}
              </p>
            </div>
            {isLoading || isChartLoading ? <ChartSkeleton height={220} /> : (() => {
              // For this_month: use the backend-computed dailySpend (pre-filtered, reliable).
              // For other tabs: use processedCharts (frontend-computed from raw txns).
              let chartData = tfmTab === 'this_month'
                ? (data?.dailySpend || [])
                : processedCharts.dailySpend;

              if (forecast?.forecastTotal && chartData.length > 0 && tfmTab === 'this_month') {
                const todayIdx = Math.min(dayOfMonth - 1, chartData.length - 1);
                const currentTotal = chartData[todayIdx]?.cumulative || 0;
                const endTotal = forecast.forecastTotal;
                chartData = chartData.map((d, i) => {
                  if (i <= todayIdx) return { ...d, projected: d.cumulative };
                  const remainingDays = chartData.length - 1 - todayIdx;
                  const progress = (i - todayIdx) / remainingDays;
                  return { ...d, projected: currentTotal + (endTotal - currentTotal) * progress };
                });
              }
              return (
              <div className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={180}>
                  {tfmTab === 'all_time' ? (
                    <BarChart data={chartData}>
                      <CartesianGrid {...chartDefaults.grid} />
                      <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide={true} domain={[0, 'auto']} />
                      <Tooltip 
                        formatter={(value) => [`₹${Math.round(value)}`, 'Spent']}
                        contentStyle={{
                          background: '#1a1a24',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          color: '#f5f0eb',
                          fontSize: '13px'
                        }}
                        labelFormatter={(month) => `${month}`}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      />
                      <Bar dataKey="amount" fill="#f59e0b" radius={[4,4,0,0]} isAnimationActive={!isMobile} />
                    </BarChart>
                  ) : (
                    <ComposedChart data={chartData}>
                      <defs>
                        <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartDefaults.grid} />
                      <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
                      <YAxis hide={true} domain={[0, 'auto']} />
                      <Tooltip 
                        formatter={(value, name) => [
                          value !== null ? `₹${Math.round(value)}` : 'No data',
                          name === 'cumulative' ? 'Spent' : 'Projected'
                        ]}
                        contentStyle={{
                          background: '#1a1a24',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          color: '#f5f0eb',
                          fontSize: '13px'
                        }}
                        labelFormatter={(day) => `Day ${day}`}
                      />
                      <Area type="monotone" dataKey="cumulative" connectNulls={false} name="Spent" stroke="#f59e0b" fill="url(#spendGradient)" strokeWidth={2} dot={false} isAnimationActive={!isMobile} />
                      <Line type="monotone" dataKey="projected" name="Projected" stroke="#f59e0b" strokeDasharray="4 4" fill="none" strokeWidth={1.5} dot={false} isAnimationActive={!isMobile} connectNulls={false} />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
              );
            })()}
          </Card>

          {/* Donut Chart */}
          <Card padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Categories</h2>
              <p className="text-xs text-vault-text-muted">
                {tfmTab === 'this_month' ? 'This month' : 
                 tfmTab === 'last_month' ? 'Last month' : 
                 tfmTab === '3_months' ? 'Last 3 months' : 
                 'All time'}
              </p>
            </div>
            {isLoading || isChartLoading ? <ChartSkeleton height={220} /> : (
              <div className="pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={processedCharts.categoryBreakdown}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {(data?.categoryBreakdown || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...chartDefaults.tooltip} formatter={(v) => formatINR(v)} />
                    <Legend
                      formatter={(v) => <span className="text-xs text-vault-text-secondary">{v}</span>}
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-vault-text-primary">Recent Transactions</h2>
            <Link to="/transactions" className="text-xs text-vault-amber flex items-center gap-1 hover:underline">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-vault-md" />)}</div>
          ) : !data?.recentTransactions?.length ? (
            <Card className="text-center py-8">
              <p className="text-vault-text-muted text-sm">No transactions yet.</p>
              <button onClick={() => setAddTransactionOpen(true)} className="text-vault-amber text-sm mt-2 hover:underline">Add your first spend →</button>
            </Card>
          ) : (
            <motion.div variants={listContainer} initial="initial" animate="animate" className="space-y-2">
              {data.recentTransactions.map(t => (
                <motion.div key={t._id} variants={listItem}>
                  <TransactionRow transaction={t} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </PageWrapper>
    </MobilePage>

      {/* Log Income Modal */}
      <AnimatePresence>
        {incomeModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setIncomeModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="glass-card w-full max-w-sm p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-semibold text-vault-text-primary">Log Income Received</h3>
                <button onClick={() => setIncomeModalOpen(false)} className="text-vault-text-muted hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontFamily: 'Inter', fontSize: '12px', fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-vault-text3 font-medium text-sm">₹</span>
                    <input
                      type="number"
                      placeholder="e.g. 12000"
                      className="gi !pl-8"
                      value={incomeForm.amount}
                      onChange={e => setIncomeForm(f => ({ ...f, amount: e.target.value }))}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label style={{ fontFamily: 'Inter', fontSize: '12px', fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date Received</label>
                  <input
                    type="date"
                    className="gi"
                    value={incomeForm.date}
                    onChange={e => setIncomeForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label style={{ fontFamily: 'Inter', fontSize: '12px', fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Note <span className="normal-case" style={{ color: '#4A4E65' }}>(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. May salary, pocket money…"
                    className="gi"
                    value={incomeForm.note}
                    onChange={e => setIncomeForm(f => ({ ...f, note: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIncomeModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-white/10 text-sm text-vault-text-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogIncome}
                  disabled={logIncomeMutation.isPending}
                  className="flex-1 py-2.5 rounded-full btn-amber text-sm font-semibold disabled:opacity-50"
                >
                  {logIncomeMutation.isPending ? 'Saving…' : 'Add Income'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
