import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { commitmentsAPI, patternsAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import PageWrapper from '../components/layout/PageWrapper';
import MobilePage from '../components/layout/MobilePage';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { CardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { formatINR, formatCompact } from '../utils/formatCurrency';
import { COMMITMENT_CATEGORIES } from '../constants/categories';
import {
  Landmark, Plus, CheckSquare, Square, AlertTriangle, Pause,
  Trash2, Edit, ChevronRight, TrendingDown, Shield, Brain, Zap
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const PRIORITY_COLORS = { critical: '#FF5A5A', important: '#F5A623', optional: '#8A8FA8' };

const STATUS_CONFIG = {
  paid:      { border: 'rgba(0,201,167,0.35)', bg: 'rgba(0,201,167,0.06)', color: '#00C9A7', icon: '✓' },
  due_today: { border: 'rgba(245,166,35,0.5)', bg: 'rgba(245,166,35,0.1)', color: '#F5A623', icon: '!' },
  upcoming:  { border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.02)', color: '#9295A8', icon: '○' },
  overdue:   { border: 'rgba(255,92,92,0.4)', bg: 'rgba(255,92,92,0.07)', color: '#FF5C5C', icon: '⚠' },
  missed:    { border: 'rgba(255,92,92,0.25)', bg: 'rgba(255,92,92,0.04)', color: '#FF5C5C', icon: '✗' },
};

function WaterfallRow({ label, value, type = 'neutral', isHero = false, isSubtraction = false }) {
  const colors = {
    income: '#F0F0F5',
    commitment: '#FF5A5A',
    variable: '#F5A623',
    guiltyFree: '#8B7CF6',
    freeMonney: '#F5A623',
    surplus: '#00C896',
    neutral: '#8A8FA8',
  };
  return (
    <div className={`relative flex items-center justify-between py-3 ${isHero ? 'py-5 my-2 rounded-vault-md px-3 bg-white/03 border border-white/06 shadow-lg' : 'px-2 border-b border-white/04 last:border-0'}`}>
      <span className={`text-sm z-10 ${isHero ? 'text-lg font-bold text-vault-text-primary' : 'text-vault-text-secondary'}`}>
        {isSubtraction && <span className="text-vault-text-muted mr-1 opacity-60">−</span>}
        {label}
      </span>
      <span
        className={`font-display font-bold tabular-nums z-10 ${isHero ? 'text-3xl' : 'text-base'}`}
        style={{ color: colors[type] || colors.neutral, textShadow: isHero ? `0 0 12px ${colors[type]}40` : 'none' }}
      >
        {value < 0 ? `−${formatINR(Math.abs(value))}` : formatINR(Math.abs(value))}
      </span>
    </div>
  );
}

function daySuffix(d) {
  if (d >= 11 && d <= 13) return 'th';
  switch (d % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function getDueDateLabel(s) {
  if (!s) return '';
  const d = s.dueDate ? new Date(s.dueDate) : null;
  const day = d ? d.getDate() : 0;
  const sfx = daySuffix(day);
  switch (s.status) {
    case 'paid': {
      if (s.paidOn) {
        const pd = new Date(s.paidOn);
        const pDay = pd.getDate();
        return `Paid on ${pDay}${daySuffix(pDay)} ${pd.toLocaleString('en-IN', { month: 'short' })}`;
      }
      return 'Paid this month';
    }
    case 'due_today': return `Due TODAY (${day}${sfx})`;
    case 'upcoming': return s.daysUntilDue === 1 ? `Due tomorrow` : s.daysUntilDue <= 3 ? `Due in ${s.daysUntilDue} days` : `Due ${day}${sfx}`;
    case 'overdue': return s.daysOverdue === 1 ? 'Was due yesterday' : `Overdue by ${s.daysOverdue} days`;
    case 'missed': return `Not paid (was due ${day}${sfx})`;
    default: return `Due ${day}${sfx}`;
  }
}

function getSmartDefaultDate(commitment) {
  const today = new Date();
  const m = today.getMonth();
  const y = today.getFullYear();
  const dim = new Date(y, m + 1, 0).getDate();
  const dd = Math.min(commitment?.dueDay || 1, dim);
  const dueDate = new Date(y, m, dd);
  if (dueDate < today) return dueDate.toISOString().split('T')[0];
  return today.toISOString().split('T')[0];
}

function getSmartDefaultAmount(commitment) {
  if (!commitment) return '';
  if (commitment.isFlexible && commitment.flexibleRange?.min && commitment.flexibleRange?.max) {
    return String(Math.round((commitment.flexibleRange.min + commitment.flexibleRange.max) / 2));
  }
  return String(commitment.amount || '');
}

export default function Commitments() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const now = new Date();
  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [editCommitment, setEditCommitment] = useState(null);

  // Core queries
  const { data: wfData, isLoading: wfLoading } = useQuery({
    queryKey: ['waterfall', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => commitmentsAPI.getWaterfall({ month: now.getMonth() + 1, year: now.getFullYear() }).then(r => r.data),
    refetchInterval: 60000,
  });
  const { data: checklistData, isLoading: clLoading } = useQuery({
    queryKey: ['commitment-logs', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => commitmentsAPI.getLogs({ month: now.getMonth() + 1, year: now.getFullYear() }).then(r => r.data),
  });
  const { data: varianceData } = useQuery({
    queryKey: ['commitment-variance'],
    queryFn: () => commitmentsAPI.getVariance(6).then(r => r.data),
  });

  // Brain queries
  const { data: affordData } = useQuery({
    queryKey: ['affordability'],
    queryFn: () => commitmentsAPI.getAffordability().then(r => r.data?.data),
  });
  const { data: suggestionsData } = useQuery({
    queryKey: ['brain-suggestions-commitments'],
    queryFn: () => patternsAPI.getCommitments().then(r => r.data?.data || []),
  });

  // Mutations
  const invalidateAll = () => { qc.invalidateQueries({ queryKey: ['waterfall'] }); qc.invalidateQueries({ queryKey: ['commitment-logs'] }); qc.invalidateQueries({ queryKey: ['brain-suggestions-commitments'] }); qc.invalidateQueries({ queryKey: ['affordability'] }); };
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => commitmentsAPI.update(id, data),
    onSuccess: () => { invalidateAll(); setEditCommitment(null); resetEdit(); toast.success('Commitment updated!'); },
  });
  const createMutation = useMutation({
    mutationFn: (data) => commitmentsAPI.create(data),
    onSuccess: () => { invalidateAll(); setAddOpen(false); reset(); toast.success('Commitment added'); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => commitmentsAPI.delete(id),
    onSuccess: () => { invalidateAll(); toast.success('Removed'); },
  });
  const pauseMutation = useMutation({
    mutationFn: (id) => commitmentsAPI.pause(id),
    onSuccess: () => { invalidateAll(); toast.success('Toggled pause'); },
  });
  const payMutation = useMutation({
    mutationFn: ({ id, ...data }) => commitmentsAPI.pay(id, data),
    onSuccess: () => { invalidateAll(); setPayOpen(null); toast.success('Marked as paid!'); },
  });
  const acceptMutation = useMutation({
    mutationFn: (id) => patternsAPI.confirm(id, {}),
    onSuccess: () => { invalidateAll(); toast.success('Commitment created from suggestion!'); },
  });
  const dismissMutation = useMutation({
    mutationFn: (id) => patternsAPI.dismiss(id),
    onSuccess: () => { invalidateAll(); },
  });

  const { register, handleSubmit, reset } = useForm();
  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit, setValue: setEditValue } = useForm();

  // Pre-fill edit form when a commitment is selected
  useEffect(() => {
    if (editCommitment) {
      setEditValue('title', editCommitment.title || '');
      setEditValue('amount', editCommitment.amount || '');
      setEditValue('category', editCommitment.category || '');
      setEditValue('priority', editCommitment.priority || 'important');
      setEditValue('dueDay', editCommitment.dueDay || 1);
      setEditValue('isFlexible', editCommitment.isFlexible || false);
      setEditValue('note', editCommitment.note || '');
    }
  }, [editCommitment, setEditValue]);

  const wf = wfData;
  const checklist = checklistData?.checklist || [];
  const suggestions = checklistData?.suggestions || {};

  // Group checklist by status
  const dueToday = checklist.filter(i => i.statusInfo?.status === 'due_today');
  const overdue = checklist.filter(i => i.statusInfo?.status === 'overdue' || i.statusInfo?.status === 'missed');
  const upcoming = checklist.filter(i => i.statusInfo?.isUpcoming);
  const paid = checklist.filter(i => i.statusInfo?.isPaid);
  const paidCount = paid.length;

  const healthLabel = wf?.healthScore >= 90 ? 'Financially Stable' : wf?.healthScore >= 70 ? 'Manageable' : wf?.healthScore >= 50 ? 'Watch Out' : 'Needs Attention';
  const healthColor = wf?.healthScore >= 90 ? '#00C896' : wf?.healthScore >= 70 ? '#4E9FFF' : wf?.healthScore >= 50 ? '#F5A623' : '#FF5A5A';
  const commitmentRatioPct = wf?.commitmentRatio || 0;
  const ratioColor = commitmentRatioPct <= 50 ? '#00C896' : commitmentRatioPct <= 70 ? '#F5A623' : '#FF5A5A';

  return (
    <MobilePage title="Commitments" headerRight={<Button size="sm" onClick={() => setAddOpen(true)}>+ Add</Button>}>
    <PageWrapper>
      <div className="space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
              <Landmark size={24} className="text-vault-pink" /> My Commitments
            </h1>
            <p className="text-vault-text-secondary text-sm mt-1">Your True Free Money — after every fixed expense is accounted for.</p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add</Button>
        </div>

        {/* Brain: Affordability Banner (first 7 days of month) */}
        {affordData && now.getDate() <= 7 && (
          <Card className={`border-l-2`} style={{ borderLeftColor: affordData.color, background: `${affordData.color}0D` }}>
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">
                {affordData.status === 'healthy' ? '✅' : affordData.status === 'warning' ? '⚠️' : '🚨'}
              </span>
              <div>
                <p className="text-sm font-medium text-vault-text-primary">
                  {affordData.status === 'healthy' ? 'This month looks good' : affordData.status === 'warning' ? 'Month might be tight' : 'Tight month ahead'}
                </p>
                <p className="text-xs text-vault-text-secondary mt-0.5 leading-relaxed">{affordData.message}</p>
                {affordData.clusterAlerts?.length > 0 && (
                  <p className="text-xs mt-1.5" style={{ color: '#F5A623' }}>
                    ⚡ ₹{affordData.clusterAlerts[0].totalAmount?.toLocaleString('en-IN')} due on the {affordData.clusterAlerts[0].day}th — {affordData.clusterAlerts[0].commitments?.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Brain: Suggestion Banner */}
        {suggestionsData?.length > 0 && (
          <Card style={{ borderColor: 'rgba(139,122,255,0.3)', background: 'rgba(139,122,255,0.07)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-lg">🧠</span>
              <div>
                <p className="text-sm font-medium text-vault-text-primary">Brain found {suggestionsData.length} recurring pattern{suggestionsData.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-vault-text-muted">These look like fixed monthly expenses — add them as commitments?</p>
              </div>
            </div>
            <div className="space-y-2">
              {suggestionsData.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/03 rounded-xl border border-white/07 flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium text-vault-text-primary">{s.title}</p>
                    <p className="text-xs text-vault-text-muted mt-0.5">{s.message}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="xs" onClick={() => acceptMutation.mutate(s.patternId)}>Add ✓</Button>
                    <button onClick={() => dismissMutation.mutate(s.patternId)} className="text-xs text-vault-text-muted px-2 py-1 border border-white/10 rounded-lg hover:bg-white/05">Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Overdue alert (classic) */}
        {overdue.length > 0 && (
          <Card className="border-vault-red/30 bg-[rgba(255,90,90,0.04)]">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-vault-red flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-vault-red">{overdue.length} overdue commitment{overdue.length > 1 ? 's' : ''}!</p>
                <p className="text-xs text-vault-text-secondary mt-0.5">
                  {overdue.map(i => i.commitment.title).join(', ')} — mark as paid once done
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Waterfall */}
        <Card>
          <h2 className="font-display font-semibold text-vault-text-primary mb-4">True Free Money Waterfall</h2>
          {wfLoading ? (
            <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-8 rounded" />)}</div>
          ) : wf ? (
            <div className="flex flex-col">
              <WaterfallRow label="Monthly Income" value={wf.income} type="income" />
              <WaterfallRow label="Fixed Commitments" value={wf.totalCommitments} type="commitment" isSubtraction />
              <WaterfallRow label="Committed Balance" value={wf.committedBalance} type="neutral" />
              <WaterfallRow label="Variable Spending" value={wf.variableSpending} type="variable" isSubtraction />
              <WaterfallRow label="True Free Money" value={wf.trueFreeMonney} type="freeMonney" isHero />
              <WaterfallRow label="Guilt-Free Used" value={wf.guiltyFreeUsed} type="guiltyFree" isSubtraction />
              <WaterfallRow label="Investable Surplus 💰" value={wf.investableSurplus} type="surplus" />
            </div>
          ) : null}
          {wf && (
            <div className="mt-4 pt-4 border-t border-white/06">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-vault-text-muted">Commitments as % of income</span>
                <span className="font-medium" style={{ color: ratioColor }}>{commitmentRatioPct}%</span>
              </div>
              <div className="h-2 bg-white/08 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, commitmentRatioPct)}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full" style={{ background: ratioColor }} />
              </div>
              <div className="flex justify-between text-xs mt-1 text-vault-text-muted">
                <span>Healthy ≤ 50%</span><span>Caution &gt; 70%</span>
              </div>
            </div>
          )}
        </Card>

        {/* Health Score + Stats */}
        {wf && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="text-center">
              <p className="text-xs text-vault-text-muted mb-2">Commitment Health</p>
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  <motion.circle cx="50" cy="50" r="40" fill="none" stroke={healthColor} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${2*Math.PI*40}`} initial={{strokeDashoffset:2*Math.PI*40}} animate={{strokeDashoffset:2*Math.PI*40*(1-(wf.healthScore||0)/100)}} transition={{duration:1}} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold" style={{ color: healthColor }}>{wf.healthScore}</span>
                </div>
              </div>
              <p className="text-sm font-medium" style={{ color: healthColor }}>{healthLabel}</p>
            </Card>
            <Card>
              <p className="text-xs text-vault-text-muted mb-1">Paid this month</p>
              <p className="text-2xl font-display font-bold text-vault-teal">{paidCount} / {checklist.length}</p>
              <p className="text-xs text-vault-text-muted mt-1">commitments covered</p>
              <div className="mt-2 h-1.5 bg-white/08 rounded-full overflow-hidden">
                <div className="h-full bg-vault-teal rounded-full transition-all" style={{ width: `${checklist.length > 0 ? (paidCount / checklist.length) * 100 : 0}%` }} />
              </div>
            </Card>
            <Card>
              <p className="text-xs text-vault-text-muted mb-1">Investable Surplus</p>
              <p className="text-2xl font-display font-bold text-vault-teal">{formatCompact(wf.investableSurplus)}</p>
              <p className="text-xs text-vault-text-muted mt-1">available to save/invest</p>
            </Card>
          </div>
        )}

        {/* Grouped Checklist */}
        <div>
          <h2 className="font-display font-semibold text-vault-text-primary mb-3">
            {now.toLocaleString('default', { month: 'long' })} Checklist
            <span className="text-vault-text-muted text-sm font-normal ml-2">{paidCount}/{checklist.length} paid</span>
          </h2>
          {clLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-vault-md" />)}</div>
          ) : checklist.length === 0 ? (
            <Card className="text-center py-8">
              <Landmark size={36} className="text-vault-pink mx-auto mb-3 opacity-40" />
              <p className="text-vault-text-secondary">No commitments added yet</p>
              <p className="text-xs text-vault-text-muted mt-1 mb-4">Add your fixed monthly expenses to track True Free Money</p>
              <Button onClick={() => setAddOpen(true)}><Plus size={14} /> Add First Commitment</Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Render: Due Today → Overdue → Upcoming → Paid */}
              {[
                { label: '🔥 Due Today', items: dueToday },
                { label: '⚠️ Overdue', items: overdue },
                { label: '📋 Upcoming', items: upcoming },
                { label: '✅ Paid', items: paid },
              ].filter(g => g.items.length > 0).map(group => (
                <div key={group.label}>
                  <p className="text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-1.5 mt-3">{group.label}</p>
                  {group.items.map(({ commitment: c, log, statusInfo, prediction }) => {
                    const st = statusInfo?.status || 'upcoming';
                    const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.upcoming;
                    const isPaid = statusInfo?.isPaid;
                    return (
                      <motion.div key={c._id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        className="glass-card p-4 mb-2 border-l-2 transition-all"
                        style={{ borderLeftColor: cfg.border, background: cfg.bg }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Status circle */}
                          <button onClick={() => !isPaid && setPayOpen({ commitment: c, log })}
                            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all"
                            style={{
                              border: isPaid ? 'none' : `1.5px solid ${cfg.color}`,
                              background: isPaid ? 'linear-gradient(135deg,#00C9A7,#009B82)' : 'transparent',
                              color: isPaid ? '#002820' : cfg.color,
                              cursor: isPaid ? 'default' : 'pointer',
                            }}>
                            {isPaid ? '✓' : (st === 'overdue' || st === 'missed' ? '!' : '')}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium ${isPaid ? 'text-vault-text-secondary line-through' : 'text-vault-text-primary'}`}>{c.title}</p>
                              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${PRIORITY_COLORS[c.priority]}15`, color: PRIORITY_COLORS[c.priority] }}>
                                {c.priority}
                              </span>
                            </div>
                            {isPaid ? (
                              <p className="text-xs mt-0.5" style={{ color: '#00C9A7' }}>
                                ✓ {getDueDateLabel(statusInfo)}
                                {' · '}
                                {log?.actualAmount && log.actualAmount !== c.amount
                                  ? <>{formatINR(log.actualAmount)} <span style={{color:'#9295A8'}}>(expected {formatINR(c.amount)})</span></>
                                  : formatINR(log?.actualAmount || c.amount)
                                }
                              </p>
                            ) : (
                              <p className="text-xs mt-0.5" style={{ color: cfg.color }}>
                                {getDueDateLabel(statusInfo)}
                                {' · '}{c.isFlexible ? `₹${c.flexibleRange?.min}–₹${c.flexibleRange?.max}` : formatINR(c.amount)}
                              </p>
                            )}
                            {/* Brain prediction for flexible */}
                            {c.isFlexible && prediction && !isPaid && (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs text-vault-text-muted">🧠 Predicted:</span>
                                <span className="text-xs font-semibold" style={{ color: '#F5A623' }}>₹{prediction.predicted?.toLocaleString('en-IN')}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                                  background: prediction.trend === 'rising' ? 'rgba(255,92,92,0.12)' : prediction.trend === 'falling' ? 'rgba(0,201,167,0.12)' : 'rgba(255,255,255,0.06)',
                                  color: prediction.trend === 'rising' ? '#FF5C5C' : prediction.trend === 'falling' ? '#00C9A7' : '#9295A8',
                                }}>
                                  {prediction.trend === 'rising' ? `↑ +${prediction.trendPct}%` : prediction.trend === 'falling' ? `↓ ${prediction.trendPct}%` : '→ Stable'}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                            {!isPaid && (st === 'overdue' || st === 'missed') && (
                              <button onClick={() => setPayOpen({ commitment: c, log, prefillNote: 'Paid (entered retroactively)' })}
                                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                                style={{ background: 'linear-gradient(135deg,rgba(0,201,167,0.15),rgba(0,201,167,0.08))', color: '#00C9A7', border: '0.5px solid rgba(0,201,167,0.3)' }}>
                                ✓ Already Paid
                              </button>
                            )}
                            {!isPaid && st !== 'overdue' && st !== 'missed' && (
                              <button onClick={() => setPayOpen({ commitment: c, log })}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
                                style={{ background: 'rgba(0,201,167,0.12)', color: '#00C9A7', border: '0.5px solid rgba(0,201,167,0.3)' }}>
                                Pay
                              </button>
                            )}
                            <button onClick={() => setEditCommitment(c)} className="p-1.5 hover:text-vault-amber text-vault-text-muted transition-all" title="Edit commitment">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => pauseMutation.mutate(c._id)} className="p-1.5 hover:text-vault-amber text-vault-text-muted transition-all" title="Pause this month"><Pause size={14} /></button>
                            <button onClick={() => deleteMutation.mutate(c._id)} className="p-1.5 hover:text-vault-red text-vault-text-muted transition-all"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variance tracker */}
        {varianceData?.data?.length > 0 && (
          <Card padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Flexible Commitment Variance</h2>
              <p className="text-xs text-vault-text-muted">How your variable commitments change over time</p>
            </div>
            <div className="px-2 pb-4 space-y-4">
              {varianceData.data.map(({ commitment: c, history }) => {
                const trend = history[history.length - 1]?.actual - history[0]?.actual;
                return (
                  <div key={c._id} className="px-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-vault-text-secondary">{c.title}</p>
                      <span className={`text-xs ${trend > 0 ? 'text-vault-red' : 'text-vault-teal'}`}>
                        {trend > 0 ? '↑' : '↓'} {formatINR(Math.abs(trend))} vs 6mo ago
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={60}>
                      <AreaChart data={history}>
                        <Area type="monotone" dataKey="actual" stroke="#F5A623" fill="rgba(245,166,35,0.1)" strokeWidth={1.5} dot={false} />
                        <Area type="monotone" dataKey="expected" stroke="rgba(255,255,255,0.15)" fill="none" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                        <Tooltip formatter={v => formatINR(v)} contentStyle={{ background: '#13151C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Add Commitment Modal */}
        <Modal 
          isOpen={addOpen} 
          onClose={() => { setAddOpen(false); reset(); }} 
          title="Add Commitment"
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" type="button" onClick={() => setAddOpen(false)} fullWidth>Cancel</Button>
              <Button type="button" onClick={handleSubmit(d => createMutation.mutate({ ...d, dueDay: parseInt(d.dueDay), amount: parseFloat(d.amount) }))} loading={createMutation.isPending} fullWidth>Add Commitment</Button>
            </div>
          }
        >
          <form id="add-commitment-form" onSubmit={handleSubmit(d => createMutation.mutate({ ...d, dueDay: parseInt(d.dueDay), amount: parseFloat(d.amount) }))} className="space-y-4">
            <Input label="Title" placeholder="Rent, Gym membership, Protein..." {...register('title', { required: true })} />
            <Input label="Amount" type="number" prefix="₹" {...register('amount', { required: true })} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-vault-text-secondary uppercase tracking-wide">Category</label>
                <select className="vault-select" {...register('category', { required: true })}>
                  {COMMITMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-vault-text-secondary uppercase tracking-wide">Priority</label>
                <select className="vault-select" {...register('priority')}>
                  <option value="critical">Critical</option>
                  <option value="important">Important</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
            </div>
            <Input label="Due day of month" type="number" min="1" max="31" placeholder="1" {...register('dueDay')} />
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-amber-500" {...register('isFlexible')} />
              <span className="text-sm text-vault-text-secondary">Amount varies month-to-month</span>
            </label>
            <Input label="Note (optional)" {...register('note')} />
          </form>
        </Modal>

        {/* Edit Commitment Modal */}
        <Modal
          isOpen={!!editCommitment}
          onClose={() => { setEditCommitment(null); resetEdit(); }}
          title="Edit Commitment"
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" type="button" onClick={() => { setEditCommitment(null); resetEdit(); }} fullWidth>Cancel</Button>
              <Button type="button" onClick={handleSubmitEdit(d => updateMutation.mutate({ id: editCommitment._id, data: { ...d, dueDay: parseInt(d.dueDay), amount: parseFloat(d.amount) } }))} loading={updateMutation.isPending} fullWidth>Save Changes</Button>
            </div>
          }
        >
          <form className="space-y-4">
            <Input label="Title" placeholder="Rent, Gym membership, Protein..." {...registerEdit('title', { required: true })} />
            <Input label="Amount" type="number" prefix="₹" {...registerEdit('amount', { required: true })} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-vault-text-secondary uppercase tracking-wide">Category</label>
                <select className="vault-select" {...registerEdit('category', { required: true })}>
                  {COMMITMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-vault-text-secondary uppercase tracking-wide">Priority</label>
                <select className="vault-select" {...registerEdit('priority')}>
                  <option value="critical">Critical</option>
                  <option value="important">Important</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
            </div>
            <Input label="Due day of month" type="number" min="1" max="31" placeholder="1" {...registerEdit('dueDay')} />
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-amber-500" {...registerEdit('isFlexible')} />
              <span className="text-sm text-vault-text-secondary">Amount varies month-to-month</span>
            </label>
            <Input label="Note (optional)" {...registerEdit('note')} />
          </form>
        </Modal>

        {/* Pay modal */}
        <PayModal
          payOpen={payOpen}
          onClose={() => { setPayOpen(null); }}
          onPay={(data) => payMutation.mutate(data)}
          isPending={payMutation.isPending}
        />
      </div>
    </PageWrapper>
    </MobilePage>
  );
}

function PayModal({ payOpen, onClose, onPay, isPending }) {
  const commitment = payOpen?.commitment;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (commitment) {
      setAmount(getSmartDefaultAmount(commitment));
      setDate(getSmartDefaultDate(commitment));
      setNote(payOpen?.prefillNote || '');
    }
  }, [commitment?._id, payOpen?.prefillNote]);

  if (!payOpen) return null;

  return (
    <Modal
      isOpen={!!payOpen}
      onClose={onClose}
      title={`Mark as paid: ${commitment?.title}`}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" type="button" onClick={onClose} fullWidth>Cancel</Button>
          <Button type="button" onClick={() => onPay({ id: commitment._id, actualAmount: parseFloat(amount), paidOn: date, note })} loading={isPending} fullWidth>Mark Paid ✓</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label style={{ display:'block', fontFamily:'Inter', fontSize:11, fontWeight:500, color:'#9295A8', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:7 }}>Amount Paid</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color:'#4A4E65', fontWeight:500 }}>₹</span>
            <input type="number" className="gi" style={{ paddingLeft:32 }} value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          {commitment?.isFlexible && (
            <p style={{ fontFamily:'Inter', fontSize:11, color:'#9295A8', margin:'5px 0 0' }}>
              Range: ₹{commitment.flexibleRange?.min?.toLocaleString('en-IN')} – ₹{commitment.flexibleRange?.max?.toLocaleString('en-IN')}
            </p>
          )}
        </div>
        <div>
          <label style={{ display:'block', fontFamily:'Inter', fontSize:11, fontWeight:500, color:'#9295A8', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:7 }}>Date Paid</label>
          <input type="date" className="gi" value={date} onChange={e => setDate(e.target.value)} />
          {date !== todayStr && (
            <p style={{ fontFamily:'Inter', fontSize:11, color:'#F5A623', margin:'5px 0 0', opacity:0.8 }}>
              Pre-filled with due date — change if you paid on a different day
            </p>
          )}
        </div>
        <div>
          <label style={{ display:'block', fontFamily:'Inter', fontSize:11, fontWeight:500, color:'#9295A8', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:7 }}>Note (optional)</label>
          <input className="gi" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note..." />
        </div>
      </div>
    </Modal>
  );
}
