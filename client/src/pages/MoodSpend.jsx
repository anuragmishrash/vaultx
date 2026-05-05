import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { moodAPI } from '../api';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ChartSkeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/formatCurrency';
import { MOOD_EMOJIS, MOOD_LABELS, MOOD_COLORS } from '../utils/getMoodScore';
import { chartDefaults } from '../utils/chartTheme';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import toast from 'react-hot-toast';
import { Brain, CheckCircle } from 'lucide-react';

const MOODS = ['great', 'good', 'neutral', 'stressed', 'sad', 'angry'];

export default function MoodSpend() {
  const qc = useQueryClient();
  const now = new Date();

  const { data: moodsData, isLoading } = useQuery({
    queryKey: ['moods', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => moodAPI.getAll({ year: now.getFullYear(), month: now.getMonth() + 1 }).then(r => r.data),
  });

  const { data: corrData, isLoading: corrLoading } = useQuery({
    queryKey: ['mood-correlation'],
    queryFn: () => moodAPI.getCorrelation().then(r => r.data),
  });

  const logMutation = useMutation({
    mutationFn: (data) => moodAPI.log(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moods'] });
      qc.invalidateQueries({ queryKey: ['mood-correlation'] });
      toast.success('Mood logged!');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to log mood'),
  });

  const moods = moodsData?.moods || [];
  const todayStr = format(now, 'yyyy-MM-dd');
  const todayMood = moods.find(m => format(new Date(m.date), 'yyyy-MM-dd') === todayStr);

  const monthDays = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
            <Brain size={24} className="text-vault-purple" /> Mood & Spend
          </h1>
          <p className="text-vault-text-secondary text-sm mt-1">Does your mood drive your spending?</p>
        </div>

        {/* Mood Logger */}
        <Card>
          <h2 className="font-display font-semibold text-vault-text-primary mb-1">How are you feeling today?</h2>
          {todayMood ? (
            <div className="flex items-center gap-3 mt-3">
              <CheckCircle size={20} className="text-vault-teal" />
              <div>
                <p className="text-sm text-vault-text-primary">
                  Today: <span className="text-xl">{MOOD_EMOJIS[todayMood.mood]}</span> <span className="font-medium">{MOOD_LABELS[todayMood.mood]}</span>
                </p>
                <p className="text-xs text-vault-text-muted">Mood logged for today. Come back tomorrow!</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 mt-4">
              {MOODS.map(mood => (
                <motion.button
                  key={mood}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => logMutation.mutate({ mood })}
                  disabled={logMutation.isPending}
                  className="clay-orb animate-float w-20 h-20 flex flex-col items-center justify-center hover:scale-110 transition-all"
                  style={{ '--hover-color': MOOD_COLORS[mood], animationDelay: `${MOODS.indexOf(mood) * 0.1}s` }}
                >
                  <span className="text-2xl leading-none">{MOOD_EMOJIS[mood]}</span>
                  <span className="text-[10px] text-vault-text-secondary mt-1">{MOOD_LABELS[mood]}</span>
                </motion.button>
              ))}
            </div>
          )}
        </Card>

        {/* Correlation stats */}
        {!corrLoading && corrData?.hasData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <p className="text-xs text-vault-text-muted mb-1">Correlation</p>
              <p className="text-2xl font-display font-bold text-vault-purple">
                R² = {Math.abs(corrData.correlation).toFixed(2)}
              </p>
              <p className="text-xs text-vault-text-muted mt-1">
                {Math.abs(corrData.correlation) > 0.5 ? 'Strong' : Math.abs(corrData.correlation) > 0.3 ? 'Moderate' : 'Weak'} correlation
              </p>
            </Card>
            <Card>
              <p className="text-xs text-vault-text-muted mb-1">Trigger Mood</p>
              <p className="text-2xl">{MOOD_EMOJIS[corrData.triggerMood]}</p>
              <p className="text-sm font-medium text-vault-text-primary mt-1">{MOOD_LABELS[corrData.triggerMood]}</p>
              <p className="text-xs text-vault-text-muted">Highest avg spend</p>
            </Card>
            <Card>
              <p className="text-xs text-vault-text-muted mb-1">Spend on trigger mood</p>
              <p className="text-2xl font-display font-bold text-vault-red">
                {formatINR(corrData.avgByMood?.[corrData.triggerMood] || 0)}
              </p>
              <p className="text-xs text-vault-text-muted mt-1">per day on average</p>
            </Card>
          </div>
        )}

        {/* Avg spend by mood */}
        {!corrLoading && corrData?.hasData && corrData.avgByMood && (
          <Card>
            <h2 className="font-display font-semibold text-vault-text-primary mb-4">Average Spending by Mood</h2>
            <div className="space-y-3">
              {MOODS.filter(m => corrData.avgByMood[m] !== undefined).map(mood => {
                const max = Math.max(...Object.values(corrData.avgByMood));
                const pct = max > 0 ? (corrData.avgByMood[mood] / max) * 100 : 0;
                return (
                  <div key={mood} className="flex items-center gap-3">
                    <span className="text-xl flex-shrink-0">{MOOD_EMOJIS[mood]}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-vault-text-secondary">{MOOD_LABELS[mood]}</span>
                        <span className="text-vault-text-primary font-medium">{formatINR(corrData.avgByMood[mood])}</span>
                      </div>
                      <div className="h-1.5 bg-white/08 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className="h-full rounded-full"
                          style={{ background: MOOD_COLORS[mood] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Scatter correlation chart */}
        {!corrLoading && corrData?.hasData && corrData.dataPoints?.length >= 7 && (
          <Card padding={false}>
            <div className="p-5 pb-2">
              <h2 className="font-display font-semibold text-vault-text-primary">Mood vs Spending Scatter</h2>
              <p className="text-xs text-vault-text-muted">Each dot = one day. Lower mood = more spending?</p>
            </div>
            <div className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart>
                  <CartesianGrid {...chartDefaults.grid} />
                  <XAxis dataKey="moodScore" name="Mood" domain={[1, 5]} tickFormatter={v => ['', 'Angry', 'Stressed', 'Neutral', 'Good', 'Great'][v] || v} {...chartDefaults.axis} />
                  <YAxis dataKey="spent" name="Spent" tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} {...chartDefaults.axis} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    {...chartDefaults.tooltip}
                    content={({ payload }) => payload?.[0] ? (
                      <div className="glass-card px-3 py-2 text-xs">
                        <p>{MOOD_EMOJIS[payload[0].payload.mood]} {MOOD_LABELS[payload[0].payload.mood]}</p>
                        <p className="text-vault-amber">{formatINR(payload[0].payload.spent)}</p>
                      </div>
                    ) : null}
                  />
                  <Scatter data={corrData.dataPoints} fill="#8B7CF6" opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Calendar view */}
        {moods.length > 0 && (
          <Card>
            <h2 className="font-display font-semibold text-vault-text-primary mb-4">
              {format(now, 'MMMM yyyy')} — Mood Calendar
            </h2>
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-xs text-vault-text-muted py-1">{d}</div>
              ))}
              {/* Empty days before month start */}
              {[...Array(new Date(now.getFullYear(), now.getMonth(), 1).getDay())].map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {monthDays.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const mood = moods.find(m => format(new Date(m.date), 'yyyy-MM-dd') === dayStr);
                const isToday = dayStr === todayStr;
                return (
                  <div
                    key={dayStr}
                    className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs relative ${isToday ? 'ring-1 ring-vault-amber' : ''}`}
                    style={{ background: mood ? `${MOOD_COLORS[mood.mood]}18` : 'rgba(255,255,255,0.02)' }}
                    title={mood ? `${MOOD_LABELS[mood.mood]} · ${formatINR(mood.totalSpentSameDay)}` : undefined}
                  >
                    <span className="text-vault-text-muted">{format(day, 'd')}</span>
                    {mood && <span className="text-xs leading-none mt-0.5">{MOOD_EMOJIS[mood.mood]}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {!corrLoading && !corrData?.hasData && (
          <Card className="text-center py-10">
            <Brain size={40} className="text-vault-purple mx-auto mb-3 opacity-50" />
            <p className="text-vault-text-secondary font-medium">Log 7+ days of mood to unlock correlation insights</p>
            <p className="text-xs text-vault-text-muted mt-1">You have {moods.length} days logged so far</p>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
