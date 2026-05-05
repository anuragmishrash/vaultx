import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Button({ children, variant = 'primary', size = 'md', fullWidth, loading, className = '', ...props }) {
  const base = {
    primary: 'btn-amber',
    secondary: 'btn-ghost',
    danger: 'btn-ghost border-vault-red/30 text-vault-red hover:bg-vault-red/10 hover:border-vault-red/50',
    ghost: 'bg-transparent border-none text-vault-text2 hover:text-vault-text1 p-2',
  };

  const sizes = {
    sm: 'text-[13px] px-4 py-2',
    md: '',
    lg: 'text-base px-8 py-4',
  };

  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={clsx(
        base[variant],
        sizes[size],
        fullWidth && 'w-full',
        loading && 'opacity-60 cursor-wait',
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2 justify-center">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
          Loading...
        </span>
      ) : children}
    </motion.button>
  );
}
