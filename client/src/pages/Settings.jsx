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
  { id: 'profile',    label: 'Profile',         icon: User },
  { id: 'accounts',  label: 'Bank Accounts',   icon: Wallet },
  { id: 'financial', label: 'Financial Setup',  icon: DollarSign },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'theme',     label: 'Appearance',       icon: Palette },
  { id: 'data',      label: 'Data & Privacy',   icon: Database },
];

export default function Settings() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('profile');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

            {activeSection === 'accounts' && (
              <Card>
                <h2 className="font-display font-semibold text-vault-text-primary mb-2">Bank Accounts</h2>
                <p className="text-sm text-vault-text-secondary mb-4 leading-relaxed">
                  Add your bank accounts, UPI wallets, and credit cards. VAULT will auto-deduct your spending from the chosen account and calculate your real Safe to Spend balance.
                </p>
                <div className="p-4 bg-[rgba(245,166,35,0.04)] rounded-vault-md border border-[rgba(245,166,35,0.2)] mb-4">
                  <p className="text-sm font-medium text-vault-text-primary mb-1">How it works</p>
                  <ul className="text-xs text-vault-text-muted space-y-1.5">
                    <li>• Every transaction automatically deducts from the selected account</li>
                    <li>• Deleting a transaction restores the balance</li>
                    <li>• Safe to Spend = Account Balance − Unpaid Commitments</li>
                  </ul>
                </div>
                <Button onClick={() => navigate('/my-money')}>
                  Manage Accounts →
                </Button>
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
