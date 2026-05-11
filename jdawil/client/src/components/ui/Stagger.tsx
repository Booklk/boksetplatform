import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Stagger container — wraps a list and reveals each child with a
 * 40ms delay. Standardizes the "list appears" feel across the app
 * so vendors get the same rhythm whether they're looking at
 * bookings, customers, or tasks.
 */
export function Stagger({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.04,
            delayChildren: delay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Each item inside a Stagger gets this wrapper. */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 6 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
