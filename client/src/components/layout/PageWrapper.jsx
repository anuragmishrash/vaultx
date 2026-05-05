import { motion } from 'framer-motion';

export default function PageWrapper({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className={`max-w-[1100px] mx-auto ${className}`}
    >
      {children}
    </motion.div>
  );
}
