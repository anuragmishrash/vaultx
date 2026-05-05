import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { authAPI, userAPI } from '../api';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/layout/PageWrapper';
import MobilePage from '../components/layout/MobilePage';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Settings as SettingsIcon, User, DollarSign, Bell, Palette, Database, Trash2, Wallet, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'mode', label: 'Money Mode', icon: Wallet },
  { id: 'financial', label: 'Financial Setup', icon: DollarSign },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'theme', label: 'Appearance', icon: Palette },
  { id: 'data', label: 'Data & Privacy', icon: Database },
];

export default function Settings() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('profile');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [modeLoading, setModeLoading] = useState(null);
  const [poolAmount, setPoolAmount] = useState(user?.spendingPool || '');

  const { register, handleSubmit, formState: { isDirty } } = useForm({ defaultValues: {
    name: user?.name || '',
    email: user?.email || '',
    monthlySalary: user?.monthlySalary || '',
    monthlyBudget: user?.monthlyBudget || '',
    guiltyFreeAllowance: user?.guiltyFreeAllowance || 1500,
  }});

  const updateMutation = useMutation({
    mutationFn: (data) => authAPI.updateProfile(data),
    onSuccess: ({ data }) => { updateUser(data.user); toast.success('Settings saved!'); },
    onError: () => toast.error('Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => authAPI.deleteAccount(),
    onSuccess: () => { logout(); navigate('/'); toast.success('Account deleted'); },
  });

  const toggleNotif = (key) => {
    const updated = { notifications: { ...user?.notifications, [key]: !user?.notifications?.[key] } };
    authAPI.updateProfile(updated).then(({ data }) => updateUser(data.user));
  };

  // ── Money Mode helpers ────────────────────────────────────────────
  const switchMode = async (modeId) => {
    if (modeLoading || user?.moneyMode === modeId) return;
    setModeLoading(modeId);
    try {
      const { data } = await userAPI.setMoneyMode(modeId);
      updateUser(data.user);
      toast.success(`Switched to ${modeId === 'salary' ? 'Salary Mode' : modeId === 'pool' ? 'Spending Pool' : 'Full Wallet'}!`);
    } catch {
      toast.error('Failed to switch mode');
    } finally {
      setModeLoading(null);
    }
  };

  const savePool = async () => {
    const amount = parseFloat(poolAmount);
    if (!amount || isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setModeLoading('pool-save');
    try {
      const now = new Date();
      const { data } = await userAPI.setSpendingPool({ amount, month: now.getMonth() + 1, year: now.getFullYear() });
      updateUser(data.user);
      toast.success('Spending pool saved!');
    } catch {
      toast.error('Failed to save pool');
    } finally {
      setModeLoading(null);
    }
  };

  return (
    <MobilePage title="Settings">
    <PageWrapper>
      <div className="space-y-6">
        <div className="hidden md:block">
          <h1 className="font-display font-bold text-2xl text-vault-text-primary flex items-center gap-2">
            <SettingsIcon size={24} className="text-vault-text-secondary" /> Settings
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar nav */}
          <Card className="lg:col-span-1 h-fit" padding={false}>
            <nav className="py-2">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all text-left ${activeSection === id ? 'text-vault-amber bg-[rgba(245,166,35,0.08)]' : 'text-vault-text-secondary hover:text-vault-text-primary hover:bg-white/04'}`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
          </Card>

          {/* Content */}
          <div className="lg:col-span-3 space-y-4">
            {activeSection === 'profile' && (
              <Card>
                <h2 className="font-display font-semibold text-vault-text-primary mb-4">Profile</h2>
                <form onSubmit={handleSubmit(d => updateMutation.mutate({ name: d.name }))} className="space-y-4">
                  {/* Avatar */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-vault-purple to-vault-blue flex items-center justify-center text-2xl font-bold text-white">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-vault-text-primary">{user?.name}</p>
                      <p className="text-xs text-vault-text-muted">{user?.email}</p>
                    </div>
                  </div>
                  <Input label="Full name" {...register('name')} />
                  <Input label="Email" type="email" disabled value={user?.email || ''} className="opacity-60 cursor-not-allowed" />
                  <Button type="submit" loading={updateMutation.isPending}>Save Profile</Button>
                </form>
              </Card>
            )}

            {activeSection === 'mode' && (
              <Card>
                <h2 className="font-display font-semibold text-vault-text-primary mb-2">How VAULT sees your money</h2>
                <p className="text-sm text-vault-text-secondary mb-6">Choose how you want to track your finances. You can change this anytime.</p>

                {/* Mode selector cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    {
                      id: 'salary',
                      icon: '💼',
                      title: 'Salary Mode',
                      desc: 'Use my monthly salary as the income base. Simple, private.',
                    },
                    {
                      id: 'pool',
                      icon: '🎯',
                      title: 'Spending Pool',
                      desc: 'I will declare what I have to spend each month. Private.',
                    },
                    {
                      id: 'wallet',
                      icon: '🏦',
                      title: 'Full Wallet',
                      desc: 'I will add my actual account balances for full insight.',
                    },
                  ].map((m) => {
                    const isActive = (user?.moneyMode || 'salary') === m.id;
                    const isLoading = modeLoading === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={!!modeLoading}
                        onClick={() => switchMode(m.id)}
                        className={`relative p-4 rounded-vault-md border text-left transition-all cursor-pointer
                          ${isActive
                            ? 'bg-[rgba(245,166,35,0.10)] border-vault-amber shadow-[0_0_16px_rgba(245,166,35,0.15)]'
                            : 'bg-white/03 border-white/08 hover:border-white/20 hover:bg-white/05'
                          }
                          ${modeLoading && !isLoading ? 'opacity-50' : ''}
                        `}
                      >
                        {isActive && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-vault-amber flex items-center justify-center">
                            <Check size={11} className="text-black font-bold" strokeWidth={3} />
                          </span>
                        )}
                        <div className="text-2xl mb-3">{m.icon}</div>
                        <p className={`font-semibold mb-1 text-sm ${isActive ? 'text-vault-amber' : 'text-vault-text-primary'}`}>
                          {isLoading ? 'Switching...' : m.title}
                        </p>
                        <p className="text-xs text-vault-text-muted leading-relaxed">{m.desc}</p>
                        {isActive && (
                          <div className="mt-3 text-[10px] font-bold text-vault-amber uppercase tracking-wide">
                            ✓ Active
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Spending Pool config — shown when pool mode is active */}
                {(user?.moneyMode || 'salary') === 'pool' && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-[rgba(245,166,35,0.05)] rounded-vault-md border border-vault-amber/25 space-y-3"
                  >
                    <p className="text-sm font-semibold text-vault-text-primary">💰 Set your spending pool</p>
                    <p className="text-xs text-vault-text-muted">
                      This is private. Enter any amount — your salary, a portion of it, anything you're comfortable tracking against.
                    </p>
                    {user?.spendingPool > 0 && (
                      <p className="text-xs text-vault-amber font-medium">
                        Current pool: ₹{user.spendingPool.toLocaleString('en-IN')}
                      </p>
                    )}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <input
                          type="number"
                          className="gi w-full"
                          placeholder="e.g., 30000"
                          value={poolAmount}
                          onChange={(e) => setPoolAmount(e.target.value)}
                          min="1"
                        />
                      </div>
                      <Button
                        type="button"
                        loading={modeLoading === 'pool-save'}
                        onClick={savePool}
                      >
                        Save Pool
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Full Wallet config — shown when wallet mode is active */}
                {(user?.moneyMode || 'salary') === 'wallet' && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-[rgba(78,159,255,0.05)] rounded-vault-md border border-[rgba(78,159,255,0.25)] space-y-3"
                  >
                    <p className="text-sm font-semibold text-vault-text-primary">🏦 Manage your money buckets</p>
                    <p className="text-xs text-vault-text-muted">
                      Add your bank accounts, savings, cash, and wallets. VAULT will use your real balances to calculate your true spending power and net worth.
                    </p>
                    <Button onClick={() => navigate('/my-money')}>
                      Go to My Money →
                    </Button>
                  </motion.div>
                )}
              </Card>
            )}

            {activeSection === 'financial' && (
              <Card>
                <h2 className="font-display font-semibold text-vault-text-primary mb-4">Financial Setup</h2>
                <form onSubmit={handleSubmit(d => updateMutation.mutate({
                  monthlySalary: parseFloat(d.monthlySalary) || 0,
                  monthlyBudget: parseFloat(d.monthlyBudget) || 0,
                  guiltyFreeAllowance: parseFloat(d.guiltyFreeAllowance) || 1500,
                }))} className="space-y-4">
                  <Input label="Monthly Salary / Income" type="number" prefix="₹" placeholder="60000" {...register('monthlySalary')} />
                  <p className="text-xs text-vault-text-muted -mt-2">Used for time-cost calculations and True Free Money waterfall</p>
                  <Input label="Monthly Spending Budget" type="number" prefix="₹" placeholder="35000" {...register('monthlyBudget')} />
                  <p className="text-xs text-vault-text-muted -mt-2">
                    {(user?.moneyMode || 'salary') === 'pool'
                      ? `Optional. If left blank, your spending pool (₹${(user?.spendingPool || 0).toLocaleString('en-IN')}) is used as your budget reference on the dashboard.`
                      : 'Optional. If left blank, your salary is used as a reference.'}
                  </p>
                  <Input label="Guilt-Free Allowance" type="number" prefix="₹" placeholder="1500" {...register('guiltyFreeAllowance')} />
                  <p className="text-xs text-vault-text-muted -mt-2">A small amount you can spend freely each month — no categories, no regret checks. Only transactions added via the "Spend Guilt-Free" button count against this.</p>
                  <div className="flex items-center justify-between p-3 bg-white/03 rounded-vault-sm">
                    <div>
                      <p className="text-sm text-vault-text-primary">Commitment Carry-Forward</p>
                      <p className="text-xs text-vault-text-muted">Deduct overspent commitment amounts from next month</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { authAPI.updateProfile({ commitmentCarryForward: !user?.commitmentCarryForward }).then(({ data }) => updateUser(data.user)); }}
                      className={`relative w-12 h-6 rounded-full transition-all ${user?.commitmentCarryForward ? 'bg-vault-teal' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${user?.commitmentCarryForward ? 'left-[26px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <Button type="submit" loading={updateMutation.isPending}>Save Financial Settings</Button>
                </form>
              </Card>
            )}

            {activeSection === 'notifications' && (
              <Card>
                <h2 className="font-display font-semibold text-vault-text-primary mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { key: 'regretReminders', label: 'Regret Reminders', desc: 'Daily reminder to rate 24h-old spends' },
                    { key: 'subscriptionAlerts', label: 'Subscription Due Alerts', desc: 'Get notified 3 days before subscription renewals' },
                    { key: 'weeklyDNAReport', label: 'Weekly DNA Report', desc: 'Sunday summary of your Spend DNA' },
                    { key: 'zeroDayAlerts', label: 'Zero-Day Streak Alerts', desc: 'Celebrate streak milestones' },
                    { key: 'commitmentReminders', label: 'Commitment Reminders', desc: 'Remind you to mark commitments as paid' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-white/03 rounded-vault-sm">
                      <div>
                        <p className="text-sm font-medium text-vault-text-primary">{label}</p>
                        <p className="text-xs text-vault-text-muted">{desc}</p>
                      </div>
                      <button
                        onClick={() => toggleNotif(key)}
                        className={`relative w-12 h-6 rounded-full transition-all ${user?.notifications?.[key] ? 'bg-vault-teal' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${user?.notifications?.[key] ? 'left-[26px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeSection === 'theme' && (
              <Card>
                <h2 className="font-display font-semibold text-vault-text-primary mb-2">Appearance</h2>
                <p className="text-sm text-vault-text-secondary mb-6">VAULT Premium is exclusively designed in a cinematic dark mode for the best experience.</p>
                <div className="space-y-3">
                  <div className="w-full flex items-center gap-3 p-3 rounded-vault-sm border border-vault-amber bg-[rgba(245,166,35,0.06)]">
                    <span className="text-xl">🌙</span>
                    <span className="text-sm font-medium text-vault-text-primary">Premium Dark Mode</span>
                    <span className="ml-auto text-xs text-vault-amber">Active</span>
                  </div>
                </div>
              </Card>
            )}

            {activeSection === 'data' && (
              <Card>
                <h2 className="font-display font-semibold text-vault-text-primary mb-4">Data & Privacy</h2>
                <div className="space-y-4">
                  <div className="p-4 bg-white/03 rounded-vault-md">
                    <p className="text-sm font-medium text-vault-text-primary mb-1">Export All Data</p>
                    <p className="text-xs text-vault-text-muted mb-3">Download all your transactions as a CSV file</p>
                    <Button
                      variant="secondary" size="sm"
                      onClick={async () => {
                        const { transactionsAPI } = await import('../api');
                        const { data: blob } = await transactionsAPI.exportCSV();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'vault-all-transactions.csv'; a.click();
                        toast.success('Exported!');
                      }}
                    >
                      Export CSV
                    </Button>
                  </div>

                  <div className="p-4 bg-[rgba(255,90,90,0.04)] rounded-vault-md border border-[rgba(255,90,90,0.15)]">
                    <p className="text-sm font-medium text-vault-red mb-1">Delete Account</p>
                    <p className="text-xs text-vault-text-muted mb-3">Permanently delete your account and all data. This cannot be undone.</p>
                    {!deleteConfirm ? (
                      <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(true)}>
                        <Trash2 size={14} /> Delete Account
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-vault-red font-medium">Are you sure? This is permanent.</p>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
                          <Button variant="danger" size="sm" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                            Yes, delete everything
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-xs text-vault-text-muted">VAULT v1.0.0 · Your data stays yours.</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
    </MobilePage>
  );
}
