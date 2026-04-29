import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Inbox, Plus } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 px-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
        {icon ?? <Inbox size={28} className="text-slate-500" />}
      </div>
      <h3 className="text-lg font-bold text-slate-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm mx-auto">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 mx-auto">
          <Plus size={16} /> {actionLabel}
        </button>
      )}
    </motion.div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 px-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-red-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-300 mb-1">حصل خطأ</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">{message ?? 'ما قدرنا نحمّل البيانات. حاول مرة ثانية.'}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 mx-auto">
          <RefreshCw size={16} /> حاول مرة ثانية
        </button>
      )}
    </motion.div>
  );
}
