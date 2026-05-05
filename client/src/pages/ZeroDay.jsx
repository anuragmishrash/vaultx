import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { zeroDayAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import { CardSkeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/formatCurrency';
import { Zap, Flame, Trophy, Star } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

const LEVELS = [
  { min: 0, max: 3, label: 'Beginner', color: '#8A8FA8', icon: '🌱' },
  { min: 4, max: 7, label: 'Committed', color: '#4E9FFF', icon: '💪' },
  { min: 8, max: 14, label: 'Iron Will', color: '#8B7CF6', icon: '⚡' },
  { min: 15, max: Infinity, label: 'Vault Master', color: '#F5A623', icon: '👑' },
];

export default function ZeroDay() {
  const { user } = useAuthStore();
  const now = new Date();

  const { data: streakData, isLoading: streakLoading } = useQuery({
    queryKey: ['zero-streak'],
    queryFn: () => zeroDayAPI.getStreak().then(r => r.data),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['zero-logs', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => zeroDayAPI.getAll({ year: now.getFullYear(), month: now.getMonth() + 1 }).then(r => r.data),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const streak = streakData?.streak || user?.zeroDayStreak || 0;
  const personalBest = streakData?.personalBest || user?.zeroDayPersonalBest || 0;
  const level = LEVELS.find(l => streak >= l.min && streak <= l.max) || LEVELS[0];

  const calendarData = logsData?.calendar || {};
  const zeroDaysThisMonth = logsData?.zeroDayCount || 0;
  const monthDays = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });

  // Monthly chart (last 6 months)
  const monthlyChartData = [0, 1, 2, 3, 4, 5].map(offset => {
    const d = new Date(); d.setMonth(d.getMonth() - offset);
    return { month: format(d, 'MMM'), count: Math.floor(Math.random() * 12) }; // placeholder until real data
  }).reverse();

  const flameSize = Math.min(48, 24 + streak * 2);

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
            <Zap size={24} className="text-vault-amber" /> Zero-Day Streaks
          </h1>
          <p className="text-vault-text-secondary text-sm mt-1">No-spend days build real financial discipline.</p>
        </div>

        {/* Streak hero */}
        {streakLoading ? <CardSkeleton /> : (
          <Card glow={streak > 7 ? 'amber' : null} className="text-center py-8">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatType: 'loop' }}
              className="text-6xl mb-4 inline-block"
            >
              {streak > 0 ? <Flame size={flameSize} className="text-orange-400 mx-auto" /> : <Zap size={48} className="text-vault-text-muted mx-auto" />}
            </motion.div>
            <p className="text-xs uppercase tracking-widest text-vault-text-muted mb-2">Current streak</p>
            <p className="text-7xl font-display font-bold bg-gradient-to-br from-vault-amber to-orange-500 text-transparent bg-clip-text drop-shadow-md">{streak}</p>
            <p className="text-vault-text-secondary mt-1">zero-spend days in a row</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mt-4 border" style={{ background: `${level.color}14`, borderColor: `${level.color}40` }}>
              <span className="text-lg">{level.icon}</span>
              <span className="text-sm font-medium" style={{ color: level.color }}>{level.label}</span>
            </div>
          </Card>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-vault-text-muted mb-1">Personal Best</p>
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-vault-amber" />
              <p className="text-2xl font-display font-bold text-vault-amber">{personalBest}</p>
            </div>
            <p className="text-xs text-vault-text-muted mt-1">days</p>
          </Card>
          <Card>
            <p className="text-xs text-vault-text-muted mb-1">This month</p>
            <p className="text-2xl font-display font-bold text-vault-teal">{zeroDaysThisMonth}</p>
            <p className="text-xs text-vault-text-muted mt-1">zero days</p>
          </Card>
          <Card>
            <p className="text-xs text-vault-text-muted mb-1">Level</p>
            <p className="text-xl" title={level.label}>{level.icon}</p>
            <p className="text-sm font-medium mt-1" style={{ color: level.color }}>{level.label}</p>
          </Card>
          <Card>
            <p className="text-xs text-vault-text-muted mb-1">Next level at</p>
            {streak < 15 ? (
              <>
                <p className="text-2xl font-display font-bold text-vault-purple">
                  {LEVELS.find(l => l.min > streak)?.min || streak}
                </p>
                <p className="text-xs text-vault-text-muted mt-1">days</p>
              </>
            ) : (
              <p className="text-sm text-vault-amber font-medium mt-2">Max level! 🎉</p>
            )}
          </Card>
        </div>

        <div className="gc" style={{
          padding: '14px 18px', marginBottom: '16px',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex', alignItems: 'flex-start', gap: '12px'
        }}>
          <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>💡</span>
          <div>
            <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '13px', color: '#EAEDF5', margin: '0 0 3px' }}>
              What counts as a zero day?
            </p>
            <p style={{ fontFamily: 'Inter', fontSize: '12px', color: '#9295A8', margin: 0, lineHeight: 1.6 }}>
              Any spending — even ₹1 — breaks your streak. Guilt-Free and Commitment payments are still spends, so they break the streak too. Only pure zero-spend days count.
              <strong style={{ color: '#EAEDF5' }}> "Worth It" ratings don't help — if you spent, the streak resets.</strong>
            </p>
          </div>
        </div>

        {/* Calendar */}
        <Card>
          <h2 className="font-display font-semibold text-vault-text-primary mb-4">
            {format(now, 'MMMM yyyy')} Calendar
          </h2>
          <div className="grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center text-xs text-vault-text-muted py-1">{d}</div>
            ))}
            {[...Array(new Date(now.getFullYear(), now.getMonth(), 1).getDay())].map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {monthDays.map(day => {
              const year = day.getFullYear();
              const month = day.getMonth() + 1;
              const dateDay = day.getDate();
              const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(dateDay).padStart(2,'0')}`;
              const isZero  = calendarData[dateKey] === true;
              const isSpend = calendarData[dateKey] === false;
              const isFuture = calendarData[dateKey] === null;
              const isPreReg = calendarData[dateKey] === 'pre_registration';
              const isToday = dateKey === now.toISOString().split('T')[0];

              return (
                <div
                  key={dateKey}
                  style={{
                    borderRadius: '12px',
                    aspectRatio: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontFamily: 'Outfit',
                    fontWeight: isToday ? 700 : 400,
                    position: 'relative',
                    border: isPreReg 
                      ? 'none'
                      : isToday
                      ? '1.5px solid rgba(245,166,35,0.6)'
                      : isZero
                      ? '0.5px solid rgba(0,201,167,0.32)'
                      : isSpend
                      ? '0.5px solid rgba(255,92,92,0.22)'
                      : '0.5px solid rgba(255,255,255,0.05)',
                    background: isPreReg
                      ? 'transparent'
                      : isZero
                      ? 'linear-gradient(145deg,rgba(0,201,167,0.2),rgba(0,201,167,0.08))'
                      : isSpend
                      ? 'linear-gradient(145deg,rgba(255,92,92,0.14),rgba(255,92,92,0.06))'
                      : isFuture
                      ? 'rgba(255,255,255,0.01)'
                      : 'rgba(255,255,255,0.025)',
                    color: isPreReg ? '#1A1D2E' : isFuture ? '#2E3047' : '#EAEDF5',
                    boxShadow: isZero ? '0 0 10px rgba(0,201,167,0.12)' : 'none',
                    cursor: 'default',
                    opacity: isPreReg ? 0.3 : 1,
                  }}>
                  {!isPreReg && <span>{dateDay}</span>}
                  {isPreReg && <span style={{ fontSize: '10px', color: '#1A1D2E' }}>·</span>}
                  {isZero && <span style={{ fontSize: '10px', color: '#00C9A7', marginTop: '2px' }}>✓</span>}
                  {isToday && (
                    <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: '#F5A623' }} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[rgba(0,200,150,0.2)]" /><span className="text-xs text-vault-text-muted">Zero day ✓</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[rgba(255,90,90,0.1)]" /><span className="text-xs text-vault-text-muted">Spend day</span></div>
          </div>
        </Card>

        {/* Level system */}
        <Card>
          <h2 className="font-display font-semibold text-vault-text-primary mb-4">Level System</h2>
          <div className="space-y-3">
            {LEVELS.map(l => (
              <div key={l.label} className={`flex items-center gap-3 p-3 rounded-vault-sm transition-all ${level.label === l.label ? 'border border-opacity-40' : 'opacity-50'}`}
                style={{ background: level.label === l.label ? `${l.color}10` : 'transparent', borderColor: l.color }}>
                <span className="text-xl">{l.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: l.color }}>{l.label}</p>
                  <p className="text-xs text-vault-text-muted">{l.max === Infinity ? `${l.min}+ days` : `${l.min}–${l.max} days`}</p>
                </div>
                {level.label === l.label && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${l.color}20`, color: l.color }}>You're here</span>}
              </div>
            ))}
          </div>
        </Card>

        {/* Tips */}
        <Card>
          <h2 className="font-display font-semibold text-vault-text-primary mb-3">💡 Tips for your next zero day</h2>
          <ul className="space-y-2">
            {[
              'Prep meals at home to avoid food delivery temptation',
              'Delete shopping apps from your phone screen',
              'Plan a free activity: walk, read, or call a friend',
              'Check your commitments — a no-spend day helps your free money balance',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-vault-text-secondary">
                <span className="text-vault-amber flex-shrink-0">→</span>{tip}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageWrapper>
  );
}
