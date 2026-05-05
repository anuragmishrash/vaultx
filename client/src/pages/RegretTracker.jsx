import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { transactionsAPI } from '../api';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { CardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/formatCurrency';
import { getCategoryMeta, CATEGORIES, CHART_COLORS } from '../constants/categories';
import { chartDefaults } from '../utils/chartTheme';
import { regretCardExit } from '../utils/animations';
import { format } from 'date-fns';
import { Heart, AlertCircle, CheckCircle, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
const REGRET_COLORS = { worth_it: '#00C896', okay: '#F5A623', regret: '#FF5A5A', pending: '#4A4F63' };

export default function RegretTracker() {
  const qc = useQueryClient();

  const { data: allData, isLoading } = useQuery({
    queryKey: ['transactions', '', {}, 'date', 1],
    queryFn: () => transactionsAPI.getAll({ limit: 200, sort: 'date', order: 'desc' }).then(r => r.data),
  });

  const rateMutation = useMutation({
    mutationFn: ({ id, rating }) => transactionsAPI.rateRegret(id, rating),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['transactions'] });
      const prev = qc.getQueryData(['transactions', '', {}, 'date', 1]);
      qc.setQueryData(['transactions', '', {}, 'date', 1], old => old ? {
        ...old,
        transactions: old.transactions.map(t => t._id === id ? { ...t, regretStatus: '__rating__' } : t)
      } : old);
      return { prev };
    },
    onError: (_, __, ctx) => { qc.setQueryData(['transactions', '', {}, 'date', 1], ctx.prev); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); toast.success('Rated!'); },
  });

  const txns = allData?.transactions || [];
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const pending = txns.filter(t => t.regretStatus === 'pending' && !t.isGuiltyFreeSpend && new Date(t.date) <= yesterday);
  const rated = txns.filter(t => t.regretStatus !== 'pending' && t.regretStatus !== '__rating__');

  // Donut data
  const worthItCount = rated.filter(t => t.regretStatus === 'worth_it').length;
  const okayCount = rated.filter(t => t.regretStatus === 'okay').length;
  const regretCount = rated.filter(t => t.regretStatus === 'regret').length;
  const donutData = [
    { name: 'Worth It', value: worthItCount, color: '#00C896' },
    { name: 'Okay', value: okayCount, color: '#F5A623' },
    { name: 'Regret', value: regretCount, color: '#FF5A5A' },
  ].filter(d => d.value > 0);

  const regretPct = rated.length > 0 ? Math.round((regretCount / rated.length) * 100) : 0;

  // Category heatmap data
  const categoryRegret = CATEGORIES.slice(0, 10).map(cat => {
    const catTxns = rated.filter(t => t.category === cat.name);
    const catRegret = catTxns.filter(t => t.regretStatus === 'regret').length;
    return {
      name: cat.name.split(' ')[0],
      rate: catTxns.length > 0 ? Math.round((catRegret / catTxns.length) * 100) : 0,
      count: catTxns.length,
    };
  }).filter(c => c.count > 0).sort((a, b) => b.rate - a.rate);

  const mostRegrettedCat = categoryRegret[0];
  const mostSatisfying = [...categoryRegret].sort((a, b) => a.rate - b.rate)[0];

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
            <Heart size={24} className="text-vault-red" /> Regret Tracker
          </h1>
          <p className="text-vault-text-secondary text-sm mt-1">How do you feel about your spending — 24 hours later?</p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Donut */}
          <Card padding={false} className="lg:col-span-1">
            <div className="p-5 pb-0">
              <h2 className="font-display font-semibold text-vault-text-primary">Regret Score</h2>
              <p className="text-xs text-vault-text-muted">{rated.length} rated spends</p>
            </div>
            {isLoading ? <ChartSkeleton height={200} /> : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" isAnimationActive={true}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip {...chartDefaults.tooltip} formatter={(v) => `${v} spends`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-display font-bold" style={{ color: regretPct > 40 ? '#FF5A5A' : regretPct > 20 ? '#F5A623' : '#00C896' }}>
                    {regretPct}%
                  </span>
                  <span className="text-xs text-vault-text-muted">regret rate</span>
                </div>
              </div>
            )}
          </Card>

          {/* Insights */}
          <div className="lg:col-span-2 space-y-3">
            {mostRegrettedCat && (
              <Card className="border-l-2 border-vault-red">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="text-vault-red flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-vault-text-primary">Most regretted category</p>
                    <p className="text-xs text-vault-text-muted mt-0.5">
                      <span className="text-vault-red font-medium">{mostRegrettedCat.name}</span> — {mostRegrettedCat.rate}% regret rate
                    </p>
                  </div>
                </div>
              </Card>
            )}
            {mostSatisfying && (
              <Card className="border-l-2 border-vault-teal">
                <div className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-vault-teal flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-vault-text-primary">Most satisfying category</p>
                    <p className="text-xs text-vault-text-muted mt-0.5">
                      <span className="text-vault-teal font-medium">{mostSatisfying.name}</span> — only {mostSatisfying.rate}% regret rate
                    </p>
                  </div>
                </div>
              </Card>
            )}
            <Card className="border-l-2 border-vault-purple">
              <p className="text-sm font-medium text-vault-text-primary mb-1">💡 Insight</p>
              <p className="text-xs text-vault-text-secondary leading-relaxed">
                {regretPct > 40
                  ? "High regret rate detected. Review your spending triggers — stress, boredom, or late-night purchases often drive regrettable spends."
                  : regretPct > 20
                  ? "Moderate regret. Most of your spends are intentional, but there's room to improve your spending decisions."
                  : "Excellent spending clarity! You're making very intentional purchases with low regret."}
              </p>
            </Card>
          </div>
        </div>

        {/* Pending ratings */}
        <div>
          <h2 className="font-display font-semibold text-vault-text-primary mb-3">
            Pending Ratings {pending.length > 0 && <span className="text-vault-amber text-sm font-normal ml-2">({pending.length} left)</span>}
          </h2>
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-vault-md" />)}</div>
          ) : pending.length === 0 ? (
            <Card className="text-center py-8">
              <CheckCircle size={32} className="text-vault-teal mx-auto mb-3" />
              <p className="text-vault-text-secondary">All caught up! No pending ratings.</p>
              <p className="text-xs text-vault-text-muted mt-1">Check back 24 hours after your next spend</p>
            </Card>
          ) : (
            <AnimatePresence>
              <div className="space-y-3">
                {pending.map(t => {
                  const meta = getCategoryMeta(t.category);
                  const Icon = meta.icon;
                  return (
                    <motion.div
                      key={t._id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={regretCardExit(1)}
                      className="glass-card p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                          <Icon size={18} style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-vault-text-primary">{t.title}</p>
                          <p className="text-xs text-vault-text-muted">{formatINR(t.amount)} · {format(new Date(t.date), 'MMM d')}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => rateMutation.mutate({ id: t._id, rating: 'worth_it' })}
                            className="regret-btn regret-worth"
                          >✓ Worth It</button>
                          <button
                            onClick={() => rateMutation.mutate({ id: t._id, rating: 'okay' })}
                            className="regret-btn regret-okay"
                          >~ Okay</button>
                          <button
                            onClick={() => rateMutation.mutate({ id: t._id, rating: 'regret' })}
                            className="regret-btn regret-regret"
                          >✗ Regret</button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* Category Regret Chart */}
        {categoryRegret.length > 0 && (
          <Card padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Regret by Category</h2>
              <p className="text-xs text-vault-text-muted">% of spends rated as regret</p>
            </div>
            <div className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryRegret}>
                  <CartesianGrid {...chartDefaults.grid} />
                  <XAxis dataKey="name" {...chartDefaults.axis} />
                  <YAxis {...chartDefaults.axis} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => `${v}%`} {...chartDefaults.tooltip} />
                  <Bar dataKey="rate" name="Regret Rate" radius={[4, 4, 0, 0]}>
                    {categoryRegret.map((entry, i) => (
                      <Cell key={i} fill={entry.rate > 50 ? '#FF5A5A' : entry.rate > 25 ? '#F5A623' : '#00C896'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
