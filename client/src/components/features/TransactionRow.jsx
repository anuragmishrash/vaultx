import { useState, useRef } from 'react';
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

function SwipeableCard({ onDelete, onRepeat, children }) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const THRESHOLD = 80;

  const handleTouchStart = e => { startX.current = e.touches[0].clientX; };
  const handleTouchMove  = e => {
    const dx = e.touches[0].clientX - startX.current;
    setSwipeX(Math.max(-120, Math.min(60, dx)));
  };
  const handleTouchEnd = () => {
    if (swipeX < -THRESHOLD) { if (onDelete) onDelete(); }
    else if (swipeX > THRESHOLD) { if (onRepeat) onRepeat(); }
    setSwipeX(0);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px', marginBottom: '10px' }}>
      {/* Background actions */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
        <div style={{ color: '#9B8AFB', fontFamily: 'Inter', fontSize: '12px', fontWeight: 600 }}>↺ Repeat</div>
        <div style={{ color: '#FF5C5C', fontFamily: 'Inter', fontSize: '12px', fontWeight: 600 }}>Delete ✕</div>
      </div>
      {/* Card — translates on swipe */}
      <motion.div
        style={{ x: swipeX, position: 'relative', zIndex: 1 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        animate={{ x: swipeX }}
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
        {children}
      </motion.div>
    </div>
  );
}

export default function TransactionRow({
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`txn-card-mobile ${transaction.regretStatus || 'pending'}`}
          style={{ position: 'relative', marginBottom: 0 }}
        >
          {/* Row 1: Icon + Title + Amount */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
            {/* Category icon */}
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={17} color={color} />
            </div>

            {/* Title + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'Outfit', fontWeight: 600, fontSize: '15px',
                color: '#EAEDF5', margin: '0 0 3px',
                wordBreak: 'break-word', lineHeight: 1.3,
              }}>
                {transaction.title}
              </p>
              <p style={{ fontFamily: 'Inter', fontSize: '12px', color: '#9295A8', margin: 0 }}>
                {new Date(transaction.date).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
                {' · '}{transaction.paymentMode}
              </p>
              {(timeCost || futureVal) && (
                <p style={{ fontFamily: 'Inter', fontSize: '11px', color: '#4A4E65', margin: '3px 0 0' }}>
                  {timeCost && <span>{timeCost} of work</span>}
                  {timeCost && futureVal && <span> · </span>}
                  {futureVal && <span>{futureVal}</span>}
                </p>
              )}
            </div>

            {/* Amount */}
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <p style={{
                fontFamily: 'Outfit', fontWeight: 700, fontSize: '17px',
                color: '#EAEDF5', margin: 0,
              }}>
                ₹{transaction.amount?.toLocaleString('en-IN')}
              </p>
              {transaction.isGuiltyFreeSpend && (
                <span style={{ fontSize: '10px', background: 'rgba(0,201,167,0.12)', color: '#00C9A7', padding: '2px 7px', borderRadius: '100px', fontFamily: 'Inter', fontWeight: 600 }}>
                  Guilt-Free
                </span>
              )}
              {transaction.isCommitmentPayment && (
                <span style={{ fontSize: '10px', background: 'rgba(78,159,255,0.12)', color: '#5BA4F5', padding: '2px 7px', borderRadius: '100px', fontFamily: 'Inter', fontWeight: 600 }}>
                  Bill
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Regret status + Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
            <div style={{ flex: 1 }}>
              {showRegretButtons ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['worth_it', 'okay', 'regret'].map(r => (
                    <button key={r}
                      onClick={() => onRate(transaction._id, r)}
                      style={{
                        padding: '6px 10px', borderRadius: '8px',
                        fontFamily: 'Inter', fontSize: '12px', fontWeight: 500,
                        background: REGRET_CONFIG[r].bg, border: `0.5px solid ${REGRET_CONFIG[r].border}`,
                        color: REGRET_CONFIG[r].color, cursor: 'pointer', minHeight: '36px',
                      }}>
                      {r === 'worth_it' ? '✓' : r === 'okay' ? '~' : '✗'}
                    </button>
                  ))}
                  <span style={{ fontFamily: 'Inter', fontSize: '11px', color: '#4A4E65', alignSelf: 'center' }}>Rate it</span>
                </div>
              ) : regretCfg ? (
                <span style={{
                  display: 'inline-block', padding: '5px 12px', borderRadius: '100px',
                  background: regretCfg.bg, border: `0.5px solid ${regretCfg.border}`,
                  color: regretCfg.color, fontFamily: 'Inter', fontSize: '12px', fontWeight: 600,
                }}>
                  {regretCfg.label}
                </span>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {!new Date(transaction.date).toDateString() === new Date().toDateString() && (
                <button
                  onClick={() => onRepeat?.(transaction)}
                  className="touch-sm"
                  style={{
                    background: alreadyAddedToday ? 'rgba(0,201,167,0.1)' : 'rgba(255,255,255,0.06)',
                    border: `0.5px solid ${alreadyAddedToday ? 'rgba(0,201,167,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px', padding: '8px', cursor: 'pointer',
                    color: alreadyAddedToday ? '#00C9A7' : '#9295A8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {alreadyAddedToday ? <span style={{ fontSize: '10px', fontWeight: 600 }}>✓</span> : <RotateCcw size={14} />}
                </button>
              )}
              <button
                onClick={() => onEdit?.(transaction)}
                className="touch-sm"
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#9295A8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete?.(transaction._id)}
                className="touch-sm"
                style={{
                  background: 'rgba(255,92,92,0.08)', border: '0.5px solid rgba(255,92,92,0.2)',
                  borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#FF5C5C',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </motion.div>
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
}
