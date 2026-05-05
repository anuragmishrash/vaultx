import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subscriptionsAPI } from '../api';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { CardSkeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/formatCurrency';
import { Ghost, Upload, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { format, addDays, differenceInDays } from 'date-fns';

function SubAvatar({ name }) {
  const colors = ['#F5A623', '#00C896', '#4E9FFF', '#8B7CF6', '#FF5A5A', '#F06292'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-[#0A0B0F] flex-shrink-0" style={{ background: color }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function GhostMoney() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [detected, setDetected] = useState([]);
  const fileRef = useRef();

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionsAPI.getAll().then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => subscriptionsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); toast.success('Subscription removed'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => subscriptionsAPI.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => subscriptionsAPI.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); setAddOpen(false); toast.success('Subscription added'); },
  });

  const detectMutation = useMutation({
    mutationFn: (file) => subscriptionsAPI.detectFromCSV(file),
    onSuccess: ({ data }) => setDetected(data.detected || []),
    onError: () => toast.error('Could not parse CSV'),
  });

  const { register, handleSubmit, reset } = useForm();

  const subs = data?.subscriptions || [];
  const active = subs.filter(s => s.isActive);
  const totalMonthly = data?.totalMonthly || 0;

  const annualData = active.map(s => ({
    name: s.name,
    annual: s.billingCycle === 'yearly' ? s.amount : s.billingCycle === 'quarterly' ? s.amount * 4 : s.amount * 12,
  })).sort((a, b) => b.annual - a.annual).slice(0, 8);

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
            <Ghost size={24} className="text-vault-blue" /> Ghost Money
          </h1>
          <p className="text-vault-text-secondary text-sm mt-1">Forgotten subscriptions quietly draining your bank account.</p>
        </div>

        {/* Ghost money banner */}
        {isLoading ? <CardSkeleton /> : totalMonthly > 0 && (
          <Card glow="red" className="border-vault-red/20">
            <div className="flex items-center gap-4">
              <div className="text-4xl">👻</div>
              <div>
                <p className="text-xs text-vault-text-muted uppercase tracking-wide mb-1">Monthly Ghost Money</p>
                <p className="text-3xl font-display font-bold text-vault-red">{formatINR(totalMonthly)}</p>
                <p className="text-sm text-vault-text-secondary mt-1">
                  That's <span className="text-vault-red font-medium">{formatINR(totalMonthly * 12)}/year</span> draining silently
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setAddOpen(true)}><Plus size={14} /> Add Subscription</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Upload Bank CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => {
            const f = e.target.files[0];
            if (f) detectMutation.mutate(f);
            e.target.value = '';
          }} />
        </div>

        {/* Detected from CSV */}
        {detected.length > 0 && (
          <Card className="border-vault-teal/30">
            <h3 className="font-semibold text-vault-teal mb-3">🔍 Auto-detected recurring charges</h3>
            <div className="space-y-2">
              {detected.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/04 rounded-vault-sm">
                  <div>
                    <p className="text-sm font-medium text-vault-text-primary">{d.name}</p>
                    <p className="text-xs text-vault-text-muted">{formatINR(d.amount)}/month · Last: {d.lastCharged ? format(new Date(d.lastCharged), 'MMM d') : 'N/A'}</p>
                  </div>
                  <Button size="sm" onClick={() => { createMutation.mutate(d); setDetected(prev => prev.filter((_, j) => j !== i)); }}>
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Subscriptions grid */}
        <div>
          <h2 className="font-display font-semibold text-vault-text-primary mb-3">Active Subscriptions ({active.length})</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : active.length === 0 ? (
            <Card className="text-center py-10">
              <Ghost size={36} className="text-vault-blue mx-auto mb-3 opacity-40" />
              <p className="text-vault-text-secondary">No subscriptions tracked yet</p>
              <p className="text-xs text-vault-text-muted mt-1">Add your subscriptions to track monthly costs</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map(sub => {
                const daysUntilDue = sub.nextDueDate ? differenceInDays(new Date(sub.nextDueDate), new Date()) : null;
                return (
                  <motion.div key={sub._id} layout whileHover={{ y: -2 }} className="glass-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <SubAvatar name={sub.name} />
                      <div className="flex gap-1">
                        <button onClick={() => updateMutation.mutate({ id: sub._id, isActive: !sub.isActive })}
                          className="p-1.5 hover:text-vault-teal text-vault-text-muted transition-all">
                          {sub.isActive ? <ToggleRight size={16} className="text-vault-teal" /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => deleteMutation.mutate(sub._id)}
                          className="p-1.5 hover:text-vault-red text-vault-text-muted transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="font-semibold text-vault-text-primary">{sub.name}</p>
                    <p className="text-2xl font-display font-bold text-vault-amber mt-1">{formatINR(sub.amount)}</p>
                    <p className="text-xs text-vault-text-muted">/{sub.billingCycle}</p>
                    {daysUntilDue !== null && (
                      <p className={`text-xs mt-2 flex items-center gap-1 ${daysUntilDue <= 3 ? 'text-vault-red' : 'text-vault-text-muted'}`}>
                        {daysUntilDue <= 3 && <AlertTriangle size={10} />}
                        Due in {daysUntilDue} days
                      </p>
                    )}
                    {sub.autoDetected && <span className="text-xs text-vault-blue mt-1 block">Auto-detected</span>}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Annual cost chart */}
        {annualData.length > 0 && (
          <Card padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Annual Cost per Subscription</h2>
              <p className="text-xs text-vault-text-muted">What each subscription costs you per year</p>
            </div>
            <div className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={annualData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#4A4F63' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#8A8FA8' }} width={80} />
                  <Tooltip formatter={v => formatINR(v)} contentStyle={{ background: '#13151C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Bar dataKey="annual" name="Annual Cost" fill="#4E9FFF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Add modal */}
        <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); reset(); }} title="Add Subscription">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <Input label="Service name" placeholder="Netflix, Spotify..." {...register('name', { required: true })} />
            <Input label="Amount" type="number" prefix="₹" {...register('amount', { required: true })} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-vault-text-secondary uppercase tracking-wide">Billing Cycle</label>
              <select className="vault-select" {...register('billingCycle')}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <Input label="Next due date" type="date" {...register('nextDueDate')} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setAddOpen(false)} type="button" fullWidth>Cancel</Button>
              <Button type="submit" loading={createMutation.isPending} fullWidth>Add</Button>
            </div>
          </form>
        </Modal>
      </div>
    </PageWrapper>
  );
}
