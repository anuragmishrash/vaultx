import api from './axiosInstance';

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh-token'),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  deleteAccount: () => api.delete('/auth/account'),
};

export const transactionsAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  bulkDelete: (ids) => api.delete('/transactions/bulk', { data: { ids } }),
  rateRegret: (id, rating) => api.patch(`/transactions/${id}/regret`, { rating }),
  exportCSV: () => api.get('/transactions/export/csv', { responseType: 'blob' }),
};

export const moodAPI = {
  getAll: (params) => api.get('/mood', { params }),
  log: (data) => api.post('/mood', data),
  getCorrelation: () => api.get('/mood/correlation'),
};

export const subscriptionsAPI = {
  getAll: () => api.get('/subscriptions'),
  create: (data) => api.post('/subscriptions', data),
  update: (id, data) => api.put(`/subscriptions/${id}`, data),
  delete: (id) => api.delete(`/subscriptions/${id}`),
  detectFromCSV: (file) => {
    const form = new FormData();
    form.append('statement', file);
    return api.post('/subscriptions/detect', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const analyticsAPI = {
  getDashboard: (period = 'this_month') => api.get(`/analytics/dashboard?period=${period}`),
  getMonthly: (months = 6) => api.get('/analytics/monthly', { params: { months } }),
  getCategoryTrends: (months = 6) => api.get('/analytics/categories', { params: { months } }),
  getDayOfWeek: () => api.get('/analytics/dayofweek'),
  getForecast: () => api.get('/analytics/forecast'),
  getFutureValue: (params) => api.get('/analytics/future-value', { params }),
  getTfm: (period) => api.get('/analytics/tfm', { params: { period } }),
};

export const dnaAPI = {
  get: () => api.get('/dna'),
  compute: () => api.post('/dna/compute'),
};

export const zeroDayAPI = {
  getAll: (params) => api.get('/zeroday', { params }),
  getStreak: () => api.get('/zeroday/streak'),
};

export const commitmentsAPI = {
  getAll: () => api.get('/commitments'),
  create: (data) => api.post('/commitments', data),
  update: (id, data) => api.put(`/commitments/${id}`, data),
  delete: (id) => api.delete(`/commitments/${id}`),
  pause: (id, data) => api.patch(`/commitments/${id}/pause`, data),
  getLogs: (params) => api.get('/commitments/logs', { params }),
  pay: (id, data) => api.post(`/commitments/logs/${id}/pay`, data),
  payLog: (logId, data) => api.post(`/commitments/logs/${logId}/pay`, data),
  getVariance: (months = 6) => api.get('/commitments/logs/variance', { params: { months } }),
  getWaterfall: (params) => api.get('/commitments/waterfall', { params }),
  // Brain endpoints
  getAffordability: () => api.get('/commitments/affordability'),
  getSuggestions: () => api.get('/commitments/suggestions'),
  acceptSuggestion: (data) => api.post('/commitments/suggestions/accept', data),
  getPrediction: (id) => api.get(`/commitments/${id}/prediction`),
};

export const userAPI = {
  setMoneyMode: (moneyMode) => api.patch('/user/money-mode', { moneyMode }),
  setSpendingPool: (data) => api.patch('/user/spending-pool', data),
  setHideBalance: (hide) => api.patch('/user/hide-wallet-balance', { hide }),
};

export const accountsAPI = {
  getAll:       ()          => api.get('/accounts'),
  getSummary:   ()          => api.get('/accounts/summary'),
  create:       (data)      => api.post('/accounts', data),
  update:       (id, data)  => api.put(`/accounts/${id}`, data),
  updateBalance:(id, bal, note) => api.patch(`/accounts/${id}/balance`, { balance: bal, note }),
  setDefault:   (id)        => api.patch(`/accounts/${id}/set-default`),
  delete:       (id)        => api.delete(`/accounts/${id}`),
  transfer:     (data)      => api.post('/accounts/transfer', data),
  getNetWorthHistory: (months = 6) => api.get('/accounts/net-worth-history', { params: { months } }),
};

export const cashAPI = {
  getEnvelope: (params) => api.get('/cash/envelope', { params }),
  createEnvelope: (data) => api.post('/cash/envelope', data),
  countWallet: (physicalCount) => api.patch('/cash/envelope/count', { physicalCount }),
  getAnalytics: (months = 6) => api.get('/cash/analytics', { params: { months } }),
  getRatio: (params) => api.get('/cash/ratio', { params }),
};

export const patternsAPI = {
  getTransactions: () => api.get('/patterns/suggestions/transactions'),
  getGuiltFree: () => api.get('/patterns/suggestions/guilt-free'),
  getCommitments: () => api.get('/patterns/suggestions/commitments'),
  confirm: (id, data) => api.post(`/patterns/confirm/${id}`, data),
  dismiss: (id) => api.post(`/patterns/dismiss/${id}`),
  getBatch: () => api.get('/patterns/batch'),
  batchConfirm: (data) => api.post('/patterns/batch-confirm', data),
  getTemplates: () => api.get('/patterns/templates'),
  searchMemory: (q) => api.get('/patterns/memory', { params: { q } }),
};

export const incomeAPI = {
  get: (month) => api.get('/income', { params: { month } }),
  log: (data) => api.post('/income', data),
  delete: (id) => api.delete(`/income/${id}`),
};

