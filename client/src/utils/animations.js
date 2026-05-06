export const pageTransition = {
  initial:   { opacity: 0, y: 20, filter: 'blur(4px)' },
  animate:   { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit:      { opacity: 0, y: -10, filter: 'blur(2px)', transition: { duration: 0.2, ease: 'easeIn' } }
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } }
};

export const staggerItem = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
};

export const counterConfig = { duration: 1.2, ease: [0.16, 1, 0.3, 1] };

export const cardHover = {
  whileHover: { y: -3, scale: 1.005, transition: { duration: 0.2, ease: 'easeOut' } },
  whileTap:   { scale: 0.99, transition: { duration: 0.1 } }
};

export const clayHover = {
  whileHover: { y: -5, scale: 1.04, transition: { type: 'spring', stiffness: 400, damping: 20 } },
  whileTap:   { scale: 0.97 }
};

export const orbSelect = {
  whileHover: { scale: 1.18, y: -4, transition: { type: 'spring', stiffness: 500, damping: 18 } },
  whileTap:   { scale: 0.92 }
};

export const drawerVariants = {
  hidden:  { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', damping: 28, stiffness: 320 } },
  exit:    { y: '100%', opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } }
};

export const toastVariants = {
  initial: { x: 40, opacity: 0, scale: 0.95 },
  animate: { x: 0,  opacity: 1, scale: 1,   transition: { type: 'spring', stiffness: 400, damping: 24 } },
  exit:    { x: 40, opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

export const regretCardExit = (direction = 1) => ({
  x: direction * 120, opacity: 0, scale: 0.9, rotate: direction * 8,
  transition: { duration: 0.3, ease: [0.4, 0, 1, 1] }
});

export const fabLabel = {
  initial: { opacity: 0, x: 10, scale: 0.9 },
  animate: { opacity: 1, x: 0,  scale: 1, transition: { duration: 0.2 } }
};

import { useIsMobile } from '../hooks/useMediaQuery';

// Use simple animations on mobile to save GPU
export const usePageTransition = () => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return {
      initial:   { opacity: 0 },
      animate:   { opacity: 1, transition: { duration: 0.2 } },
      exit:      { opacity: 0, transition: { duration: 0.15 } },
    };
  }
  return {
    initial:   { opacity: 0, y: 18, filter: 'blur(4px)' },
    animate:   { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.38, ease: [0.16,1,0.3,1] } },
    exit:      { opacity: 0, y: -10, transition: { duration: 0.18 } },
  };
};

export const useCardVariants = () => {
  const isMobile = useIsMobile();
  if (isMobile) {
    // Simpler stagger on mobile — less animation overhead
    return {
      container: { animate: { transition: { staggerChildren: 0.04 } } },
      item:      { initial:{opacity:0}, animate:{opacity:1,transition:{duration:0.2}} },
    };
  }
  return {
    container: { animate: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } },
    item:      { initial:{opacity:0,y:14,scale:0.98}, animate:{opacity:1,y:0,scale:1,transition:{duration:0.35,ease:[0.16,1,0.3,1]}} },
  };
};
