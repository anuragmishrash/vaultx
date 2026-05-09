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

import MobilePage from '../components/layout/MobilePage';
import TransactionRow from '../components/features/TransactionRow';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

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

  usePullToRefresh(() => qc.invalidateQueries({ queryKey: ['transactions'] }));

  const repeatMutation = useMutation({
    mutationFn: (transaction) => {
      const normalized = transaction.normalizedTitle || transaction.title?.toLowerCase().trim();
      return transactionsAPI.create({
        title: transaction.title,
        amount: transaction.amount,
        category: transaction.category,
        paymentMode: transaction.paymentMode,
        date: new Date().toISOString(),
        normalizedTitle: normalized,
        isGuiltyFreeSpend: transaction.isGuiltyFreeSpend || false,
        regretStatus: transaction.isGuiltyFreeSpend ? 'worth_it' : 'pending',
        note: `Repeated from ${new Date(transaction.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      });
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['batch-daily'] });
      qc.invalidateQueries({ queryKey: ['today-titles'] });
      qc.invalidateQueries({ queryKey: ['zero-streak'] });
      qc.invalidateQueries({ queryKey: ['zero-logs'] });
      toast.success(`${v.title} added ✓`);
    },
    onError: () => toast.error('Could not repeat — try again'),
  });
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
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await transactionsAPI.getAll({
        startDate: todayStr,
        endDate:   todayStr,
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
    <MobilePage title="Transactions" headerRight={<Button size="sm" onClick={() => setAddOpen(true)}>+ Add</Button>}>
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

        <div className="hidden md:flex items-center justify-between">
          <h1 className="font-display font-bold text-2xl text-vault-text-primary">Transactions</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={exportCSV}><Download size={14} /> Export</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>+ Add</Button>
          </div>
        </div>

        {/* Quick Tabs */}
        <div className="pill-row" style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          padding: '4px 2px 8px',
          marginBottom: '8px',
          flexWrap: 'nowrap',
        }}>
          {['All', 'UPI', 'Card', 'Cash', 'ATM Withdrawal'].map(tab => {
            const isActive = tab === 'All' ? !filters.paymentMode : filters.paymentMode === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilters(f => ({ ...f, paymentMode: tab === 'All' ? '' : tab }))}
                style={{
                  flexShrink: 0,
                  padding: '8px 16px',
                  borderRadius: '100px',
                  fontFamily: 'Inter',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  background: isActive
                    ? 'linear-gradient(135deg,rgba(245,166,35,0.2),rgba(245,166,35,0.08))'
                    : 'rgba(255,255,255,0.05)',
                  border: isActive
                    ? '0.5px solid rgba(245,166,35,0.4)'
                    : '0.5px solid rgba(255,255,255,0.1)',
                  color: isActive ? '#F5A623' : '#9295A8',
                  minHeight: '36px',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Month filter tabs */}
        <div className="pill-row" style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          padding: '2px 2px 10px',
          flexWrap: 'nowrap',
          marginBottom: '4px',
        }}>
          {MONTH_FILTERS.map(f => (
            <button key={f.value}
              onClick={() => applyMonthFilter(f.value)}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                borderRadius: '100px',
                fontFamily: 'Inter',
                fontSize: '13px',
                fontWeight: activeMonthFilter === f.value ? 600 : 400,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                background: activeMonthFilter === f.value
                  ? 'rgba(139,122,255,0.15)'
                  : 'rgba(255,255,255,0.04)',
                border: activeMonthFilter === f.value
                  ? '0.5px solid rgba(139,122,255,0.35)'
                  : '0.5px solid rgba(255,255,255,0.08)',
                color: activeMonthFilter === f.value ? '#9B8AFB' : '#9295A8',
                minHeight: '36px',
              }}>
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
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px', flexWrap:'wrap' }}>
            {/* Transaction count */}
            <span style={{ fontFamily:'Inter', fontSize:'13px', color:'#9295A8' }}>
              {data?.pagination?.total || 0} transaction{(data?.pagination?.total !== 1) ? 's' : ''}
            </span>

            <span style={{ color:'#2E3047' }}>·</span>

            {/* Regular spend — all personal spending (variable + guilt-free) */}
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ fontFamily:'Inter', fontSize:'12px', color:'#9295A8' }}>Regular:</span>
              <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:'14px', color:'#EAEDF5' }}>
                ₹{((data?.summary?.variableTotal ?? 0) + (data?.summary?.guiltyFreeTotal ?? 0)).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Bills paid — separate pill */}
            {(data?.summary?.billsPaidTotal ?? 0) > 0 && (
              <div style={{
                display:'flex', alignItems:'center', gap:'4px',
                padding:'3px 10px', borderRadius:'100px',
                background:'rgba(78,159,255,0.1)',
                border:'0.5px solid rgba(78,159,255,0.25)',
              }}>
                <span style={{ fontFamily:'Inter', fontSize:'11px', color:'#5BA4F5' }}>Bills:</span>
                <span style={{ fontFamily:'Outfit', fontWeight:600, fontSize:'12px', color:'#5BA4F5' }}>
                  ₹{(data?.summary?.billsPaidTotal ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {/* Guilt-free — separate pill */}
            {(data?.summary?.guiltyFreeTotal ?? 0) > 0 && (
              <div style={{
                display:'flex', alignItems:'center', gap:'4px',
                padding:'3px 10px', borderRadius:'100px',
                background:'rgba(0,201,167,0.1)',
                border:'0.5px solid rgba(0,201,167,0.25)',
              }}>
                <span style={{ fontFamily:'Inter', fontSize:'11px', color:'#00C9A7' }}>Guilt-free:</span>
                <span style={{ fontFamily:'Outfit', fontWeight:600, fontSize:'12px', color:'#00C9A7' }}>
                  ₹{(data?.summary?.guiltyFreeTotal ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {/* Period context */}
            {activeMonthFilter !== 'all' && (
              <span style={{ fontFamily:'Inter', fontSize:'11px', color:'#4A4E65' }}>
                {activeMonthFilter.replace('_', ' ')}
              </span>
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
                const normalized = t.normalizedTitle || t.title?.toLowerCase().trim();
                const alreadyAddedToday = todayTitles?.has(normalized);

                return (
                  <TransactionRow
                    key={t._id}
                    transaction={t}
                    onEdit={setEditTx}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onRate={(id, rating) => rateMutation.mutate({ id, rating })}
                    onRepeat={repeatMutation.mutate}
                    alreadyAddedToday={alreadyAddedToday}
                    isSelected={selected.includes(t._id)}
                    onToggleSelect={toggleSelect}
                  />
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
    </MobilePage>
  );
}
