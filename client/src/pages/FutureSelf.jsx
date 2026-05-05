import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { ChartSkeleton } from '../components/ui/Skeleton';
import { formatINR, formatCompact } from '../utils/formatCurrency';
import { calcFV, calcSIPFV } from '../utils/calcFutureValue';
import { CATEGORIES, CHART_COLORS } from '../constants/categories';
import { TrendingUp } from 'lucide-react';

const YEAR_TABS = [1, 3, 5, 10, 20];

export default function FutureSelf() {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState(5000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(5);

  const fv = calcFV(amount, rate, years);
  const sipFV = calcSIPFV(amount, rate, years);

  const { data: monthlyData, isLoading } = useQuery({
    queryKey: ['analytics-monthly', 6],
    queryFn: () => analyticsAPI.getMonthly(6).then(r => r.data),
  });

  const { data: catData } = useQuery({
    queryKey: ['analytics-categories', 6],
    queryFn: () => analyticsAPI.getCategoryTrends(6).then(r => r.data),
  });

  const avgMonthly = monthlyData?.data?.length
    ? Math.round(monthlyData.data.reduce((s, m) => s + m.total, 0) / monthlyData.data.length)
    : 0;

  const monthlySIPFV = calcSIPFV(avgMonthly, rate, years);

  // Build growth curve
  const growthData = YEAR_TABS.map(yr => ({
    year: `${yr}yr`,
    lumpSum: calcFV(amount, rate, yr),
    sip: calcSIPFV(amount, rate, yr),
  }));

  // Category level future values (last month avg)
  const categoryFVs = catData?.data?.[catData.data.length - 1]
    ? Object.entries(catData.data[catData.data.length - 1])
        .filter(([k]) => k !== 'month' && k !== 'year')
        .map(([cat, monthly]) => ({
          cat,
          monthly,
          fv5yr: calcSIPFV(monthly, rate, 5),
        }))
        .sort((a, b) => b.fv5yr - a.fv5yr)
        .slice(0, 6)
    : [];

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
            <TrendingUp size={24} className="text-vault-teal" /> Future Self
          </h1>
          <p className="text-vault-text-secondary text-sm mt-1">What does your money become if invested instead of spent?</p>
        </div>

        {/* Calculator hero */}
        <Card glow="teal">
          <h2 className="font-display font-semibold text-vault-text-primary mb-4">Future Value Calculator</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Input label="Amount" type="number" prefix="₹" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
            <Input label="Annual return (%)" type="number" suffix="%" value={rate} onChange={e => setRate(parseFloat(e.target.value) || 12)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-vault-text-secondary uppercase tracking-wide">Time horizon</label>
              <div className="flex gap-2">
                {YEAR_TABS.map(yr => (
                  <button
                    key={yr}
                    onClick={() => setYears(yr)}
                    className={`flex-1 py-2 rounded-vault-sm text-xs font-medium transition-all border ${years === yr ? 'border-vault-teal bg-[rgba(0,200,150,0.12)] text-vault-teal' : 'border-white/08 text-vault-text-muted hover:border-white/15'}`}
                  >{yr}Y</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center py-6 bg-[rgba(0,200,150,0.06)] rounded-vault-lg">
              <p className="text-xs text-vault-text-muted uppercase tracking-wide mb-2">Lump Sum in {years} years</p>
              <motion.p
                key={fv}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-display font-bold text-vault-teal"
              >
                {formatCompact(fv)}
              </motion.p>
              <p className="text-xs text-vault-text-muted mt-1">if invested today</p>
            </div>
            <div className="text-center py-6 bg-[rgba(78,159,255,0.06)] rounded-vault-lg">
              <p className="text-xs text-vault-text-muted uppercase tracking-wide mb-2">SIP in {years} years</p>
              <motion.p
                key={sipFV}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-display font-bold text-vault-blue"
              >
                {formatCompact(sipFV)}
              </motion.p>
              <p className="text-xs text-vault-text-muted mt-1">if invested monthly</p>
            </div>
          </div>
        </Card>

        {/* Growth curve */}
        <Card padding={false}>
          <div className="p-5 pb-2">
            <h2 className="font-display font-semibold text-vault-text-primary">Growth Curve</h2>
            <p className="text-xs text-vault-text-muted">{formatINR(amount)} at {rate}% annual return</p>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C896" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00C896" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4E9FFF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4E9FFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#4A4F63' }} />
                <YAxis tickFormatter={v => formatCompact(v)} tick={{ fontSize: 11, fill: '#4A4F63' }} />
                <Tooltip formatter={v => formatINR(v)} contentStyle={{ background: '#13151C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="sip" name="SIP" stroke="#4E9FFF" fill="url(#blueGrad)" strokeWidth={2} dot={{ r: 4, fill: '#4E9FFF' }} />
                <Area type="monotone" dataKey="lumpSum" name="Lump Sum" stroke="#00C896" fill="url(#tealGrad)" strokeWidth={2} dot={{ r: 4, fill: '#00C896' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly spending insight */}
        {avgMonthly > 0 && (
          <Card className="border-l-2 border-vault-amber">
            <p className="text-sm font-medium text-vault-text-primary">💡 What if you invested your monthly spending?</p>
            <p className="text-xs text-vault-text-secondary mt-1 leading-relaxed">
              You spend an average of <span className="text-vault-amber font-medium">{formatINR(avgMonthly)}/month</span>.
              If you invested this as a SIP for {years} years at {rate}%, you'd have{' '}
              <span className="text-vault-teal font-bold">{formatCompact(monthlySIPFV)}</span>.
            </p>
          </Card>
        )}

        {/* Category future values */}
        {categoryFVs.length > 0 && (
          <Card>
            <h2 className="font-display font-semibold text-vault-text-primary mb-4">Category-Level Opportunity Cost</h2>
            <p className="text-xs text-vault-text-muted mb-4">If you redirected each category to SIP for 5 years</p>
            <div className="space-y-3">
              {categoryFVs.map(({ cat, monthly, fv5yr }, i) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xs text-vault-text-muted w-24 truncate">{cat}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-vault-text-secondary">{formatINR(monthly)}/mo</span>
                      <span className="text-vault-teal font-medium">{formatCompact(fv5yr)} in 5yr</span>
                    </div>
                    <div className="h-1.5 bg-white/08 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (fv5yr / (categoryFVs[0]?.fv5yr || 1)) * 100)}%` }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                        className="h-full rounded-full"
                        style={{ background: CHART_COLORS[i] }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
