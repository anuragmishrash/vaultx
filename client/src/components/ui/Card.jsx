import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Card({ children, className = '', padding = true, glow, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={clsx('gc', padding && 'p-5', className)}
      style={glow ? { borderColor: glow === 'amber' ? 'rgba(245,166,35,0.25)' : glow === 'teal' ? 'rgba(0,201,167,0.25)' : 'rgba(155,138,251,0.25)' } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
}
