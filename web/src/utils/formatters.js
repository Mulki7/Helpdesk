/**
 * Format ticket ID to HD-xxxx (4-digit padding)
 * Example: 7 -> "HD-0007"
 */
export function formatTicketNumber(id) {
  if (!id) return '';
  return `HD-${String(id).padStart(4, '0')}`;
}

/**
 * Format date string into Indonesian relative time
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 45) return 'Baru saja';
  if (diffSec < 90) return '1 mnt lalu';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;
  if (diffSec < 7200) return '1 jam lalu';
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  if (diffSec < 172800) return 'Kemarin';

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format full date and time for audit trail and headers
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STATUS_LABELS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const STATUS_COLORS = {
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
  IN_PROGRESS: 'bg-slate-100 text-slate-800 border-slate-300 font-semibold',
  RESOLVED: 'bg-amber-50 text-amber-700 border-amber-200/90',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const PRIORITY_LABELS = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
};

export const PRIORITY_COLORS = {
  LOW: 'bg-slate-50 text-slate-600 border-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-rose-50 text-rose-700 border-rose-200',
};

