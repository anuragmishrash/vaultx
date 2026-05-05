import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { transactionsAPI, patternsAPI } from '../api';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { RegretBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import AddTransactionModal from '../components/features/AddTransactionModal';
import BatchDailyAdd from '../components/features/BatchDailyAdd';
import RepeatButton from '../components/features/RepeatButton';
import { TransactionSkeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/formatCurrency';
import { CATEGORIES, PAYMENT_MODES } from '../constants/categories';
import { formatTimeCost } from '../utils/timeCostHelpers';
import { getCategoryIcon } from '../utils/categoryIcons';
import { getFutureValueLabel } from '../utils/futureValueHelpers';
import { useAuthStore } from '../store/authStore';
import { Search, Filter, Download, Trash2, CheckSquare, X, ChevronDown, Edit } from 'lucide-react';
import toast from 'react-hot-toast';

const REGRET_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Unrated' },
  { value: 'worth_it', label: 'Worth It' },
  { value: 'okay', label: 'Okay' },
  { value: 'regret', label: 'Regret' },
];

const getMonthStart = () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
const getMonthEnd   = () => format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd');

const MONTH_FILTERS = [
  { label: 'This month',    value: 'this_month' },
  { label: 'Last month',    value: 'last_month' },
  { label: 'Last 3 months', value: 'last_3_months' },
  { label: 'All time',      value: 'all' },
];

export default function Transactions() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch]   = useState('');
  const [filters, setFilters] = useState({ category: '', paymentMode: '', regret: '' });
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate,   setEndDate]   = useState(getMonthEnd);
  const [activeMonthFilter, setActiveMonthFilter] = useState('this_month');
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage]     = useState(1);
  const [selected, setSelected] = useState([]);
  const [addOpen,  setAddOpen]  = useState(false);
  const [editTx,   setEditTx]   = useState(null);

  const applyMonthFilter = (val) => {
    setActiveMonthFilter(val);
    setPage(1);
    const now = new Date();
    if (val === 'this_month') {
      setStartDate(format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'));
      setEndDate(format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd'));
    } else if (val === 'last_month') {
      const lm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const ly = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      setStartDate(format(new Date(ly, lm, 1), 'yyyy-MM-dd'));
      setEndDate(format(new Date(ly, lm + 1, 0), 'yyyy-MM-dd'));
    } else if (val === 'last_3_months') {
      const d3 = new Date(); d3.setMonth(d3.getMonth() - 3);
      setStartDate(format(d3, 'yyyy-MM-dd'));
      setEndDate(format(new Date(), 'yyyy-MM-dd'));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', search, filters, startDate, endDate, sortBy, page],
    queryFn: () => transactionsAPI.getAll({
      search, ...filters, startDate, endDate, sort: sortBy, order: 'desc', page, limit: 20
    }).then(r => r.data),
    keepPreviousData: true,
  });

  // Today's titles for RepeatButton guard
  const { data: todayTitles } = useQuery({
    queryKey: ['today-titles'],
    queryFn: async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const res = await transactionsAPI.getAll({
        startDate: todayStart.toISOString(),
        endDate: todayEnd.toISOString(),
        limit: 200,
      });
      return new Set((res.data.transactions || []).map(t => t.normalizedTitle || t.title?.toLowerCase().trim()));
    },
    staleTime: 30000,
  });

  const rateMutation = useMutation({
    mutationFn: ({ id, rating }) => transactionsAPI.rateRegret(id, rating),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['zero-streak'] });
      qc.invalidateQueries({ queryKey: ['zero-logs'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Rated!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => transactionsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['zero-streak'] });
      qc.invalidateQueries({ queryKey: ['zero-logs'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Deleted');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => transactionsAPI.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['zero-streak'] });
      qc.invalidateQueries({ queryKey: ['zero-logs'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setSelected([]);
      toast.success(`${selected.length} transactions deleted`);
    },
  });

  const exportCSV = async () => {
    try {
      const { data: blob } = await transactionsAPI.exportCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'vault-transactions.csv'; a.click();
      toast.success('CSV exported!');
    } catch { toast.error('Export failed'); }
  };

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions-transactions'],
    queryFn: () => patternsAPI.getTransactions().then(r => r.data.data),
    staleTime: 0,
  });

  const confirmSuggestion = useMutation({
    mutationFn: (id) => patternsAPI.confirm(id, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suggestions-transactions'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['today-titles'] });
      toast.success('Transaction added from suggestion!');
    }
  });

  const dismissSuggestion = useMutation({
    mutationFn: (id) => patternsAPI.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions-transactions'] }),
  });

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === data?.transactions?.length ? [] : data?.transactions?.map(t => t._id) || []);

  return (
    <PageWrapper>
      <div className="space-y-5">
        {(!user?.monthlySalary || user.monthlySalary <= 0) && (
          <Card className="border-vault-amber/30 bg-[rgba(245,166,35,0.05)] py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-vault-amber">Time Cost tracking is disabled</p>
                <p className="text-xs text-vault-text-muted mt-0.5">Set your monthly salary in Settings to see how much time each purchase costs you.</p>
              </div>
            </div>
          </Card>
        )}

        {/* ⚡ Batch Daily Add */}
        <BatchDailyAdd onAdded={() => { refetch(); qc.invalidateQueries({ queryKey: ['today-titles'] }); }} />

        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-2xl text-vault-text-primary">Transactions</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={exportCSV}><Download size={14} /> Export</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>+ Add</Button>
          </div>
        </div>

        {/* Quick Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar">
          {['All', 'UPI', 'Card', 'Cash', 'ATM Withdrawal'].map(tab => {
            const isActive = tab === 'All' ? !filters.paymentMode : filters.paymentMode === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilters(f => ({ ...f, paymentMode: tab === 'All' ? '' : tab }))}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${isActive ? 'bg-[rgba(245,166,35,0.12)] text-vault-amber border border-vault-amber/30' : 'bg-white/03 border border-white/08 text-vault-text-secondary hover:text-vault-text-primary'}`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Month filter tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar">
          {MONTH_FILTERS.map(f => (
            <button key={f.value}
              onClick={() => applyMonthFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                activeMonthFilter === f.value
                  ? 'bg-[rgba(155,138,251,0.12)] text-[#9B8AFB] border-[rgba(155,138,251,0.3)]'
                  : 'bg-white/03 border-white/08 text-vault-text-muted hover:text-vault-text-secondary'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Suggestions Banner */}
        {suggestions?.length > 0 && (
          <div className="space-y-2">
            {suggestions.map(s => (
              <motion.div key={s.patternId} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-3 flex items-center justify-between border-vault-blue/30 bg-vault-blue/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-vault-blue/20 flex items-center justify-center text-vault-blue font-bold">✨</div>
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

        {/* Search + Filters */}
        <Card className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-text-muted" size={16} />
            <input
              className="glass-input pl-9"
              placeholder="Search by title or note..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select className="glass-input text-sm" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <select className="glass-input text-sm" value={filters.paymentMode} onChange={e => setFilters(f => ({ ...f, paymentMode: e.target.value }))}>
              <option value="">All modes</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="glass-input text-sm" value={filters.regret} onChange={e => setFilters(f => ({ ...f, regret: e.target.value }))}>
              {REGRET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="glass-input text-sm" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
              <option value="timeCostHours">Sort: Time Cost</option>
            </select>
          </div>
        </Card>

        {/* Bulk actions */}
        {selected.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-3 flex items-center justify-between border-vault-red">
            <span className="text-sm text-vault-text-secondary">{selected.length} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}><X size={14} /></Button>
              <Button variant="danger" size="sm" loading={bulkDeleteMutation.isPending} onClick={() => bulkDeleteMutation.mutate(selected)}>
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          </motion.div>
        )}

        {/* Stats summary */}
        {data && (
          <div className="flex items-center gap-3 text-xs text-vault-text-muted flex-wrap">
            <span>{data?.pagination?.total || 0} transactions</span>
            <span>•</span>
            <span>Total: <span className="text-vault-text-primary font-medium">{formatINR(data?.transactions?.reduce((s, t) => s + t.amount, 0) || 0)}</span></span>
            {activeMonthFilter !== 'all' && (
              <span style={{ color: '#4A4E65' }}>
                {activeMonthFilter === 'this_month' ? 'this month' :
                 activeMonthFilter === 'last_month' ? 'last month' : 'last 3 months'}
              </span>
            )}
            {activeMonthFilter === 'all' && (
              <span style={{ color: '#F5A623' }}>all time</span>
            )}
          </div>
        )}

        {/* Transaction list */}
        {isLoading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <TransactionSkeleton key={i} />)}</div>
        ) : !data?.transactions?.length ? (
          <Card className="text-center py-12">
            <p className="text-4xl mb-3">💸</p>
            <p className="text-vault-text-secondary">No transactions found</p>
            <p className="text-xs text-vault-text-muted mt-1">Try changing your filters or add a new transaction</p>
          </Card>
        ) : (
          <AnimatePresence>
            <div className="space-y-2">
              {(data?.transactions || []).map(t => {
                const meta = getCategoryIcon(t.category);
                const Icon = meta.icon;
                const isSelected = selected.includes(t._id);
                return (
                  <motion.div
                    key={t._id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 80, scale: 0.95 }}
                    className={`glass-card p-4 flex items-center gap-4 transition-all ${isSelected ? 'border-vault-amber' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(t._id)}
                      className="w-4 h-4 accent-amber-500 flex-shrink-0"
                    />
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                      <Icon size={18} style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-vault-text-primary truncate">{t.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs text-vault-text-muted">{format(new Date(t.date), 'MMM d, yyyy')}</span>
                        <span className="text-xs text-vault-text-muted">{t.paymentMode}</span>
                        {t.timeCostHours > 0 && <span className="text-xs text-vault-text-muted">{formatTimeCost(t.timeCostHours)} of work</span>}
                        {getFutureValueLabel(t.amount) && <span className="text-xs text-vault-text-muted">{getFutureValueLabel(t.amount)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="font-semibold text-vault-text-primary">{formatINR(t.amount)}</span>
                      <RegretBadge status={t.regretStatus} />
                    </div>

                    {/* Regret rate buttons — only for regular transactions */}
                    {t.regretStatus === 'pending' && !t.isGuiltyFreeSpend && !t.isCommitmentPayment && (
                      <div className="hidden md:flex gap-1 ml-2">
                        {[
                          { r: 'worth_it', label: '✓', cls: 'text-vault-teal hover:bg-[rgba(0,200,150,0.1)]' },
                          { r: 'okay', label: '~', cls: 'text-vault-amber hover:bg-[rgba(245,166,35,0.1)]' },
                          { r: 'regret', label: '✗', cls: 'text-vault-red hover:bg-[rgba(255,90,90,0.1)]' },
                        ].map(({ r, label, cls }) => (
                          <button
                            key={r}
                            onClick={() => rateMutation.mutate({ id: t._id, rating: r })}
                            className={`w-7 h-7 rounded-md text-sm font-bold transition-all ${cls}`}
                          >{label}</button>
                        ))}
                      </div>
                    )}
                    {t.isGuiltyFreeSpend && (
                      <div className="hidden md:flex ml-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-vault-teal/10 text-vault-teal px-2 py-1 rounded">Guilt-Free</span>
                      </div>
                    )}
                    {t.isCommitmentPayment && (
                      <div className="hidden md:flex ml-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-vault-blue/10 text-vault-blue px-2 py-1 rounded">Bill</span>
                      </div>
                    )}

                    {/* ↺ Repeat Button */}
                    <RepeatButton transaction={t} todayTitles={todayTitles} />

                    <button onClick={() => setEditTx(t)} className="p-1.5 hover:text-vault-amber text-vault-text-muted transition-all">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => deleteMutation.mutate(t._id)} className="p-1.5 hover:text-vault-red text-vault-text-muted transition-all">
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}

        {/* Pagination */}
        {data?.pagination?.pages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
            <span className="text-sm text-vault-text-muted self-center">Page {page} of {data?.pagination?.pages || 1}</span>
            <Button variant="secondary" size="sm" disabled={page === (data?.pagination?.pages || 1)} onClick={() => setPage(p => p + 1)}>Next →</Button>
          </div>
        )}
      </div>
      <AddTransactionModal isOpen={addOpen || !!editTx} onClose={() => { setAddOpen(false); setEditTx(null); }} editTx={editTx} />
    </PageWrapper>
  );
}
