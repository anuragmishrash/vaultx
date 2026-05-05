import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patternsAPI } from '../../api';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { getCategoryIcon } from '../../utils/categoryIcons';

export default function BatchDailyAdd({ onAdded }) {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState({});
  const [amounts, setAmounts] = useState({});

  const { data: batch, isLoading } = useQuery({
    queryKey: ['batch-daily'],
    queryFn: () => patternsAPI.getBatch().then(r => r.data.data),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      const items = batch?.transactionItems || [];
      const patternIds = items
        .map(i => i.patternId?.toString())
        .filter(id => selected[id] !== false);
      if (patternIds.length === 0) return Promise.resolve({ data: { data: [] } });
      return patternsAPI.batchConfirm({ patternIds, amounts });
    },
    onSuccess: (res) => {
      const count = res?.data?.data?.length || 0;
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['batch-daily'] });
      qc.invalidateQueries({ queryKey: ['today-titles'] });
      qc.invalidateQueries({ queryKey: ['zero-streak'] });
      qc.invalidateQueries({ queryKey: ['zero-logs'] });
      setIsOpen(false);
      setSelected({});
      setAmounts({});
      if (count > 0) {
        toast.success(`${count} item${count > 1 ? 's' : ''} added ✓`);
        onAdded?.();
      }
    },
    onError: () => toast.error('Could not add items — try again'),
  });

  const items = batch?.transactionItems || [];
  if (isLoading || items.length === 0) return null;

  const selectedCount = items.filter(i => selected[i.patternId?.toString()] !== false).length;
  const totalAmount = items
    .filter(i => selected[i.patternId?.toString()] !== false)
    .reduce((s, i) => s + (amounts[i.patternId?.toString()] ?? i.amount), 0);

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.998 }}
        onClick={() => setIsOpen(true)}
        style={{
          width: '100%', padding: '12px 16px', marginBottom: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,201,167,0.05)',
          border: '0.5px solid rgba(0,201,167,0.22)',
          borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>⚡</span>
          <div>
            <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '13px', color: '#EAEDF5', margin: 0 }}>
              Add today's {items.length === 1 ? 'usual item' : `${items.length} usual items`}
            </p>
            <p style={{ fontFamily: 'Inter', fontSize: '11px', color: '#4A4E65', margin: '1px 0 0' }}>
              {items.map(i => i.title).join(' · ')} · ₹{batch?.totalAmount || 0} total
            </p>
          </div>
        </div>
        <span style={{ color: '#00C9A7', fontSize: '12px', fontFamily: 'Inter', fontWeight: 600, flexShrink: 0 }}>
          Review →
        </span>
      </motion.button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`Today's ${items.length === 1 ? 'usual item' : 'daily items'}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
          {items.map(item => {
            const id = item.patternId?.toString();
            const isChecked = selected[id] !== false;
            const { icon: Icon, color, bg } = getCategoryIcon(item.category);

            return (
              <div key={id}
                onClick={() => setSelected(p => ({ ...p, [id]: !isChecked }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                  background: isChecked ? 'rgba(0,201,167,0.07)' : 'rgba(255,255,255,0.02)',
                  border: `0.5px solid ${isChecked ? 'rgba(0,201,167,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.18s ease', userSelect: 'none',
                }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  background: isChecked ? 'linear-gradient(135deg,#00C9A7,#009B82)' : 'rgba(255,255,255,0.07)',
                  border: isChecked ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', color: '#002820', fontWeight: 700, transition: 'all 0.18s ease',
                }}>
                  {isChecked ? '✓' : ''}
                </div>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color={color} />
                </div>
                <span style={{ fontFamily: 'Inter', fontSize: '13px', color: '#EAEDF5', flex: 1 }}>
                  {item.title}
                  {item.frequency !== 'daily' && <span style={{ color: '#4A4E65', fontSize: '11px', marginLeft: '6px' }}>weekly</span>}
                </span>
                <input
                  type="number"
                  value={amounts[id] ?? item.amount}
                  onChange={e => { e.stopPropagation(); setAmounts(p => ({ ...p, [id]: parseFloat(e.target.value) || item.amount })); }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '72px', textAlign: 'right',
                    background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', padding: '6px 8px',
                    color: '#EAEDF5', fontFamily: 'Outfit', fontWeight: 600, fontSize: '13px', outline: 'none',
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '0.5px solid rgba(255,255,255,0.07)', marginBottom: '14px' }}>
          <span style={{ fontFamily: 'Inter', fontSize: '13px', color: '#9295A8' }}>
            {selectedCount} of {items.length} selected
          </span>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '14px', color: '#EAEDF5' }}>
            ₹{totalAmount.toLocaleString('en-IN')}
          </span>
        </div>

        <button
          className="btn-amber"
          onClick={() => confirmMutation.mutate()}
          disabled={confirmMutation.isPending || selectedCount === 0}
          style={{ width: '100%', justifyContent: 'center', padding: '13px', opacity: selectedCount === 0 ? 0.5 : 1 }}>
          {confirmMutation.isPending ? 'Adding...' : `Add ${selectedCount} item${selectedCount !== 1 ? 's' : ''} ✓`}
        </button>
      </Modal>
    </>
  );
}
