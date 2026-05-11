import { BookingStatus } from '../types';
import { STATUS_LABELS } from '../lib/utils';

const icons: Record<string, string> = {
  pending: '⏳',
  confirmed: '✅',
  on_way: '🚗',
  arrived: '📍',
  in_progress: '🧹',
  completed: '🌟',
  cancelled: '❌',
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span>{icons[status]}</span>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
