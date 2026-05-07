import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { accountsAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import PageWrapper from '../components/layout/PageWrapper';
import MobilePage from '../components/layout/MobilePage';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { CardSkeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/formatCurrency';
import {
  Wallet, Plus, Eye, EyeOff, ArrowRightLeft, Building2,
  Banknote, Smartphone, CreditCard, Star, Trash2, Pencil, RefreshCw,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const ACCOUNT_COLORS = ['#F5A623', '#00C9A7', '#4E9FFF', '#8B7CF6', '#FF5C5C', '#F06292'];
const ACCOUNT_TYPES = [
  { id: 'bank_account', label: 'Bank Account', icon: Building2, emoji: '🏦' },
  { id: 'cash',         label: 'Cash',          icon: Banknote,  emoji: '💵' },
  { id: 'upi_wallet',  label: 'UPI Wallet',    icon: Smartphone,emoji: '📱' },
  { id: 'credit_card', label: 'Credit Card',   icon: CreditCard, emoji: '💳' },
  { id: 'other',       label: 'Other',          icon: Wallet,    emoji: '💰' },
];

function getTypeEmoji(type) {
  return ACCOUNT_TYPES.find(t => t.id === type)?.emoji || '💰';
}
function getTypeLabel(type) {
  return ACCOUNT_TYPES.find(t => t.id === type)?.label || 'Account';
}

export default function MyMoney() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [addOpen, setAddOpen]       = useState(false);
  const [editOpen, setEditOpen]     = useState(null); // account object
  const [balOpen, setBalOpen]       = useState(null); // account object
  const [transferOpen, setTransferOpen] = useState(false);
  const [showBals, setShowBals]     = useState(!user?.hideWalletBalance);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['accounts'] });
    qc.invalidateQueries({ queryKey: ['accounts-summary'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['accounts-summary'],
    queryFn: () => accountsAPI.getSummary().then(r => r.data.data),
  });
  const accounts = summaryData?.accounts || [];
  const totalBalance = summaryData?.totalBalance || 0;
  const safeToSpend = summaryData?.safeToSpend ?? 0;
  const spentThisMonth = summaryData?.spentThisMonth || 0;

  const { register: aReg, handleSubmit: aSubmit, reset: aReset, watch: aWatch } = useForm({
    defaultValues: { type: 'bank_account', balance: '', name: '', color: '#F5A623' },
  });
  const { register: uReg, handleSubmit: uSubmit, reset: uReset } = useForm();
  const { register: eReg, handleSubmit: eSubmit, reset: eReset } = useForm();
  const { register: tReg, handleSubmit: tSubmit, reset: tReset } = useForm();

  const createMut = useMutation({
    mutationFn: (d) => accountsAPI.create(d),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      aReset();
      toast.success('Account added!');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add'),
  });
  const balMut = useMutation({
    mutationFn: ({ id, balance, note }) => accountsAPI.updateBalance(id, parseFloat(balance), note),
    onSuccess: () => {
      invalidate();
      setBalOpen(null);
      uReset();
      toast.success('Balance updated!');
    },
  });
  const editMut = useMutation({
    mutationFn: ({ id, ...data }) => accountsAPI.update(id, data),
    onSuccess: () => {
      invalidate();
      setEditOpen(null);
      eReset();
      toast.success('Account updated!');
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => accountsAPI.delete(id),
    onSuccess: () => { invalidate(); toast.success('Account removed'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete'),
  });
  const defaultMut = useMutation({
    mutationFn: (id) => accountsAPI.setDefault(id),
    onSuccess: () => { invalidate(); toast.success('Default account updated!'); },
  });
  const transferMut = useMutation({
    mutationFn: (d) => accountsAPI.transfer(d),
    onSuccess: ({ data }) => {
      invalidate();
      setTransferOpen(false);
      tReset();
      toast.success(data.message || 'Transfer complete!');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Transfer failed'),
  });

  const disp = (v) => showBals ? formatINR(v) : '₹ ••••';

  return (
    <MobilePage title="My Money">
    <PageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
              <Wallet size={24} className="text-vault-amber" /> My Money
            </h1>
            <p className="text-vault-text-secondary text-sm mt-1">Real balances. Real spending power.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="icon" onClick={() => setShowBals(!showBals)}>
              {showBals ? <Eye size={16} /> : <EyeOff size={16} />}
            </Button>
            {accounts.length > 1 && (
              <Button variant="secondary" size="sm" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft size={14} /> Transfer
              </Button>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Add Account
            </Button>
          </div>
        </div>

        {/* Safe to Spend Hero */}
        {isLoading ? <CardSkeleton /> : (
          <Card glow="amber">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-vault-text-muted uppercase tracking-widest mb-2">Total Balance</p>
                <p className="text-4xl font-display font-bold text-vault-text-primary">{disp(totalBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-vault-text-muted uppercase tracking-widest mb-2">Safe to Spend</p>
                <p className={`text-4xl font-display font-bold ${safeToSpend >= 0 ? 'text-vault-teal' : 'text-vault-red'}`}>
                  {disp(Math.abs(safeToSpend))}
                </p>
                {spentThisMonth > 0 && (
                  <p className="text-xs text-vault-text-muted mt-1">−{formatINR(spentThisMonth)} spent this month</p>
                )}
              </div>
              <div>
                <p className="text-xs text-vault-text-muted uppercase tracking-widest mb-2">Formula</p>
                <p className="text-xs text-vault-text-secondary leading-relaxed">
                  Total Balance<br />
                  − Spent this month<br />
                  = Safe to Spend
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Account Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : accounts.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-4xl mb-3">🏦</p>
              <p className="font-display font-semibold text-vault-text-primary mb-2">No accounts yet</p>
              <p className="text-sm text-vault-text-muted mb-4">
                Add your bank accounts, UPI wallets, and credit cards to start tracking your real balances.
              </p>
              <Button onClick={() => setAddOpen(true)}><Plus size={14} /> Add your first account</Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc, i) => {
              const pct = totalBalance > 0 ? Math.round((acc.balance / totalBalance) * 100) : 0;
              return (
                <motion.div
                  key={acc._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card style={{
                    border: acc.isDefault
                      ? `0.5px solid ${acc.color || '#F5A623'}55`
                      : '0.5px solid rgba(255,255,255,0.07)',
                  }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: 42, height: 42, borderRadius: 12,
                          background: `${acc.color || '#F5A623'}18`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 20, flexShrink: 0,
                        }}>
                          {getTypeEmoji(acc.type)}
                        </div>
                        <div>
                          <p className="font-display font-semibold text-vault-text-primary">{acc.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-vault-text-muted">{getTypeLabel(acc.type)}</span>
                            {acc.isDefault && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                                padding: '2px 6px', borderRadius: 100,
                                background: `${acc.color || '#F5A623'}22`,
                                color: acc.color || '#F5A623',
                              }}>DEFAULT</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setBalOpen(acc); uReset({ balance: acc.balance, note: '' }); }}
                          className="p-1.5 rounded-lg text-vault-text-muted hover:text-vault-amber hover:bg-white/05 transition-all"
                          title="Update balance"
                        >
                          <RefreshCw size={13} />
                        </button>
                        {!acc.isDefault && (
                          <button
                            onClick={() => defaultMut.mutate(acc._id)}
                            className="p-1.5 rounded-lg text-vault-text-muted hover:text-vault-amber hover:bg-white/05 transition-all"
                            title="Set as default"
                          >
                            <Star size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => { setEditOpen(acc); eReset({ name: acc.name, type: acc.type, color: acc.color }); }}
                          className="p-1.5 rounded-lg text-vault-text-muted hover:text-vault-blue hover:bg-white/05 transition-all"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove "${acc.name}"? This won't affect past transactions.`)) {
                              deleteMut.mutate(acc._id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-vault-text-muted hover:text-vault-red hover:bg-white/05 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Balance */}
                    <p className="text-3xl font-display font-bold text-vault-text-primary mb-3">
                      {disp(acc.balance)}
                    </p>

                    {/* Balance bar */}
                    {totalBalance > 0 && (
                      <div>
                        <div className="h-1.5 bg-white/06 rounded-full overflow-hidden mb-1">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, 2)}%` }}
                            transition={{ delay: 0.2 + i * 0.06, duration: 0.5, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: acc.color || '#F5A623' }}
                          />
                        </div>
                        <p className="text-xs text-vault-text-muted">{pct}% of total</p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Account Modal ── */}
      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); aReset(); }} title="Add Account" size="sm">
        <form onSubmit={aSubmit((d) => createMut.mutate(d))} className="space-y-4">
          <Input label="Account Name" placeholder="e.g. HDFC Savings" {...aReg('name', { required: true })} />

          <div>
            <label className="block text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-2">Type</label>
            <select className="gi w-full" {...aReg('type')}>
              {ACCOUNT_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-2">Opening Balance</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-vault-text-muted font-medium">₹</span>
              <input type="number" step="0.01" className="gi w-full" style={{ paddingLeft: 32 }} placeholder="0" {...aReg('balance')} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_COLORS.map(color => {
                const selected = aWatch('color') === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => aReg('color').onChange({ target: { value: color, name: 'color' } })}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: color,
                      border: selected ? '3px solid #fff' : '2px solid transparent',
                      boxShadow: selected ? `0 0 0 2px ${color}` : 'none',
                      cursor: 'pointer', flexShrink: 0,
                      outline: 'none', transition: 'all 0.15s ease',
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setAddOpen(false); aReset(); }} style={{ flex: 1 }}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending} style={{ flex: 1 }}>Add Account</Button>
          </div>
        </form>
      </Modal>

      {/* ── Update Balance Modal ── */}
      <Modal isOpen={!!balOpen} onClose={() => { setBalOpen(null); uReset(); }} title={`Update Balance — ${balOpen?.name}`} size="sm">
        <form onSubmit={uSubmit((d) => balMut.mutate({ id: balOpen._id, ...d }))} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-2">New Balance</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-vault-text-muted font-medium">₹</span>
              <input type="number" step="0.01" className="gi w-full" style={{ paddingLeft: 32 }} {...uReg('balance', { required: true })} />
            </div>
          </div>
          <Input label="Note (optional)" placeholder="e.g., Salary received" {...uReg('note')} />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setBalOpen(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button type="submit" loading={balMut.isPending} style={{ flex: 1 }}>Update</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Account Modal ── */}
      <Modal isOpen={!!editOpen} onClose={() => { setEditOpen(null); eReset(); }} title={`Edit — ${editOpen?.name}`} size="sm">
        <form onSubmit={eSubmit((d) => editMut.mutate({ id: editOpen._id, ...d }))} className="space-y-4">
          <Input label="Account Name" {...eReg('name', { required: true })} />
          <div>
            <label className="block text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-2">Type</label>
            <select className="gi w-full" {...eReg('type')}>
              {ACCOUNT_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_COLORS.map(color => (
                <button
                  key={color} type="button"
                  onClick={() => eReg('color').onChange({ target: { value: color, name: 'color' } })}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: color,
                    border: editOpen?.color === color ? '3px solid #fff' : '2px solid transparent',
                    boxShadow: editOpen?.color === color ? `0 0 0 2px ${color}` : 'none',
                    cursor: 'pointer', outline: 'none', transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(null)} style={{ flex: 1 }}>Cancel</Button>
            <Button type="submit" loading={editMut.isPending} style={{ flex: 1 }}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* ── Transfer Modal ── */}
      <Modal isOpen={transferOpen} onClose={() => { setTransferOpen(false); tReset(); }} title="Transfer Between Accounts" size="sm">
        <form onSubmit={tSubmit((d) => transferMut.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-2">From</label>
            <select className="gi w-full" {...tReg('fromId', { required: true })}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{getTypeEmoji(a.type)} {a.name} — {formatINR(a.balance)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-2">To</label>
            <select className="gi w-full" {...tReg('toId', { required: true })}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{getTypeEmoji(a.type)} {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-vault-text-muted uppercase tracking-wide mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-vault-text-muted font-medium">₹</span>
              <input type="number" step="0.01" className="gi w-full" style={{ paddingLeft: 32 }} {...tReg('amount', { required: true })} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setTransferOpen(false)} style={{ flex: 1 }}>Cancel</Button>
            <Button type="submit" loading={transferMut.isPending} style={{ flex: 1 }}>Transfer</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
    </MobilePage>
  );
}


