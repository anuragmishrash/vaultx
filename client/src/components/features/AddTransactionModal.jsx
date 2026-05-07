import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { transactionsAPI, commitmentsAPI, patternsAPI, accountsAPI } from '../../api';
import Modal from '../ui/Modal';
import QuickTemplates from './QuickTemplates';
import { CATEGORIES, PAYMENT_MODES } from '../../constants/categories';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { autoDetectCategory } from '../../utils/categoryAutoDetect';

const schema = z.object({
  title: z.string().min(1, 'Title required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  category: z.string().min(1),
  paymentMode: z.string().min(1),
  date: z.string().min(1),
  note: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringLabel: z.string().optional(),
  isGuiltyFreeSpend: z.boolean().optional(),
  tags: z.string().optional(),
});

const getAccountEmoji = (type) => ({
  bank_account: '🏦',
  cash:         '💵',
  upi_wallet:   '📱',
  credit_card:  '💳',
  other:        '💰',
}[type] || '💰');

export default function AddTransactionModal({ isOpen, onClose, editTx }) {
  const qc = useQueryClient();
  const [brainMatch, setBrainMatch] = useState(null);
  const [memorySuggestions, setMemorySuggestions] = useState([]);
  const [autoFillApplied, setAutoFillApplied] = useState(false);
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const debounceRef = useRef(null);

  const { register, handleSubmit, watch, reset, setValue, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      category: 'Food & Dining',
      paymentMode: 'UPI',
      isRecurring: false,
      isGuiltyFreeSpend: false,
    }
  });

  const isRecurring = watch('isRecurring');
  const isGuiltyFree = watch('isGuiltyFreeSpend');
  const currentAmount = watch('amount');

  const handleClose = useCallback(() => {
    setBrainMatch(null);
    setMemorySuggestions([]);
    setAutoFillApplied(false);
    setCategoryManuallySet(false);
    setSelectedAccountId(null);
    clearTimeout(debounceRef.current);
    reset();
    onClose();
  }, [onClose, reset]);

  // Fetch accounts for the account picker
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsAPI.getAll().then(r => r.data.data || []),
    staleTime: 5 * 60 * 1000,
  });
  const accounts = accountsData || [];
  const defaultAccount = accounts.find(a => a.isDefault) || accounts[0];

  // Set default account when accounts load or modal opens
  useEffect(() => {
    if (defaultAccount && !selectedAccountId) {
      setSelectedAccountId(defaultAccount._id);
    }
  }, [defaultAccount]); // eslint-disable-line

  useEffect(() => {
    if (isOpen) {
      if (editTx) {
        setValue('title', editTx.title || '');
        setValue('amount', editTx.amount || '');
        setValue('category', editTx.category || 'Others');
        setValue('paymentMode', editTx.paymentMode || 'UPI');
        setValue('date', editTx.date ? format(new Date(editTx.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
        setValue('note', editTx.note || '');
        setValue('isRecurring', !!editTx.isRecurring);
        setValue('recurringLabel', editTx.recurringLabel || '');
        setValue('isGuiltyFreeSpend', !!editTx.isGuiltyFreeSpend);
        setValue('tags', editTx.tags?.join(', ') || '');
        setCategoryManuallySet(true);
      } else {
        // Reset all fields for new transaction
        reset({
          title: '',
          amount: '',
          category: 'Others',
          paymentMode: 'UPI',
          date: format(new Date(), 'yyyy-MM-dd'),
          note: '',
          isRecurring: false,
          recurringLabel: '',
          isGuiltyFreeSpend: false,
          isCashSpend: false,
          tags: ''
        });
        setCategoryManuallySet(false);
        setAutoFillApplied(false);
      }
    }
  }, [editTx, isOpen, setValue]);

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
        accountId: selectedAccountId || null,
      };
      if (editTx) {
        return transactionsAPI.update(editTx._id, payload);
      }
      return transactionsAPI.create(payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['commitment-logs'] });
      qc.invalidateQueries({ queryKey: ['waterfall'] });
      qc.invalidateQueries({ queryKey: ['zero-streak'] });
      qc.invalidateQueries({ queryKey: ['zero-logs'] });
      qc.invalidateQueries({ queryKey: ['batch-daily'] });
      qc.invalidateQueries({ queryKey: ['today-titles'] });
      qc.invalidateQueries({ queryKey: ['quick-templates'] });
      toast.success(editTx ? 'Transaction updated!' : 'Transaction added!');
      const match = res?.data?.commitmentMatch;
      if (match) {
        setBrainMatch(match);
      } else {
        reset();
        setAutoFillApplied(false);
        setCategoryManuallySet(false);
        setMemorySuggestions([]);
        handleClose();
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || `Failed to ${editTx ? 'update' : 'add'} transaction`),
  });

  const linkMutation = useMutation({
    mutationFn: ({ commitmentId, amount, transactionId }) =>
      commitmentsAPI.pay(commitmentId, { actualAmount: amount, linkedTransactionId: transactionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commitment-logs'] });
      qc.invalidateQueries({ queryKey: ['waterfall'] });
      toast.success('Linked to commitment & marked paid!');
      setBrainMatch(null);
      reset();
      handleClose();
    },
  });

  // ─── Memory-based auto-fill on title change ─────────────────
  const handleTitleChange = useCallback((e) => {
    const value = e.target.value;
    setAutoFillApplied(false);
    clearTimeout(debounceRef.current);

    if (value.trim().length < 1) {
      setMemorySuggestions([]);
      return;
    }

    // Check keyword detection immediately (no debounce needed — it's local)
    const detectedCategory = autoDetectCategory(value);
    if (detectedCategory && !categoryManuallySet && !isGuiltyFree) {
      setValue('category', detectedCategory);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await patternsAPI.searchMemory(value.trim());
        const mems = res.data.data || [];
        setMemorySuggestions(mems);

        // Auto-fill if strong match and user hasn't manually set category
        const strong = mems.find(m => m.normalizedTitle.startsWith(value.toLowerCase().trim()));
        if (strong && !categoryManuallySet && !isGuiltyFree) {
          const finalCategory = autoDetectCategory(value) || strong.category || 'Others';
          setValue('category', finalCategory);
          setValue('paymentMode', strong.paymentMode || 'UPI');
          if (!currentAmount) setValue('amount', strong.typicalAmount || '');
          setAutoFillApplied(true);
          setMemorySuggestions([]);
        }
      } catch { /* silent fail */ }
    }, 250);
  }, [categoryManuallySet, isGuiltyFree, currentAmount, setValue]);

  const applyMemory = useCallback((m) => {
    setValue('title', m.displayTitle || m.normalizedTitle);
    setValue('category', m.category || 'Others');
    setValue('paymentMode', m.paymentMode || 'UPI');
    if (!currentAmount) setValue('amount', m.typicalAmount || '');
    setAutoFillApplied(true);
    setMemorySuggestions([]);
  }, [currentAmount, setValue]);

  // ─── Quick template fill ────────────────────────────────────
  const applyTemplate = useCallback((template) => {
    setValue('title', template.title);
    setValue('amount', template.amount);
    setValue('category', template.category || 'Others');
    setValue('paymentMode', template.paymentMode || 'UPI');
    setAutoFillApplied(true);
    setMemorySuggestions([]);
  }, [setValue]);

  const { onChange: formTitleChange, ...restTitleReg } = register('title');

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={editTx ? "Edit Transaction" : "Add Transaction"} size="md">
      <form autoComplete="off" onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Quick Templates - Only show when adding */}
        {!editTx && <QuickTemplates onSelect={applyTemplate} />}

        {/* Title with memory dropdown */}
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Title</label>
          <input className="gi" placeholder="e.g., Zomato order" onChange={(e) => {
            formTitleChange(e);
            handleTitleChange(e);
          }} 
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
          name="vault-transaction-title" data-lpignore="true" data-form-type="other"
          {...restTitleReg} />
          {autoFillApplied && (
            <p style={{ fontFamily: 'Inter', fontSize: '11px', color: '#9B8AFB', margin: '4px 0 0' }}>
              ✦ Auto-filled from memory — edit if needed
            </p>
          )}
          {errors.title && <p style={{ fontSize: 12, color: '#FF5C5C', marginTop: 4 }}>{errors.title.message}</p>}

          {/* Memory dropdown */}
          {memorySuggestions.length > 0 && !autoFillApplied && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'rgba(10,11,24,0.98)', backdropFilter: 'blur(20px)',
              border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              marginTop: '4px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              {memorySuggestions.map((m, i) => (
                <div key={i}
                  onClick={() => applyMemory(m)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', cursor: 'pointer',
                    borderBottom: i < memorySuggestions.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <p style={{ fontFamily: 'Inter', fontSize: '13px', color: '#EAEDF5', margin: 0 }}>{m.displayTitle}</p>
                    <p style={{ fontFamily: 'Inter', fontSize: '11px', color: '#4A4E65', margin: '1px 0 0' }}>
                      {m.category} · {m.paymentMode}
                    </p>
                  </div>
                  <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '13px', color: '#9295A8' }}>
                    ₹{m.typicalAmount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#4A4E65', fontWeight: 500 }}>₹</span>
            <input type="number" step="0.01" className="gi" style={{ paddingLeft: 32 }} {...register('amount')} />
          </div>
          {errors.amount && <p style={{ fontSize: 12, color: '#FF5C5C', marginTop: 4 }}>{errors.amount.message}</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Category</label>
            <select className="gi" {...register('category')} disabled={isGuiltyFree} onChange={(e) => { setValue('category', e.target.value); setCategoryManuallySet(true); }}>
              {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Payment Mode</label>
            <select className="gi" {...register('paymentMode')}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Date</label>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <input 
                {...field} 
                type="date" 
                className="gi" 
                style={{ WebkitAppearance: 'none', colorScheme: 'dark' }} 
              />
            )}
          />
          {watch('date') && new Date(watch('date')) > new Date() && (
            <p style={{ fontFamily: 'Inter', fontSize: '11px', color: '#F5A623', margin: '5px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              ⚠ Future date — this transaction won't appear in this month's spending total until that date arrives.
            </p>
          )}
        </div>

        {/* Account Picker */}
        <div>
          <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Pay From Account</label>
          {accounts.length === 0 ? (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#4A4E65', margin: 0 }}>
                No accounts added — transaction will be logged without balance tracking.{' '}
                <a href="/my-money" style={{ color: '#F5A623', textDecoration: 'none' }}>Add an account →</a>
              </p>
            </div>
          ) : accounts.length === 1 ? (
            <div style={{
              padding: '10px 14px', borderRadius: 12,
              background: `${accounts[0].color}14`,
              border: `0.5px solid ${accounts[0].color}44`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>{getAccountEmoji(accounts[0].type)}</span>
              <div>
                <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 13, color: '#EAEDF5', margin: 0 }}>{accounts[0].name}</p>
                <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#9295A8', margin: 0 }}>₹{accounts[0].balance?.toLocaleString('en-IN')} available</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {accounts.map(account => {
                const isSelected = selectedAccountId === account._id?.toString() || selectedAccountId === account._id;
                return (
                  <div key={account._id}
                    onClick={() => setSelectedAccountId(account._id)}
                    style={{
                      padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                      background: isSelected ? `${account.color}14` : 'rgba(255,255,255,0.03)',
                      border: `0.5px solid ${isSelected ? `${account.color}44` : 'rgba(255,255,255,0.07)'}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 0.18s ease',
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: isSelected ? '#00C9A7' : 'rgba(255,255,255,0.07)',
                      border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#002820', fontWeight: 700,
                    }}>{isSelected ? '✓' : ''}</div>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{getAccountEmoji(account.type)}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 13, color: '#EAEDF5', margin: 0 }}>
                        {account.name}
                        {account.isDefault && <span style={{ fontFamily: 'Inter', fontSize: 10, color: '#4A4E65', fontWeight: 400, marginLeft: 6 }}>Default</span>}
                      </p>
                      <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#9295A8', margin: 0 }}>₹{account.balance?.toLocaleString('en-IN')} available</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Note (optional)</label>
          <input className="gi" placeholder="Add a note..." {...register('note')} />
        </div>

        <div>
          <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Tags (optional)</label>
          <input className="gi" placeholder="food, weekend, impulse" {...register('tags')} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" className="w-4 h-4 accent-amber-500" {...register('isRecurring')} />
            <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#9295A8' }}>Recurring subscription</span>
          </label>
          {isRecurring && (
            <div>
              <label style={{ display: 'block', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#9295A8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Subscription name</label>
              <input className="gi" placeholder="e.g., Netflix" {...register('recurringLabel')} />
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderRadius: '12px',
            background: isGuiltyFree ? 'rgba(0,201,167,0.07)' : 'rgba(255,255,255,0.02)',
            border: `0.5px solid ${isGuiltyFree ? 'rgba(0,201,167,0.25)' : 'rgba(255,255,255,0.07)'}`,
            cursor: 'pointer',
            marginBottom: '12px',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setValue('isGuiltyFreeSpend', !isGuiltyFree)}>
            <div>
              <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '13px', color: '#EAEDF5', margin: '0 0 2px' }}>
                Guilt-Free spend
              </p>
              <p style={{ fontFamily: 'Inter', fontSize: '11px', color: '#4A4E65', margin: 0 }}>
                {isGuiltyFree
                  ? 'Using your guilt-free allowance — no regret tracking'
                  : 'Regular transaction — will be tracked normally'}
              </p>
            </div>
            {/* Toggle switch */}
            <div style={{
              width: '40px', height: '22px', borderRadius: '100px', flexShrink: 0,
              background: isGuiltyFree ? '#00C9A7' : 'rgba(255,255,255,0.1)',
              position: 'relative', transition: 'background 0.2s ease',
            }}>
              <div style={{
                position: 'absolute', top: '3px',
                left: isGuiltyFree ? '21px' : '3px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: '#EAEDF5', transition: 'left 0.2s ease',
              }} />
            </div>
          </div>
        </div>

        {/* Brain Match Card */}
        {brainMatch && (
          <div style={{
            padding: 16, borderRadius: 14,
            background: 'rgba(139,122,255,0.1)',
            border: '0.5px solid rgba(139,122,255,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🧠</span>
              <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#EAEDF5' }}>Brain Match Found</span>
            </div>
            <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9295A8', marginBottom: 12, lineHeight: 1.5 }}>
              This looks like your <strong style={{ color: '#F5A623' }}>{brainMatch.commitmentTitle}</strong> commitment
              ({brainMatch.commitmentAmount ? `₹${brainMatch.commitmentAmount.toLocaleString('en-IN')}` : ''}).
              Link this transaction and mark it paid?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => linkMutation.mutate({
                  commitmentId: brainMatch.commitmentId,
                  amount: brainMatch.commitmentAmount,
                  transactionId: brainMatch.logId,
                })}
                className="btn-amber"
                style={{ flex: 1, padding: '10px 16px', fontSize: 13 }}
              >
                {linkMutation.isPending ? 'Linking...' : 'Yes, link it ✓'}
              </button>
              <button
                type="button"
                onClick={() => { setBrainMatch(null); reset(); handleClose(); }}
                className="btn-ghost"
                style={{ flex: 1, padding: '10px 16px', fontSize: 13 }}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          <button type="button" onClick={() => { setBrainMatch(null); handleClose(); }} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button type="submit" className="btn-amber" disabled={mutation.isPending} style={{ flex: 1, opacity: mutation.isPending ? 0.7 : 1 }}>
            {mutation.isPending ? (editTx ? 'Updating...' : 'Adding...') : (editTx ? 'Save Changes' : 'Add Transaction')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
