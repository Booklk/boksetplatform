export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} - ${formatTime(date)}`;
}

export function formatCurrency(amount: string | number): string {
  return Number(amount).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
  });
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'في الانتظار',
  confirmed: 'مؤكد',
  on_way: 'في الطريق',
  arrived: 'وصل',
  in_progress: 'جاري التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

export const VEHICLE_TYPES = [
  'سيدان', 'SUV', 'بيكاب', 'فان', 'كوبيه', 'هاتشباك', 'سيارة رياضية',
];

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
