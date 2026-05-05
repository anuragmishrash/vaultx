import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, LineChart, Line, Cell
} from 'recharts';
import { analyticsAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import { ChartSkeleton, CardSkeleton } from '../components/ui/Skeleton';
import { formatINR, formatCompact } from '../utils/formatCurrency';
import { CHART_COLORS } from '../constants/categories';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Clock } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="glass-card px-3 py-2 text-xs space-y-1">
        <p className="text-vault-text-muted">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {formatINR(p.value)}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const { user } = useAuthStore();

  const { data: monthlyData, isLoading: m1 } = useQuery({
    queryKey: ['analytics-monthly', 6],
    queryFn: () => analyticsAPI.getMonthly(6).then(r => r.data),
  });

  const { data: catData, isLoading: m2 } = useQuery({
    queryKey: ['analytics-categories', 6],
    queryFn: () => analyticsAPI.getCategoryTrends(6).then(r => r.data),
  });

  const { data: dowData, isLoading: m3 } = useQuery({
    queryKey: ['analytics-dow'],
    queryFn: () => analyticsAPI.getDayOfWeek().then(r => r.data),
  });

  const monthly = monthlyData?.data || [];
  const categories = catData?.data || [];
  const dow = dowData?.data || [];

  const maxDowDay = dow.reduce((max, d) => d.avg > max.avg ? d : max, { avg: 0 });
  const avgMonthly = monthly.length ? Math.round(monthly.reduce((s, m) => s + m.total, 0) / monthly.length) : 0;
  const monthlySalary = user?.monthlySalary || 0;
  const avgSavingRate = monthlySalary > 0 ? Math.round(((monthlySalary - avgMonthly) / monthlySalary) * 100) : null;

  // Get all unique categories from trend data
  const catKeys = categories.length > 0
    ? [...new Set(categories.flatMap(m => Object.keys(m).filter(k => k !== 'month' && k !== 'year')))]
    : [];

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
            <BarChart3 size={24} className="text-vault-blue" /> Analytics
          </h1>
          <p className="text-vault-text-secondary text-sm mt-1">Deep-dive into your spending patterns.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-vault-text-muted mb-1">6-Month Average</p>
            <p className="text-2xl font-display font-bold text-vault-text-primary">{formatCompact(avgMonthly)}</p>
            <p className="text-xs text-vault-text-muted mt-1">per month</p>
          </Card>
          {avgSavingRate !== null && (
            <Card>
              <p className="text-xs text-vault-text-muted mb-1">Saving Rate</p>
              <p className="text-2xl font-display font-bold" style={{ color: avgSavingRate >= 20 ? '#00C896' : avgSavingRate >= 10 ? '#F5A623' : '#FF5A5A' }}>
                {avgSavingRate}%
              </p>
              <p className="text-xs text-vault-text-muted mt-1">of income saved</p>
            </Card>
          )}
          {maxDowDay.day && (
            <Card>
              <p className="text-xs text-vault-text-muted mb-1">Peak Spend Day</p>
              <p className="text-2xl font-display font-bold text-vault-purple">{maxDowDay.day}</p>
              <p className="text-xs text-vault-text-muted mt-1">avg {formatINR(maxDowDay.avg)}</p>
            </Card>
          )}
          <Card>
            <p className="text-xs text-vault-text-muted mb-1">Monthly Budget</p>
            <p className="text-2xl font-display font-bold text-vault-amber">{formatCompact(user?.monthlyBudget || 0)}</p>
            <p className="text-xs text-vault-text-muted mt-1">target</p>
          </Card>
        </div>

        {/* Monthly comparison */}
        <Card padding={false}>
          <div className="p-5 pb-2">
            <h2 className="font-display font-semibold text-vault-text-primary">Monthly Spending Comparison</h2>
            <p className="text-xs text-vault-text-muted">Last 6 months</p>
          </div>
          {m1 ? <ChartSkeleton height={240} /> : (
            <div className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A4F63' }} />
                  <YAxis tickFormatter={v => formatCompact(v)} tick={{ fontSize: 11, fill: '#4A4F63' }} />
                  <Tooltip content={<CustomTooltip />} />
                  {user?.monthlyBudget && <Bar dataKey={() => user.monthlyBudget} name="Budget" fill="rgba(0,200,150,0.12)" stroke="#00C896" strokeWidth={1} strokeDasharray="4 4" radius={[4,4,0,0]} />}
                  <Bar dataKey="total" name="Spent" radius={[4, 4, 0, 0]}>
                    {monthly.map((entry, i) => (
                      <Cell key={i} fill={entry.total > (user?.monthlyBudget || Infinity) ? '#FF5A5A' : entry.total > (user?.monthlyBudget || Infinity) * 0.85 ? '#F5A623' : '#4E9FFF'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Category trends stacked area */}
        {catKeys.length > 0 && (
          <Card padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Category Trends</h2>
              <p className="text-xs text-vault-text-muted">How each category evolved over 6 months</p>
            </div>
            {m2 ? <ChartSkeleton height={260} /> : (
              <div className="px-2 pb-4 overflow-x-auto">
                <ResponsiveContainer width="100%" height={260} minWidth={320}>
                  <AreaChart data={categories}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A4F63' }} />
                    <YAxis tickFormatter={v => formatCompact(v)} tick={{ fontSize: 11, fill: '#4A4F63' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend formatter={v => <span className="text-xs text-vault-text-secondary">{v}</span>} />
                    {catKeys.slice(0, 6).map((cat, i) => (
                      <Area key={cat} type="monotone" dataKey={cat} stackId="1" stroke={CHART_COLORS[i]} fill={CHART_COLORS[i]} fillOpacity={0.3} strokeWidth={1.5} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )}

        {/* Day of week */}
        <Card padding={false}>
          <div className="p-5 pb-2">
            <h2 className="font-display font-semibold text-vault-text-primary">Day-of-Week Analysis</h2>
            <p className="text-xs text-vault-text-muted">Average spend per day — last 3 months</p>
          </div>
          {m3 ? <ChartSkeleton height={200} /> : (
            <div className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#4A4F63' }} />
                  <YAxis tickFormatter={v => formatCompact(v)} tick={{ fontSize: 11, fill: '#4A4F63' }} />
                  <Tooltip formatter={v => formatINR(v)} contentStyle={{ background: '#13151C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Bar dataKey="avg" name="Avg Spend" radius={[4, 4, 0, 0]}>
                    {dow.map((d, i) => (
                      <Cell key={i} fill={d.day === maxDowDay.day ? '#F5A623' : '#4E9FFF'} opacity={d.day === maxDowDay.day ? 1 : 0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {maxDowDay.day && (
            <div className="px-5 pb-4">
              <p className="text-xs text-vault-text-secondary">
                📊 You spend most on <span className="text-vault-amber font-medium">{maxDowDay.day}s</span> — avg {formatINR(maxDowDay.avg)} per {maxDowDay.day}.
              </p>
            </div>
          )}
        </Card>

        {/* Saving rate trend */}
        {monthly.length > 0 && monthlySalary > 0 && (
          <Card padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Estimated Savings Trend</h2>
              <p className="text-xs text-vault-text-muted">Monthly income minus spending</p>
            </div>
            <div className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthly.map(m => ({ ...m, savings: monthlySalary - m.total }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A4F63' }} />
                  <YAxis tickFormatter={v => formatCompact(v)} tick={{ fontSize: 11, fill: '#4A4F63' }} />
                  <Tooltip formatter={v => formatINR(v)} contentStyle={{ background: '#13151C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="savings" name="Savings" stroke="#00C896" strokeWidth={2} dot={{ r: 4, fill: '#00C896' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
