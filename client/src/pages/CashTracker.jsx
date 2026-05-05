import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cashAPI, transactionsAPI } from '../api';
import PageWrapper from '../components/layout/PageWrapper';
import MobilePage from '../components/layout/MobilePage';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { CardSkeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/formatCurrency';
import { getCategoryMeta, CATEGORIES } from '../constants/categories';
import { Banknote, Plus, Calculator, CheckCircle, AlertTriangle, Wallet, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const QUICK_TAGS = [
  { label: '🍜 Street food', category: 'Food & Dining' },
  { label: '🛺 Auto/Cab', category: 'Transport' },
  { label: '🛒 Grocery', category: 'Food & Dining' },
  { label: '💊 Medicine', category: 'Health & Fitness' },
  { label: '🍵 Tea/Chai', category: 'Food & Dining' },
  { label: '🍎 Fruits', category: 'Food & Dining' },
  { label: '📦 Misc', category: 'Others' },
];

export default function CashTracker() {
  const qc = useQueryClient();
  const now = new Date();
  const [openEnv, setOpenEnv] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState('Food & Dining');
  const [quickTag, setQuickTag] = useState('');
  const [lastLogged, setLastLogged] = useState(null);

  const { data: envData, isLoading: envLoading } = useQuery({
    queryKey: ['cash-envelope', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => cashAPI.getEnvelope({ month: now.getMonth() + 1, year: now.getFullYear() }).then(r => r.data),
  });

  const { data: cashTxns, isLoading: txLoading } = useQuery({
    queryKey: ['cash-transactions', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => transactionsAPI.getAll({ isCashSpend: true, month: now.getMonth() + 1, year: now.getFullYear(), limit: 50 }).then(r => r.data),
  });

  const { data: ratioData } = useQuery({
    queryKey: ['cash-ratio', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => cashAPI.getRatio({ month: now.getMonth() + 1, year: now.getFullYear() }).then(r => r.data),
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['cash-analytics'],
    queryFn: () => cashAPI.getAnalytics(6).then(r => r.data),
  });

  const envMut = useMutation({
    mutationFn: (d) => cashAPI.createEnvelope(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-envelope'] }); setOpenEnv(false); envReset(); toast.success('Cash envelope set!'); },
  });

  const countMut = useMutation({
    mutationFn: (count) => cashAPI.countWallet(count),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ['cash-envelope'] }); qc.invalidateQueries({ queryKey: ['cash-transactions'] }); setCountOpen(false); countReset(); toast.success(data.message); },
  });

  const logCashMut = useMutation({
    mutationFn: (d) => transactionsAPI.create(d),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['cash-transactions'] });
      qc.invalidateQueries({ queryKey: ['cash-envelope'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setLastLogged({ amount: data.transaction.amount, remaining: envData?.envelope?.currentBalance - data.transaction.amount });
      setQuickAmount(''); setQuickTitle(''); setQuickTag('');
      setTimeout(() => setLastLogged(null), 4000);
    },
    onError: () => toast.error('Failed to log'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => transactionsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-transactions'] });
      qc.invalidateQueries({ queryKey: ['cash-envelope'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Deleted cash spend');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const { register: envReg, handleSubmit: envSubmit, reset: envReset } = useForm();
  const { register: countReg, handleSubmit: countSubmit, reset: countReset } = useForm();

  const env = envData?.envelope;
  const totalIn = envData?.totalIn || 0;
  const progressPct = envData?.progressPct || 0;
  const barColor = progressPct < 50 ? '#00C896' : progressPct < 80 ? '#F5A623' : '#FF5A5A';

  const handleQuickLog = () => {
    if (!quickAmount || isNaN(parseFloat(quickAmount))) return toast.error('Enter an amount');
    logCashMut.mutate({
      title: quickTitle || quickTag || quickCategory,
      amount: parseFloat(quickAmount),
      category: quickCategory,
      paymentMode: 'Cash',
      isCashSpend: true,
      date: new Date().toISOString(),
    });
  };

  const handleTagPick = (tag) => {
    setQuickTag(tag.label);
    setQuickTitle(tag.label.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF] /g, '')); // Strip emoji
    setQuickCategory(tag.category);
  };

  const txns = cashTxns?.transactions || [];
  const donutData = ratioData ? [
    { name: 'Cash', value: ratioData.cashPct, color: '#F5A623' },
    { name: 'Digital', value: ratioData.digitalPct, color: '#4E9FFF' },
  ] : [];
  const analyticsChart = analyticsData?.data || [];
  const untracked = env?.untrackedAmount || 0;

  return (
    <MobilePage title="Cash Tracker" headerRight={<Button size="sm" onClick={() => setAddTxOpen(true)}>+ Add</Button>}>
    <PageWrapper>
      <div className="space-y-6">
        <div className="hidden md:block">
          <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
            <Banknote size={24} className="text-vault-amber" /> Cash Tracker
          </h1>
          <p className="text-vault-text-secondary text-sm mt-1">Track your invisible cash spending. No more mystery ₹5,000 disappearances.</p>
        </div>

        {/* Envelope Hero */}
        {envLoading ? <CardSkeleton /> : !env || env.openingBalance === 0 ? (
          <Card className="text-center py-8 border-dashed border-vault-amber/30">
            <Wallet size={36} className="text-vault-amber mx-auto mb-3 opacity-60" />
            <p className="text-vault-text-secondary font-medium">No cash envelope set for {format(now, 'MMMM')}</p>
            <p className="text-xs text-vault-text-muted mt-1 mb-4">Tell VAULT how much cash you have right now</p>
            <Button onClick={() => setOpenEnv(true)}>Set My Cash Amount</Button>
          </Card>
        ) : (
          <Card className="skeuo-envelope">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-vault-text-primary">Cash Envelope — {format(now, 'MMMM yyyy')}</h2>
              <Button variant="ghost" size="sm" onClick={() => setOpenEnv(true)}>Reset</Button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5 text-center">
              <div>
                <p className="text-xs text-vault-text-muted mb-1">Started with</p>
                <p className="font-display font-bold text-vault-text-primary">{formatINR(env.openingBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-vault-text-muted mb-1">+ ATM withdrawn</p>
                <p className="font-display font-bold text-vault-teal">+{formatINR(env.totalWithdrawn)}</p>
              </div>
              <div>
                <p className="text-xs text-vault-text-muted mb-1">− Cash logged</p>
                <p className="font-display font-bold text-vault-red">−{formatINR(env.totalLogged)}</p>
              </div>
            </div>
            <div className="p-4 bg-white/03 rounded-vault-md mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-vault-text-secondary">Expected in wallet</span>
                <span className="text-lg font-display font-bold text-vault-text-primary">{formatINR(env.currentBalance)}</span>
              </div>
              <div className="h-3 bg-white/08 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full"
                  style={{ background: barColor }}
                />
              </div>
              <div className="flex justify-between text-xs text-vault-text-muted mt-1.5">
                <span>{formatINR(env.totalLogged)} used</span>
                <span>{formatINR(totalIn)} total</span>
              </div>
            </div>
            {env.lastCountedAt && (
              <p className="text-xs text-vault-text-muted mb-3">
                Last count: <span className="text-vault-text-secondary">{formatINR(env.lastPhysicalCount)}</span> on {format(new Date(env.lastCountedAt), 'MMM d')}
                {untracked > 0 && <span className="text-vault-amber ml-1">· ₹{untracked} gap</span>}
              </p>
            )}
            <Button variant="secondary" size="sm" onClick={() => setCountOpen(true)}>
              <Calculator size={14} /> Count my cash now
            </Button>
          </Card>
        )}

        {/* Success flash */}
        <AnimatePresence>
          {lastLogged && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="glass-card p-4 border-vault-teal/30 flex items-center gap-3">
              <CheckCircle size={18} className="text-vault-teal" />
              <p className="text-sm text-vault-text-primary">
                <span className="text-vault-teal font-bold">{formatINR(lastLogged.amount)}</span> logged!
                {lastLogged.remaining > 0 && <span className="text-vault-text-muted"> Envelope: {formatINR(lastLogged.remaining)} remaining</span>}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Log */}
        <Card className="glow-amber">
          <h2 className="font-display font-semibold text-vault-text-primary mb-4">Quick Cash Log</h2>
          
          <div className="relative mb-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-vault-text-muted text-xl font-bold">₹</span>
            <input
              type="number"
              placeholder="0"
              value={quickAmount}
              onChange={e => setQuickAmount(e.target.value)}
              className="glass-input w-full pl-10 text-2xl font-display py-3"
              style={{ paddingLeft: '40px' }}
              autoFocus
            />
          </div>

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="What was it for?"
              value={quickTitle}
              onChange={e => { setQuickTitle(e.target.value); setQuickTag(''); }}
              onKeyDown={e => e.key === 'Enter' && handleQuickLog()}
              className="glass-input flex-1"
            />
            <select className="glass-input w-[130px] md:w-40 text-sm" value={quickCategory} onChange={e => setQuickCategory(e.target.value)}>
              {CATEGORIES.filter(c => c.name !== 'Guilt-Free').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {QUICK_TAGS.map(tag => (
              <button
                key={tag.label}
                onClick={() => handleTagPick(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${quickTag === tag.label ? 'bg-[rgba(245,166,35,0.15)] border-vault-amber text-vault-amber' : 'border-white/10 text-vault-text-muted hover:border-white/20 hover:text-vault-text-secondary'}`}
              >
                {tag.label}
              </button>
            ))}
          </div>
          <Button fullWidth loading={logCashMut.isPending} onClick={handleQuickLog}>
            <Banknote size={16} /> Log Cash Spend →
          </Button>
        </Card>

        {/* Untracked nudge */}
        {untracked > 500 && (
          <Card className="border-vault-amber/30">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-vault-amber" />
              <p className="text-sm text-vault-text-secondary">
                <span className="text-vault-amber font-medium">{formatINR(untracked)}</span> untracked this month — do a wallet count?
              </p>
              <Button variant="secondary" size="sm" onClick={() => setCountOpen(true)} className="ml-auto flex-shrink-0">Count</Button>
            </div>
          </Card>
        )}

        {/* Cash vs Digital ratio */}
        {ratioData && ratioData.allTotal > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="flex items-center gap-4">
              <div className="w-24 h-24 flex-shrink-0">
                <PieChart width={96} height={96}>
                  <Pie data={donutData} cx={44} cy={44} innerRadius={28} outerRadius={42} paddingAngle={3} dataKey="value">
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </div>
              <div>
                <p className="text-sm font-medium text-vault-text-primary mb-2">Cash vs Digital</p>
                <div className="flex items-center gap-2 text-xs mb-1">
                  <div className="w-2 h-2 rounded-full bg-vault-amber" />
                  <span className="text-vault-text-secondary">Cash {ratioData.cashPct}%</span>
                  <span className="text-vault-text-muted">({formatINR(ratioData.cashTotal)})</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-vault-blue" />
                  <span className="text-vault-text-secondary">Digital {ratioData.digitalPct}%</span>
                  <span className="text-vault-text-muted">({formatINR(ratioData.digitalTotal)})</span>
                </div>
              </div>
            </Card>
            <Card>
              <p className="text-xs text-vault-text-muted mb-2">Biggest cash category</p>
              {ratioData.categoryBreakdown.slice(0, 3).map((c, i) => (
                <div key={c.cat} className="flex justify-between text-sm py-1">
                  <span className="text-vault-text-secondary">{c.cat}</span>
                  <span className="font-medium text-vault-text-primary">{formatINR(c.total)}</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Monthly cash history chart */}
        {analyticsChart.length > 0 && (
          <Card padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Monthly Cash Spend</h2>
              <p className="text-xs text-vault-text-muted">Last 6 months</p>
            </div>
            <div className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analyticsChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A4F63' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#4A4F63' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => formatINR(v)} contentStyle={{ background: '#13151C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Bar dataKey="cashTotal" name="Cash" fill="#F5A623" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Cash Transaction history */}
        <div>
          <h2 className="font-display font-semibold text-vault-text-primary mb-3">This Month's Cash Spends</h2>
          {txLoading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-vault-md" />)}</div>
            : txns.length === 0 ? (
              <Card className="text-center py-8">
                <Banknote size={32} className="text-vault-amber mx-auto mb-3 opacity-40" />
                <p className="text-vault-text-secondary text-sm">No cash spends logged this month</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {txns.map(t => {
                  const meta = getCategoryMeta(t.category);
                  const Icon = meta.icon;
                  return (
                    <motion.div key={t._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                        <Icon size={16} style={{ color: meta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-vault-text-primary truncate">{t.title}</p>
                        <p className="text-xs text-vault-text-muted">{format(new Date(t.date), 'MMM d, h:mm a')} · {t.category}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-vault-amber">{formatINR(t.amount)}</span>
                        <button 
                          onClick={() => deleteMut.mutate(t._id)} 
                          className="p-1.5 hover:text-vault-red text-vault-text-muted transition-all bg-white/05 rounded-md hover:bg-vault-red/10"
                          title="Delete cash spend"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Set Envelope Modal */}
        <Modal isOpen={openEnv} onClose={() => { setOpenEnv(false); envReset(); }} title="Set Cash Envelope">
          <form onSubmit={envSubmit(d => envMut.mutate({ openingBalance: parseFloat(d.openingBalance), month: now.getMonth() + 1, year: now.getFullYear() }))} className="space-y-4">
            <p className="text-sm text-vault-text-secondary">How much cash do you have right now (or start of month)?</p>
            <Input label="Cash amount" type="number" prefix="₹" placeholder="5000" {...envReg('openingBalance', { required: true })} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setOpenEnv(false)} fullWidth>Cancel</Button>
              <Button type="submit" loading={envMut.isPending} fullWidth>Set Envelope</Button>
            </div>
          </form>
        </Modal>

        {/* Count Wallet Modal */}
        <Modal isOpen={countOpen} onClose={() => { setCountOpen(false); countReset(); }} title="Count Your Cash">
          <form onSubmit={countSubmit(d => countMut.mutate(parseFloat(d.physicalCount)))} className="space-y-4">
            <div className="p-4 bg-white/03 rounded-vault-md text-center">
              <p className="text-xs text-vault-text-muted mb-1">VAULT expects you to have</p>
              <p className="text-2xl font-display font-bold text-vault-text-primary">{formatINR(env?.currentBalance || 0)}</p>
            </div>
            <p className="text-sm text-vault-text-secondary">Count your actual cash and enter below. Any gap will be logged automatically.</p>
            <Input label="Physical cash count" type="number" prefix="₹" placeholder="1800" {...countReg('physicalCount', { required: true })} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setCountOpen(false)} fullWidth>Cancel</Button>
              <Button type="submit" loading={countMut.isPending} fullWidth>Submit Count</Button>
            </div>
          </form>
        </Modal>
      </div>
    </PageWrapper>
    </MobilePage>
  );
}
