import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsAPI } from '../../api';
import toast from 'react-hot-toast';

export default function RepeatButton({ transaction, todayTitles }) {
  const qc = useQueryClient();

  // Never show on today's transactions
  const isToday = new Date(transaction.date).toDateString() === new Date().toDateString();
  if (isToday) return null;

  // Never show on commitment payments or ATM withdrawals
  if (transaction.isCommitmentPayment || transaction.isATMWithdrawal) return null;

  const normalized = transaction.normalizedTitle || transaction.title?.toLowerCase().trim();
  const alreadyAddedToday = todayTitles?.has(normalized);

  const repeatMutation = useMutation({
    mutationFn: () => transactionsAPI.create({
      title: transaction.title,
      amount: transaction.amount,
      category: transaction.category,
      paymentMode: transaction.paymentMode,
      date: new Date().toISOString(),
      normalizedTitle: normalized,
      isGuiltyFreeSpend: transaction.isGuiltyFreeSpend || false,
      regretStatus: transaction.isGuiltyFreeSpend ? 'worth_it' : 'pending',
      note: `Repeated from ${new Date(transaction.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['batch-daily'] });
      qc.invalidateQueries({ queryKey: ['today-titles'] });
      qc.invalidateQueries({ queryKey: ['zero-streak'] });
      qc.invalidateQueries({ queryKey: ['zero-logs'] });
      toast.success(`${transaction.title} added ✓`);
    },
    onError: () => toast.error('Could not repeat — try again'),
  });

  if (alreadyAddedToday) {
    return (
      <span style={{
        fontSize: '10px', fontFamily: 'Inter', fontWeight: 500,
        color: '#00C9A7', padding: '4px 8px', borderRadius: '6px',
        background: 'rgba(0,201,167,0.1)', border: '0.5px solid rgba(0,201,167,0.2)',
        whiteSpace: 'nowrap',
      }}>
        Added ✓
      </span>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.1, color: '#9B8AFB' }}
      whileTap={{ scale: 0.92 }}
      onClick={(e) => { e.stopPropagation(); repeatMutation.mutate(); }}
      disabled={repeatMutation.isPending}
      title={`Add ${transaction.title} again today`}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: '7px', padding: '5px 9px',
        cursor: repeatMutation.isPending ? 'wait' : 'pointer',
        color: repeatMutation.isPending ? '#4A4E65' : '#9295A8',
        fontSize: '13px', lineHeight: 1,
        transition: 'all 0.15s ease',
      }}>
      {repeatMutation.isPending ? '...' : '↺'}
    </motion.button>
  );
}
