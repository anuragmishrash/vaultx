import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { dnaAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/Skeleton';
import { DNA_TYPES } from '../utils/getDNAType';
import { Dna, RefreshCw, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function SpendDNA() {
  const { user } = useAuthStore();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dna'],
    queryFn: () => dnaAPI.get().then(r => r.data),
  });

  const computeMutation = useMutation({
    mutationFn: () => dnaAPI.compute(),
    onSuccess: () => { refetch(); toast.success('DNA recomputed!'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Not enough data yet'),
  });

  const current = data?.current;
  const canCompute = data?.canCompute;
  const progress = data?.progress;
  const reason = data?.reason;
  const hasDNA = !!(current && current.dominantType);
  const dnaType = current?.dominantType || 'Comfort Spender';
  const meta = DNA_TYPES[dnaType] || DNA_TYPES['Comfort Spender'];
  const history = data?.history || [];

  const radarData = current?.snapshot ? [
    { subject: 'Comfort', A: current.snapshot.comfort || 0 },
    { subject: 'Experience', A: current.snapshot.experience || 0 },
    { subject: 'Impulse', A: current.snapshot.impulse || 0 },
    { subject: 'Discipline', A: current.snapshot.discipline || 0 },
  ] : [];

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
              <Dna size={24} className="text-vault-amber" /> Spend DNA
            </h1>
            <p className="text-vault-text-secondary text-sm mt-1">Your money personality, computed from 3 months of spending.</p>
          </div>
          {hasDNA && (
            <Button variant="secondary" size="sm" onClick={() => computeMutation.mutate()} loading={computeMutation.isPending}>
              <RefreshCw size={14} /> Recompute
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>
        ) : hasDNA ? (
          /* ── HAS VALID DNA → show result ── */
          <>
            {/* DNA Type Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="clay-card p-6 relative overflow-hidden"
              style={{ borderColor: `${meta.color}30`, borderWidth: 1 }}
            >
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ background: meta.color, transform: 'translate(30%, -30%)' }} />
              <div className="relative z-10">
                <div className="text-5xl mb-3">{meta.icon}</div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: meta.color }}>Your Spend DNA Type</p>
                <h2 className="font-display font-bold text-3xl text-vault-text-primary mb-3">{dnaType}</h2>
                <p className="text-vault-text-secondary text-sm leading-relaxed max-w-xl" style={{ textAlign: 'left' }}>{meta.description}</p>
              </div>
            </motion.div>

            {/* Radar + Dimension bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {radarData.length > 0 && (
                <Card padding={false}>
                  <div className="p-5 pb-2">
                    <h3 className="font-display font-semibold text-vault-text-primary">DNA Breakdown</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#8A8FA8', fontSize: 11 }} />
                      <Radar dataKey="A" stroke={meta.color} fill={meta.color} fillOpacity={0.2} strokeWidth={2} />
                      <Tooltip contentStyle={{ background: '#13151C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {radarData.length > 0 && (
                <Card>
                  <h3 className="font-display font-semibold text-vault-text-primary mb-4">Dimension Scores</h3>
                  <div className="space-y-4">
                    {radarData.map(({ subject, A }, i) => {
                      const dimColors = ['#F5A623', '#4E9FFF', '#FF5A5A', '#00C896'];
                      return (
                        <div key={subject}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-vault-text-secondary">{subject}</span>
                            <span className="font-medium text-vault-text-primary">{A}%</span>
                          </div>
                          <div className="h-2 bg-white/08 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${A}%` }}
                              transition={{ duration: 0.7, delay: i * 0.1 }}
                              className="h-full rounded-full"
                              style={{ background: dimColors[i] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>

            {/* Pitfalls and tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <h3 className="font-display font-semibold text-vault-red mb-3">⚠ Common Pitfalls</h3>
                <ul className="space-y-2">
                  {meta.pitfalls.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-vault-text-secondary">
                      <span className="text-vault-red mt-0.5 flex-shrink-0">•</span>{p}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <h3 className="font-display font-semibold text-vault-teal mb-3">✓ Personalized Tips</h3>
                <ul className="space-y-2">
                  {meta.tips.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-vault-text-secondary">
                      <span className="text-vault-teal mt-0.5 flex-shrink-0">→</span>{t}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* DNA History */}
            {history.length > 1 && (
              <Card>
                <h3 className="font-display font-semibold text-vault-text-primary mb-3 flex items-center gap-2">
                  <History size={16} /> DNA Timeline
                </h3>
                <div className="space-y-3">
                  {history.map((snap, i) => {
                    const snapMeta = DNA_TYPES[snap.dominantType] || {};
                    return (
                      <div key={snap._id} className="flex items-center gap-3 p-3 bg-white/03 rounded-vault-sm">
                        <span className="text-xl">{snapMeta.icon || '🧬'}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-vault-text-primary">{snap.dominantType}</p>
                          <p className="text-xs text-vault-text-muted">{format(new Date(snap.computedAt), 'MMM d, yyyy')}</p>
                        </div>
                        {i === 0 && <span className="text-xs text-vault-amber bg-[rgba(245,166,35,0.1)] px-2 py-0.5 rounded-full">Current</span>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        ) : (
          /* ── NOT ENOUGH DATA → show progress toward DNA unlock ── */
          <Card className="text-center py-10">
            <div className="text-5xl mb-4">🧬</div>
            <h3 className="font-display font-bold text-xl text-vault-text-primary mb-2">Building your DNA profile...</h3>
            <p className="text-sm text-vault-text-secondary max-w-md mx-auto mb-6 leading-relaxed">
              {reason || 'Keep tracking your spending. Your DNA profile unlocks once we have enough data to find a meaningful pattern.'}
            </p>

            {/* Progress bars */}
            {progress && (
              <div className="space-y-4 max-w-sm mx-auto mb-8 text-left">
                {[
                  { label: 'Transactions', ...progress.transactions },
                  { label: 'Days with spending', ...progress.days },
                  { label: 'Spending categories', ...progress.categories },
                ].map(({ label, current: cur, needed }) => {
                  const done = cur >= needed;
                  return (
                    <div key={label}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-vault-text-secondary">{label}</span>
                        <span className={`text-xs font-semibold ${done ? 'text-vault-teal' : 'text-vault-amber'}`}>
                          {cur} / {needed} {done && '✓'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/08 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((cur / needed) * 100, 100)}%` }}
                          transition={{ duration: 0.8 }}
                          className="h-full rounded-full"
                          style={{ background: done ? '#00C896' : '#F5A623' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              onClick={() => computeMutation.mutate()}
              disabled={!canCompute}
              loading={computeMutation.isPending}
              className={!canCompute ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {canCompute ? 'Compute my DNA →' : 'Keep tracking to unlock'}
            </Button>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
