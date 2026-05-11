import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  emoji: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
  onAction?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function EmptyState({ emoji, title, description, actionLabel, actionPath, onAction, size = 'md' }: EmptyStateProps) {
  const sizes = {
    sm: 'py-8',
    md: 'py-16',
    lg: 'py-24',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center text-center ${sizes[size]} px-4`}
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        className="text-5xl mb-4"
      >
        {emoji}
      </motion.div>
      <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-xs mb-6">{description}</p>
      {(actionLabel && actionPath) && (
        <Link
          to={actionPath}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all text-sm"
        >
          {actionLabel}
        </Link>
      )}
      {(actionLabel && onAction) && (
        <button
          onClick={onAction}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all text-sm"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
