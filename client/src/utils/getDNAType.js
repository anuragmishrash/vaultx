export const DNA_TYPES = {
  'Comfort Spender': {
    color: '#F5A623',
    bg: 'rgba(245, 166, 35, 0.12)',
    icon: '🛋️',
    description: 'You spend on comfort, convenience, and food delivery. Stress often triggers your spending.',
    pitfalls: ['Over-ordering food delivery', 'Impulse convenience purchases', 'Stress spending'],
    tips: ['Set a food delivery budget per week', 'Batch cook on weekends', 'Identify stress triggers'],
  },
  'Experience Chaser': {
    color: '#4E9FFF',
    bg: 'rgba(78, 159, 255, 0.12)',
    icon: '✈️',
    description: 'You prioritize experiences — travel, events, entertainment. You live in the moment.',
    pitfalls: ['Over-spending on trips', 'FOMO-driven purchases', 'Under-saving for future'],
    tips: ['Create a travel fund', 'Book experiences in advance for better prices', 'Set a "fun money" monthly cap'],
  },
  'Impulse Buyer': {
    color: '#FF5A5A',
    bg: 'rgba(255, 90, 90, 0.12)',
    icon: '🛒',
    description: 'Frequent unplanned purchases with high regret rates. Shopping is your default response.',
    pitfalls: ['High regret rate on purchases', 'Frequent small impulse buys', 'Over-shopping during sales'],
    tips: ['Use a 24-hour rule before purchases', 'Unsubscribe from shopping apps', 'Track regret rate weekly'],
  },
  'Disciplined Saver': {
    color: '#00C896',
    bg: 'rgba(0, 200, 150, 0.12)',
    icon: '💎',
    description: 'Consistent, intentional spending with strong investment habits. You think long-term.',
    pitfalls: ['Being too restrictive', 'Missing out on enriching experiences', 'Under-spending on health'],
    tips: ['Allocate a guilt-free budget', 'Invest the surplus', 'Review goals quarterly'],
  },
};

export const getDNAType = (scores) => {
  if (!scores) return null;
  const types = ['Comfort Spender', 'Experience Chaser', 'Impulse Buyer', 'Disciplined Saver'];
  const keys = ['comfort', 'experience', 'impulse', 'discipline'];
  const max = Math.max(...keys.map(k => scores[k] || 0));
  const maxKey = keys.find(k => scores[k] === max);
  return types[keys.indexOf(maxKey)];
};
