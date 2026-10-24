import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '../../utils/formatters.js';

export function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status;
  const colorClass = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}
    >
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const label = PRIORITY_LABELS[priority] || priority;
  const colorClass = PRIORITY_COLORS[priority] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}
    >
      {label}
    </span>
  );
}

export function RoleBadge({ role }) {
  const isAdmin = role === 'ADMIN';
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold tracking-wide uppercase shadow-sm ${
        isAdmin
          ? 'bg-[#191c21] text-white border border-white/20'
          : 'bg-slate-100 text-slate-600 border border-slate-200'
      }`}
    >
      {isAdmin ? 'Admin' : 'Agen'}
    </span>
  );
}

