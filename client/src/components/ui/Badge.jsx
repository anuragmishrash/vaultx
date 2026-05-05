const badges = {
  worth_it: 'badge-worth',
  okay: 'badge-okay',
  regret: 'badge-regret',
  pending: 'badge-unrated',
};

const labels = {
  worth_it: '✓ Worth It',
  okay: '~ Okay',
  regret: '✗ Regret',
  pending: '· Unrated',
};

export function RegretBadge({ status }) {
  return (
    <span className={badges[status] || badges.pending}>
      {labels[status] || '· Unrated'}
    </span>
  );
}

export function Badge({ children, color = 'default', className = '' }) {
  const colors = {
    amber: 'bg-[rgba(245,166,35,0.12)] text-vault-amber border border-[rgba(245,166,35,0.2)]',
    teal: 'bg-[rgba(0,201,167,0.12)] text-vault-teal border border-[rgba(0,201,167,0.2)]',
    red: 'bg-[rgba(255,92,92,0.12)] text-vault-red border border-[rgba(255,92,92,0.2)]',
    purple: 'bg-[rgba(155,138,251,0.12)] text-vault-purple border border-[rgba(155,138,251,0.2)]',
    default: 'bg-white/5 text-vault-text2 border border-white/10',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  );
}
