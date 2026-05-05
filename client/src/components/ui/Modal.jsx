import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative z-10 w-full ${sizes[size]} gc flex flex-col max-h-[85vh] rounded-t-[18px] md:rounded-[18px]`}
            style={{ background: 'rgba(14,15,28,0.96)', backdropFilter: 'blur(24px) saturate(180%)' }}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/[0.07] flex-shrink-0">
              <h3 style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '18px', color: '#EAEDF5' }}>{title}</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-all"
                style={{ color: '#9295A8' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {children}
            </div>

            {footer && (
              <div className="p-5 border-t border-white/[0.07] flex-shrink-0 bg-[#0E0F1C]/50">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
