import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { bucketsAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { CardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { formatINR, formatCompact } from '../utils/formatCurrency';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, ArrowRightLeft, RefreshCw, Building2, Banknote, Smartphone, Plus, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const BUCKET_ICONS = { bank_account: Building2, cash: Banknote, upi_wallet: Smartphone, other: Wallet };
const BUCKET_COLORS = ['#F5A623', '#00C896', '#4E9FFF', '#8B7CF6', '#FF5A5A', '#F06292'];

export default function MyMoney() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [showBals, setShowBals] = useState(!user?.hideWalletBalance);

  const { data: nwData, isLoading } = useQuery({
    queryKey: ['net-worth'],
    queryFn: () => bucketsAPI.getNetWorth().then(r => r.data),
  });
  const { data: histData } = useQuery({
    queryKey: ['net-worth-history'],
    queryFn: () => bucketsAPI.getNetWorthHistory(6).then(r => r.data),
  });
  const { data: accData } = useQuery({
    queryKey: ['savings-accuracy'],
    queryFn: () => bucketsAPI.getSavingsAccuracy({}).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d) => bucketsAPI.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['net-worth'] }); setAddOpen(false); aReset(); toast.success('Bucket added!'); },
  });
  const balMut = useMutation({
    mutationFn: ({ id, balance, note }) => bucketsAPI.updateBalance(id, balance, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['net-worth'] }); qc.invalidateQueries({ queryKey: ['net-worth-history'] }); setUpdateOpen(null); uReset(); toast.success('Balance updated!'); },
  });
  const txfrMut = useMutation({
    mutationFn: (d) => bucketsAPI.transfer(d),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ['net-worth'] }); setTransferOpen(false); tReset(); toast.success(data.message); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const { register: aReg, handleSubmit: aSubmit, reset: aReset } = useForm();
  const { register: uReg, handleSubmit: uSubmit, reset: uReset } = useForm();
  const { register: tReg, handleSubmit: tSubmit, reset: tReset } = useForm();

  const total = nwData?.total || 0;
  const byBucket = nwData?.byBucket || [];
  const safeToSpend = nwData?.safeToSpend || 0;
  const momDelta = nwData?.momDelta || 0;
  const histChart = histData?.data || [];
  const gap = accData?.gap || 0;
  const disp = (v) => showBals ? formatINR(v) : '₹ ••••';

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
              <Wallet size={24} className="text-vault-amber" /> My Money
            </h1>
            <p className="text-vault-text-secondary text-sm mt-1">Your complete net worth picture.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="icon" onClick={() => setShowBals(!showBals)}>{showBals ? <Eye size={16} /> : <EyeOff size={16} />}</Button>
            <Button variant="secondary" size="sm" onClick={() => setTransferOpen(true)}><ArrowRightLeft size={14} /> Transfer</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add</Button>
          </div>
        </div>

        {/* Net Worth Hero */}
        {isLoading ? <CardSkeleton /> : (
          <Card glow="amber">
            <p className="text-xs text-vault-text-muted uppercase tracking-widest mb-2">Net Liquid Worth</p>
            <div className="flex items-end gap-4 mb-6">
              <p className="text-5xl font-display font-bold text-vault-text-primary">{disp(total)}</p>
              <div className={`flex items-center gap-1 text-sm font-medium pb-1 ${momDelta >= 0 ? 'text-vault-teal' : 'text-vault-red'}`}>
                {momDelta >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {momDelta >= 0 ? '+' : ''}{formatINR(momDelta)} MoM
              </div>
            </div>
            <div className="space-y-2 mb-6">
              {byBucket.map((b, i) => {
                const Icon = BUCKET_ICONS[b.type] || Wallet;
                const color = BUCKET_COLORS[i % BUCKET_COLORS.length];
                return (
                  <div key={b._id} className="flex items-center gap-3">
                    <Icon size={14} style={{ color }} className="flex-shrink-0" />
                    <span className="text-sm text-vault-text-secondary w-32 truncate">{b.name}</span>
                    <div className="flex-1 h-1.5 bg-white/08 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${b.pct}%` }} transition={{ duration: 0.6, delay: i * 0.1 }}
                        className="h-full rounded-full" style={{ background: color }} />
                    </div>
                    <span className="text-sm font-medium text-vault-text-primary w-24 text-right tabular-nums">{disp(b.balance)}</span>
                    <button onClick={() => { setUpdateOpen(b); uReset({ balance: b.balance }); }}
                      className="p-1 hover:text-vault-amber text-vault-text-muted transition-all">
                      <RefreshCw size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className={`p-4 rounded-vault-md ${safeToSpend >= 0 ? 'bg-[rgba(0,200,150,0.08)] border border-[rgba(0,200,150,0.2)]' : 'bg-[rgba(255,90,90,0.08)] border border-[rgba(255,90,90,0.2)]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-vault-text-muted uppercase tracking-wide">Safe to Spend</p>
                  <p className={`text-2xl font-display font-bold mt-1 ${safeToSpend >= 0 ? 'text-vault-teal' : 'text-vault-red'}`}>{disp(Math.abs(safeToSpend))}</p>
                </div>
                <div className="text-right text-xs text-vault-text-muted">
                  <p>After unpaid commitments</p>
                  <p className="mt-0.5">{formatINR(nwData?.unpaidTotal || 0)} pending</p>
                </div>
              </div>
              {safeToSpend < 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <AlertTriangle size={12} className="text-vault-red" />
                  <p className="text-xs text-vault-red">Unpaid commitments exceed current balance</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && byBucket.length === 0 && (
          <Card className="text-center py-10">
            <Wallet size={36} className="text-vault-amber mx-auto mb-3 opacity-40" />
            <p className="text-vault-text-secondary">No buckets yet</p>
            <p className="text-xs text-vault-text-muted mt-1 mb-4">Add your accounts, cash, and wallets</p>
            <Button onClick={() => setAddOpen(true)}><Plus size={14} /> Add First Bucket</Button>
          </Card>
        )}

        {/* Trend chart */}
        {histChart.length > 0 && (
          <Card padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Net Worth Trend</h2>
              <p className="text-xs text-vault-text-muted">Last 6 months</p>
            </div>
            <div className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={histChart}>
                  <defs>
                    <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A4F63' }} />
                  <YAxis tickFormatter={v => formatCompact(v)} tick={{ fontSize: 11, fill: '#4A4F63' }} />
                  <Tooltip formatter={v => formatINR(v)} contentStyle={{ background: '#13151C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#F5A623" fill="url(#nwGrad)" strokeWidth={2} dot={{ r: 4, fill: '#F5A623' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Savings accuracy */}
        {accData?.hasData && Math.abs(gap) > 500 && (
          <Card className="border-l-2 border-vault-purple">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-vault-purple flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-vault-text-primary">True Savings Accuracy Check</p>
                <p className="text-xs text-vault-text-secondary mt-1 leading-relaxed">
                  Your logged records suggest you saved <span className="text-vault-teal font-medium">{formatINR(accData.loggedSavings)}</span> this month,
                  but your balance only grew by <span className="text-vault-amber font-medium">{formatINR(accData.actualChange)}</span>.
                  About <span className="text-vault-red font-medium">{formatINR(Math.abs(gap))}</span> {gap > 0 ? 'may be untracked (cash, forgotten transactions).' : 'is extra unlisted income.'}
                </p>
              </div>
            </div>
          </Card>
        )}

        <p className="text-xs text-vault-text-muted text-center">🔒 Balances are stored securely and never shared. Delete all wallet data anytime from Settings → Data.</p>

        {/* Add Bucket Modal */}
        <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); aReset(); }} title="Add Money Bucket">
          <form onSubmit={aSubmit(d => createMut.mutate({ ...d, balance: parseFloat(d.balance) }))} className="space-y-4">
            <Input label="Name" placeholder="SBI Savings, PhonePe, Cash…" {...aReg('name', { required: true })} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-vault-text-secondary uppercase tracking-wide">Type</label>
              <select className="vault-select" {...aReg('type')}>
                <option value="bank_account">🏦 Bank Account</option>
                <option value="cash">💵 Cash</option>
                <option value="upi_wallet">📱 UPI Wallet</option>
                <option value="other">📂 Other</option>
              </select>
            </div>
            <Input label="Current balance" type="number" prefix="₹" {...aReg('balance', { required: true })} />
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-amber-500" {...aReg('isPrimary')} />
              <span className="text-sm text-vault-text-secondary">Primary salary account</span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setAddOpen(false)} fullWidth>Cancel</Button>
              <Button type="submit" loading={createMut.isPending} fullWidth>Add Bucket</Button>
            </div>
          </form>
        </Modal>

        {/* Update Balance Modal */}
        <Modal isOpen={!!updateOpen} onClose={() => { setUpdateOpen(null); uReset(); }} title={`Update: ${updateOpen?.name}`}>
          <form onSubmit={uSubmit(d => balMut.mutate({ id: updateOpen._id, balance: parseFloat(d.balance), note: d.note }))} className="space-y-4">
            <div className="text-center p-3 bg-white/03 rounded-vault-md mb-2">
              <p className="text-xs text-vault-text-muted">Previous: {formatINR(updateOpen?.balance)}</p>
            </div>
            <Input label="New balance" type="number" prefix="₹" defaultValue={updateOpen?.balance} {...uReg('balance', { required: true })} />
            <Input label="Note (optional)" placeholder="Salary credited, ATM withdrawal…" {...uReg('note')} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setUpdateOpen(null)} fullWidth>Cancel</Button>
              <Button type="submit" loading={balMut.isPending} fullWidth>Update</Button>
            </div>
          </form>
        </Modal>

        {/* Transfer Modal */}
        <Modal isOpen={transferOpen} onClose={() => { setTransferOpen(false); tReset(); }} title="Transfer Between Buckets">
          <form onSubmit={tSubmit(d => txfrMut.mutate({ fromId: d.fromId, toId: d.toId, amount: parseFloat(d.amount) }))} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-vault-text-secondary uppercase tracking-wide">From</label>
              <select className="vault-select" {...tReg('fromId', { required: true })}>
                {byBucket.map(b => <option key={b._id} value={b._id}>{b.name} ({formatINR(b.balance)})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-vault-text-secondary uppercase tracking-wide">To</label>
              <select className="vault-select" {...tReg('toId', { required: true })}>
                {byBucket.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <Input label="Amount" type="number" prefix="₹" {...tReg('amount', { required: true })} />
            <p className="text-xs text-vault-text-muted">Net worth stays the same — just moves money between buckets.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setTransferOpen(false)} fullWidth>Cancel</Button>
              <Button type="submit" loading={txfrMut.isPending} fullWidth>Transfer</Button>
            </div>
          </form>
        </Modal>
      </div>
    </PageWrapper>
  );
}
