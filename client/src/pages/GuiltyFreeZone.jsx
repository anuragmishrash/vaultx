import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { transactionsAPI, authAPI, patternsAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { CardSkeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/formatCurrency';
import { Shield, Plus, History, Heart } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function GuiltyFreeZone() {
  const { user, updateUser } = useAuthStore();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const allowance = user?.guiltyFreeAllowance || 1500;

  const { data, isLoading } = useQuery({
    queryKey: ['guilt-free-spends'],
    queryFn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return transactionsAPI.getAll({ isGuiltyFreeSpend: 'true', startDate: start, limit: 50 }).then(r => r.data);
    },
  });

  const { register, handleSubmit, reset } = useForm();

  const addMutation = useMutation({
    mutationFn: (data) => transactionsAPI.create({ ...data, isGuiltyFreeSpend: true, category: 'Guilt-Free' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['guilt-free-spends'] });
      toast.success('Guilt-free spend added — enjoy it! 🎉');
      reset(); setAddOpen(false);
    },
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions-guilt-free'],
    queryFn: () => patternsAPI.getGuiltFree().then(r => r.data.data),
    staleTime: 0,
  });

  const confirmSuggestion = useMutation({
    mutationFn: (id) => patternsAPI.confirm(id, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suggestions-guilt-free'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['guilt-free-spends'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Guilt-free spend added!');
    }
  });

  const dismissSuggestion = useMutation({
    mutationFn: (id) => patternsAPI.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions-guilt-free'] }),
  });

  const txns = data?.transactions || [];
  const totalSpent = txns.reduce((s, t) => s + t.amount, 0);
  const remaining = allowance - totalSpent;
  const pct = Math.min(100, Math.round((totalSpent / allowance) * 100));
  const barColor = pct < 60 ? '#00C896' : pct < 85 ? '#F5A623' : '#FF5A5A';

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
            <Shield size={24} className="text-vault-teal" /> Guilt-Free Zone
          </h1>
          <p className="text-vault-text-secondary text-sm mt-1">Your monthly allowance to spend freely — zero judgment, zero tracking pressure.</p>
        </div>

        {/* Suggestions Banner */}
        {suggestions?.length > 0 && (
          <div className="space-y-2">
            {suggestions.map(s => (
              <motion.div key={s.patternId} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-3 flex items-center justify-between border-vault-teal/30 bg-vault-teal/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-vault-teal/20 flex items-center justify-center text-vault-teal font-bold">🎉</div>
                  <div>
                    <p className="text-sm font-medium text-vault-text-primary">Add {s.title} for {formatINR(s.amount)}?</p>
                    <p className="text-xs text-vault-text-muted">{s.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => dismissSuggestion.mutate(s.patternId)} disabled={dismissSuggestion.isPending}>Dismiss</Button>
                  <Button variant="primary" size="sm" onClick={() => confirmSuggestion.mutate(s.patternId)} loading={confirmSuggestion.isPending}>Add</Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Wallet hero */}
        <Card glow="teal" className="text-center py-8 wallet-stitch">
          <p className="text-xs text-vault-text-muted uppercase tracking-widest mb-4">Guilt-Free Balance</p>
          <div className="relative w-40 h-40 mx-auto mb-4">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
              <motion.circle
                cx="50" cy="50" r="42" fill="none"
                stroke={barColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - pct / 100) }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-display font-bold text-vault-text-primary">{formatINR(remaining)}</span>
              <span className="text-xs text-vault-text-muted">left</span>
            </div>
          </div>
          <p className="text-sm text-vault-text-secondary">
            {formatINR(totalSpent)} spent of {formatINR(allowance)} allowance
          </p>
          <div className="mt-4">
            <Button onClick={() => setAddOpen(true)} className="glow-amber">
              <Plus size={16} /> Spend Guilt-Free
            </Button>
            <p className="text-xs text-vault-text-muted mt-3 max-w-xs mx-auto leading-relaxed">
              Only spends added via "Spend Guilt-Free" count against this allowance. Regular transactions are tracked separately.
            </p>
          </div>
        </Card>

        {/* Motivational message */}
        <Card className="border-l-2 border-vault-teal">
          <div className="flex items-start gap-3">
            <Heart size={20} className="text-vault-pink flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-vault-text-primary">This is your money. Enjoy it.</p>
              <p className="text-xs text-vault-text-secondary mt-1 leading-relaxed">
                You've tracked everything else responsibly. This {formatINR(allowance)}/month is yours to spend freely — on whatever brings you joy, without guilt, without explanation.
                {remaining <= 0 && " You've used your full allowance this month. Great job staying within it!"}
              </p>
            </div>
          </div>
        </Card>

        {/* Rollover toggle */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-vault-text-primary">Balance Rollover</p>
              <p className="text-xs text-vault-text-muted mt-0.5">Unused balance adds to next month's allowance</p>
            </div>
            <button
              onClick={() => {
                authAPI.updateProfile({ guiltyFreeRollover: !user?.guiltyFreeRollover })
                  .then(({ data }) => updateUser(data.user));
              }}
              className={`relative w-12 h-6 rounded-full transition-all ${user?.guiltyFreeRollover ? 'bg-vault-teal' : 'bg-white/10'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${user?.guiltyFreeRollover ? 'left-6.5' : 'left-0.5'}`} />
            </button>
          </div>
        </Card>

        {/* History */}
        <div>
          <h2 className="font-display font-semibold text-vault-text-primary mb-3 flex items-center gap-2">
            <History size={18} /> This Month's Guilt-Free Spends
          </h2>
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-vault-md" />)}</div>
          ) : txns.length === 0 ? (
            <Card className="text-center py-8">
              <Shield size={32} className="text-vault-teal mx-auto mb-3 opacity-40" />
              <p className="text-vault-text-secondary text-sm">No guilt-free spends yet this month</p>
              <p className="text-xs text-vault-text-muted mt-1">Tap "Spend Guilt-Free" to enjoy your allowance!</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {txns.map(t => (
                <motion.div
                  key={t._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4 flex items-center gap-4"
                >
                  <div className="w-9 h-9 rounded-xl bg-[rgba(245,166,35,0.12)] flex items-center justify-center flex-shrink-0">
                    <Shield size={16} className="text-vault-amber" />
                  </div>
                  {/* Blurred title for "no judgment" aesthetic */}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-vault-text-primary blur-sm hover:blur-none transition-all cursor-pointer" title="Hover to reveal">{t.title || 'Guilt-free spend'}</p>
                    <p className="text-xs text-vault-text-muted">{format(new Date(t.date), 'MMM d')}</p>
                  </div>
                  <span className="font-semibold text-vault-amber">{formatINR(t.amount)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Add modal */}
        <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); reset(); }} title="Spend Guilt-Free 🎉">
          <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
            <div className="text-center p-4 bg-[rgba(0,200,150,0.06)] rounded-vault-md mb-2">
              <p className="text-xs text-vault-text-muted">Remaining allowance</p>
              <p className="text-2xl font-display font-bold text-vault-teal">{formatINR(remaining)}</p>
            </div>
            <Input label="Amount" type="number" prefix="₹" placeholder="500" {...register('amount', { required: true })} />
            <Input label="What's it for? (optional)" placeholder="Coffee, snacks, whatever!" {...register('note')} />
            <p className="text-xs text-vault-text-muted text-center">No category. No regret tracking. Just enjoy. 🙂</p>
            <div className="flex gap-3">
              <Button variant="secondary" type="button" onClick={() => setAddOpen(false)} fullWidth>Cancel</Button>
              <Button type="submit" loading={addMutation.isPending} fullWidth>Add Spend</Button>
            </div>
          </form>
        </Modal>
      </div>
    </PageWrapper>
  );
}
