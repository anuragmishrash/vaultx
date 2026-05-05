import { ShoppingBag, Utensils, Car, Tv, Zap, Dumbbell, Plane, BookOpen, Sparkles, TrendingUp, Gift, HelpCircle } from 'lucide-react';

export const CATEGORIES = [
  { name: 'Food & Dining', icon: Utensils, color: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
  { name: 'Shopping', icon: ShoppingBag, color: '#F06292', bg: 'rgba(240,98,146,0.12)' },
  { name: 'Transport', icon: Car, color: '#4E9FFF', bg: 'rgba(78,159,255,0.12)' },
  { name: 'Entertainment', icon: Tv, color: '#8B7CF6', bg: 'rgba(139,124,246,0.12)' },
  { name: 'Utilities', icon: Zap, color: '#00C896', bg: 'rgba(0,200,150,0.12)' },
  { name: 'Health & Fitness', icon: Dumbbell, color: '#FF5A5A', bg: 'rgba(255,90,90,0.12)' },
  { name: 'Travel', icon: Plane, color: '#4E9FFF', bg: 'rgba(78,159,255,0.12)' },
  { name: 'Education', icon: BookOpen, color: '#8B7CF6', bg: 'rgba(139,124,246,0.12)' },
  { name: 'Personal Care', icon: Sparkles, color: '#F06292', bg: 'rgba(240,98,146,0.12)' },
  { name: 'Investments', icon: TrendingUp, color: '#00C896', bg: 'rgba(0,200,150,0.12)' },
  { name: 'Guilt-Free', icon: Gift, color: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
  { name: 'Others', icon: HelpCircle, color: '#8A8FA8', bg: 'rgba(138,143,168,0.12)' },
];

export const getCategoryMeta = (name) =>
  CATEGORIES.find(c => c.name === name) || CATEGORIES[CATEGORIES.length - 1];

export const CHART_COLORS = [
  '#F5A623', '#00C896', '#4E9FFF', '#8B7CF6', '#FF5A5A',
  '#F06292', '#26C6DA', '#66BB6A', '#FFA726', '#AB47BC',
];

export const COMMITMENT_CATEGORIES = [
  'Housing', 'Utilities', 'Health & Fitness', 'Groceries',
  'Personal Care', 'Family Support', 'EMIs & Loans',
  'Education', 'Transport', 'Insurance', 'Personal Growth',
];

export const PAYMENT_MODES = ['UPI', 'Card', 'Cash', 'Net Banking'];
