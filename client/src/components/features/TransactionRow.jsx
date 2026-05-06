import { useState, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { formatTimeCost } from '../../utils/timeCostHelpers';
import { getFutureValueLabel } from '../../utils/futureValueHelpers';

const REGRET_CONFIG = {
  worth_it: { label: '✓ Worth It', bg: 'rgba(0,201,167,0.15)', border: 'rgba(0,201,167,0.35)', color: '#00C9A7' },
  okay:     { label: '~ Okay',    bg: 'rgba(245,166,35,0.15)', border: 'rgba(245,166,35,0.35)', color: '#F5A623' },
  regret:   { label: '✗ Regret', bg: 'rgba(255,92,92,0.15)',  border: 'rgba(255,92,92,0.35)',  color: '#FF5C5C' },
};

import SwipeableCard from './SwipeableCard';

const TransactionRow = memo(function TransactionRow({
  transaction,
  onEdit,
  onDelete,
  onRate,
  onRepeat,
  alreadyAddedToday,
  isSelected,
  onToggleSelect
}) {
  const isMobile = useIsMobile();
  const { icon: Icon, color, bg } = getCategoryIcon(transaction.category);
  const timeCost = transaction.timeCostHours ? formatTimeCost(transaction.timeCostHours) : null;
  const futureVal = getFutureValueLabel(transaction.amount);
  const regretCfg = REGRET_CONFIG[transaction.regretStatus];

  const showRegretButtons =
    !transaction.isCommitmentPayment &&
    !transaction.isGuiltyFreeSpend &&
    !transaction.isATMWithdrawal &&
    transaction.regretStatus === 'pending' &&
    (Date.now() - new Date(transaction.date)) > 24 * 60 * 60 * 1000;

  // ── MOBILE CARD LAYOUT ──────────────────────────────────────
  if (isMobile) {
    return (
      <SwipeableCard onDelete={() => onDelete?.(transaction._id)} onRepeat={() => onRepeat?.(transaction)}>
        <div style={{
          background: 'rgba(255,255,255,0.035)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '14px 14px 12px',
          marginBottom: '10px',
          position: 'relative',
          overflow: 'hidden',
          // Left border accent by regret status
          borderLeft: `3px solid ${
            transaction.regretStatus === 'worth_it' ? '#00C9A7' :
            transaction.regretStatus === 'regret'   ? '#FF5C5C' :
            transaction.regretStatus === 'okay'     ? '#F5A623' :
            'rgba(255,255,255,0.12)'
          }`,
        }}>

          {/* ── ZONE 1: Top row — Icon + Title + Amount ── */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            marginBottom: '10px',
          }}>
            {/* Category icon */}
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={16} color={color} />
            </div>

            {/* Title + date + meta — takes all remaining space */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <p style={{
                fontFamily: 'Outfit', fontWeight: 600, fontSize: '15px',
                color: '#EAEDF5', margin: '0 0 2px',
                // Full title, never truncate on mobile
                whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.25,
              }}>
                {transaction.title}
              </p>
              <p style={{
                fontFamily: 'Inter', fontSize: '12px', color: '#9295A8',
                margin: '0 0 2px',
              }}>
                {new Date(transaction.date).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
                {' · '}{transaction.paymentMode}
              </p>
              {/* Time cost — only if meaningful */}
              {timeCost && (
                <p style={{ fontFamily: 'Inter', fontSize: '11px', color: '#4A4E65', margin: 0 }}>
                  {timeCost} of work{futureVal ? ` · ${futureVal}` : ''}
                </p>
              )}
            </div>

            {/* Amount — fixed width, right-aligned, never pushed off screen */}
            <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '60px' }}>
              <p style={{
                fontFamily: 'Outfit', fontWeight: 700, fontSize: '17px',
                color: '#EAEDF5', margin: '0 0 4px',
              }}>
                ₹{transaction.amount?.toLocaleString('en-IN')}
              </p>
              {/* Type badge — only one badge, never stacked */}
              {transaction.isGuiltyFreeSpend ? (
                <span style={{
                  display: 'inline-block', fontSize: '10px', fontFamily: 'Inter',
                  fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                  background: 'rgba(0,201,167,0.12)', color: '#00C9A7',
                  border: '0.5px solid rgba(0,201,167,0.25)',
                  whiteSpace: 'nowrap',
                }}>
                  Guilt-Free
                </span>
              ) : transaction.isCommitmentPayment ? (
                <span style={{
                  display: 'inline-block', fontSize: '10px', fontFamily: 'Inter',
                  fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                  background: 'rgba(78,159,255,0.12)', color: '#5BA4F5',
                  border: '0.5px solid rgba(78,159,255,0.25)',
                  whiteSpace: 'nowrap',
                }}>
                  Bill
                </span>
              ) : null}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', marginBottom: '10px' }} />

          {/* ── ZONE 2: Bottom row — Regret status + Actions ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}>
            {/* Left: regret badge or rate buttons */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {showRegretButtons ? (
                // Pending: show 3 rating buttons
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => onRate(transaction._id, 'worth_it')}
                    style={{ padding: '7px 12px', borderRadius: '8px', fontFamily: 'Inter', fontSize: '12px', fontWeight: 600, background: 'rgba(0,201,167,0.12)', border: '0.5px solid rgba(0,201,167,0.3)', color: '#00C9A7', cursor: 'pointer', minHeight: '34px' }}>
                    ✓ Worth
                  </button>
                  <button onClick={() => onRate(transaction._id, 'okay')}
                    style={{ padding: '7px 10px', borderRadius: '8px', fontFamily: 'Inter', fontSize: '12px', fontWeight: 600, background: 'rgba(245,166,35,0.1)', border: '0.5px solid rgba(245,166,35,0.3)', color: '#F5A623', cursor: 'pointer', minHeight: '34px' }}>
                    ~ Ok
                  </button>
                  <button onClick={() => onRate(transaction._id, 'regret')}
                    style={{ padding: '7px 10px', borderRadius: '8px', fontFamily: 'Inter', fontSize: '12px', fontWeight: 600, background: 'rgba(255,92,92,0.1)', border: '0.5px solid rgba(255,92,92,0.3)', color: '#FF5C5C', cursor: 'pointer', minHeight: '34px' }}>
                    ✗ Reg
                  </button>
                </div>
              ) : (
                // Already rated: show badge
                <span style={{
                  display: 'inline-block', padding: '6px 14px', borderRadius: '100px',
                  background: REGRET_CONFIG[transaction.regretStatus]?.bg || 'transparent',
                  border: `0.5px solid ${REGRET_CONFIG[transaction.regretStatus]?.border || 'transparent'}`,
                  color: REGRET_CONFIG[transaction.regretStatus]?.color || '#9295A8',
                  fontFamily: 'Inter', fontSize: '12px', fontWeight: 600,
                }}>
                  {REGRET_CONFIG[transaction.regretStatus]?.label || ''}
                </span>
              )}
            </div>

            {/* Right: 3 icon action buttons — fixed, never overlap */}
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {/* Repeat */}
              <button onClick={() => onRepeat?.(transaction)}
                style={{
                  width: '34px', height: '34px', borderRadius: '9px',
                  background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', color: '#9295A8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', flexShrink: 0,
                }}>
                ↺
              </button>
              {/* Edit */}
              <button onClick={() => onEdit?.(transaction)}
                style={{
                  width: '34px', height: '34px', borderRadius: '9px',
                  background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', color: '#9295A8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                <Pencil size={14} />
              </button>
              {/* Delete */}
              <button onClick={() => onDelete?.(transaction._id)}
                style={{
                  width: '34px', height: '34px', borderRadius: '9px',
                  background: 'rgba(255,92,92,0.08)', border: '0.5px solid rgba(255,92,92,0.2)',
                  cursor: 'pointer', color: '#FF5C5C',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </SwipeableCard>
    );
  }

  // ── DESKTOP ROW LAYOUT ──────────────────────────────────────
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 80, scale: 0.95 }}
      className={`glass-card gc ${isSelected ? 'border-vault-amber' : ''}`}
      style={{
        padding: '14px 18px', marginBottom: '8px',
        display: 'flex', alignItems: 'center', gap: '14px',
        border: isSelected ? '1px solid #F5A623' : undefined
      }}>
      
      {/* Checkbox for Desktop Only */}
      {onToggleSelect && (
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onToggleSelect(transaction._id)}
          style={{ flexShrink: 0, width: '16px', height: '16px', cursor: 'pointer', accentColor: '#F5A623' }} 
        />
      )}

      {/* Category icon */}
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} color={color} />
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '14px', color: '#EAEDF5', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {transaction.title}
        </p>
        <p style={{ fontFamily: 'Inter', fontSize: '11px', color: '#4A4E65', margin: 0 }}>
          {new Date(transaction.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' · '}{transaction.paymentMode}
          {timeCost && <> · {timeCost} of work</>}
          {futureVal && <> · {futureVal}</>}
        </p>
      </div>

      {/* Amount */}
      <p style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '15px', color: '#EAEDF5', margin: 0, flexShrink: 0 }}>
        ₹{transaction.amount?.toLocaleString('en-IN')}
      </p>

      {/* Regret status / rating */}
      <div style={{ flexShrink: 0 }}>
        {showRegretButtons ? (
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => onRate(transaction._id, 'worth_it')} style={{ background: 'rgba(0,201,167,0.1)', border: '0.5px solid rgba(0,201,167,0.3)', borderRadius: '6px', padding: '4px 8px', color: '#00C9A7', cursor: 'pointer', fontSize: '13px' }}>✓</button>
            <button onClick={() => onRate(transaction._id, 'okay')}     style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 8px', color: '#9295A8', cursor: 'pointer', fontSize: '13px' }}>~</button>
            <button onClick={() => onRate(transaction._id, 'regret')}   style={{ background: 'rgba(255,92,92,0.1)', border: '0.5px solid rgba(255,92,92,0.3)', borderRadius: '6px', padding: '4px 8px', color: '#FF5C5C', cursor: 'pointer', fontSize: '13px' }}>✗</button>
          </div>
        ) : regretCfg ? (
          <span style={{ padding: '3px 10px', borderRadius: '100px', background: regretCfg.bg, border: `0.5px solid ${regretCfg.border}`, color: regretCfg.color, fontFamily: 'Inter', fontSize: '11px', fontWeight: 600 }}>
            {regretCfg.label}
          </span>
        ) : transaction.isGuiltyFreeSpend ? (
          <span style={{ padding: '3px 10px', borderRadius: '100px', background: 'rgba(0,201,167,0.12)', border: '0.5px solid rgba(0,201,167,0.25)', color: '#00C9A7', fontFamily: 'Inter', fontSize: '11px', fontWeight: 600 }}>Guilt-Free</span>
        ) : transaction.isCommitmentPayment ? (
          <span style={{ padding: '3px 10px', borderRadius: '100px', background: 'rgba(78,159,255,0.12)', border: '0.5px solid rgba(78,159,255,0.25)', color: '#5BA4F5', fontFamily: 'Inter', fontSize: '11px', fontWeight: 600 }}>Bill</span>
        ) : null}
      </div>

      {/* Action buttons — desktop only */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {onRepeat && (
          <button onClick={() => onRepeat(transaction)} style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '5px 9px', cursor: 'pointer', color: '#9295A8', fontSize: '13px' }}>↺</button>
        )}
        <button onClick={() => onEdit?.(transaction)}   style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '5px 8px', cursor: 'pointer', color: '#9295A8', display: 'flex', alignItems: 'center' }}><Pencil size={13} /></button>
        <button onClick={() => onDelete?.(transaction._id)} style={{ background: 'rgba(255,92,92,0.08)', border: '0.5px solid rgba(255,92,92,0.2)', borderRadius: '7px', padding: '5px 8px', cursor: 'pointer', color: '#FF5C5C', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return prevProps.transaction._id === nextProps.transaction._id &&
         prevProps.transaction.regretStatus === nextProps.transaction.regretStatus &&
         prevProps.transaction.amount === nextProps.transaction.amount &&
         prevProps.isSelected === nextProps.isSelected;
});

export default TransactionRow;
