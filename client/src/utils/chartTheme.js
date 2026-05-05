export const chartColors = {
  amber:  '#F5A623',
  teal:   '#00C9A7',
  purple: '#9B8AFB',
  blue:   '#5BA4F5',
  coral:  '#FF7A5C',
  pink:   '#F472B6',
  gray:   '#4E5268',
};

export const chartDefaults = {
  grid: { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)', vertical: false },
  axis: { tick: { fill: '#4E5268', fontSize: 11, fontFamily: 'Inter' }, axisLine: false, tickLine: false },
  tooltip: {
    contentStyle: {
      background: 'rgba(17, 19, 31, 0.95)',
      border: '0.5px solid rgba(255,255,255,0.12)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)',
      fontFamily: 'Inter',
      fontSize: '13px',
      color: '#F2F3F8',
    },
    itemStyle: { color: '#9295A8' },
    cursor: { stroke: 'rgba(245,166,35,0.2)', strokeWidth: 1 },
  }
};
