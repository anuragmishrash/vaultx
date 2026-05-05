import {
  ShoppingBag, Car, Utensils, Zap, Heart,
  Film, GraduationCap, Package, Home,
  Dumbbell, Plane, Smartphone, ShoppingCart,
  CreditCard, Coffee, Wifi, Droplets
} from 'lucide-react';

export const CATEGORY_ICONS = {
  'Food & Dining':   { icon: Utensils,     color: '#F5A623', bg: 'rgba(245,166,35,0.15)' },
  'Groceries':       { icon: ShoppingCart, color: '#00C9A7', bg: 'rgba(0,201,167,0.15)' },
  'Transport':       { icon: Car,          color: '#5BA4F5', bg: 'rgba(91,164,245,0.15)' },
  'Entertainment':   { icon: Film,         color: '#F472B6', bg: 'rgba(244,114,182,0.15)' },
  'Health & Fitness':{ icon: Dumbbell,     color: '#9B8AFB', bg: 'rgba(155,138,251,0.15)' },
  'Utilities':       { icon: Zap,          color: '#FFD166', bg: 'rgba(255,209,102,0.15)' },
  'Shopping':        { icon: ShoppingBag,  color: '#FF7A5C', bg: 'rgba(255,122,92,0.15)' },
  'Education':       { icon: GraduationCap,color: '#5BA4F5', bg: 'rgba(91,164,245,0.15)' },
  'Travel':          { icon: Plane,        color: '#00C9A7', bg: 'rgba(0,201,167,0.15)' },
  'Personal Care':   { icon: Heart,        color: '#F472B6', bg: 'rgba(244,114,182,0.15)' },
  'Housing':         { icon: Home,         color: '#9B8AFB', bg: 'rgba(155,138,251,0.15)' },
  'Investments':     { icon: CreditCard,   color: '#00C9A7', bg: 'rgba(0,201,167,0.15)' },
  'Mobile/Telecom':  { icon: Smartphone,   color: '#5BA4F5', bg: 'rgba(91,164,245,0.15)' },
  'Internet':        { icon: Wifi,         color: '#5BA4F5', bg: 'rgba(91,164,245,0.15)' },
  'Beverages':       { icon: Coffee,       color: '#F5A623', bg: 'rgba(245,166,35,0.15)' },
  'Water/Gas':       { icon: Droplets,     color: '#5BA4F5', bg: 'rgba(91,164,245,0.15)' },
  'Others':          { icon: Package,      color: '#9295A8', bg: 'rgba(146,149,168,0.15)' },
};

export const DEFAULT_ICON = { icon: Package, color: '#9295A8', bg: 'rgba(146,149,168,0.15)' };

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || DEFAULT_ICON;
}
