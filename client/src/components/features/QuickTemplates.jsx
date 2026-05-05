import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { patternsAPI } from '../../api';

const EMOJI_MAP = {
  'Food & Dining': '🍱', 'Groceries': '🛒', 'Transport': '🚗',
  'Health & Fitness': '💪', 'Entertainment': '🎬', 'Shopping': '🛍',
  'Utilities': '⚡', 'Housing': '🏠', 'Mobile/Telecom': '📱',
  'Education': '📚', 'Personal Care': '🧴', 'Guilt-Free': '🎁', 'Others': '📦',
};

export default function QuickTemplates({ onSelect }) {
  const { data: templates = [] } = useQuery({
    queryKey: ['quick-templates'],
    queryFn: () => patternsAPI.getTemplates().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  if (templates.length === 0) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{
        fontFamily: 'Inter', fontSize: '11px', fontWeight: 500,
        color: '#9295A8', letterSpacing: '0.06em',
        textTransform: 'uppercase', margin: '0 0 8px',
      }}>
        Quick Add
      </p>
      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
        {templates.map(t => (
          <motion.button key={t._id}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => onSelect(t)}
            style={{
              background: t.isPinned ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.05)',
              border: t.isPinned ? '0.5px solid rgba(245,166,35,0.28)' : '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '100px', padding: '7px 14px',
              fontFamily: 'Inter', fontSize: '13px', fontWeight: 500,
              color: t.isPinned ? '#F5A623' : '#EAEDF5',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.15s ease',
            }}>
            <span style={{ fontSize: '14px' }}>{EMOJI_MAP[t.category] || '📦'}</span>
            <span>{t.title}</span>
            <span style={{ color: '#4A4E65', fontSize: '12px' }}>₹{t.amount}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
