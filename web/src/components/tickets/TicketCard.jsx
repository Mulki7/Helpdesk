import { formatTicketNumber, formatRelativeTime } from '../../utils/formatters.js';
import { StatusBadge } from '../common/Badge.jsx';
import { User } from 'lucide-react';

export function TicketCard({ ticket, isSelected, onClick }) {
  const lastMsg = ticket.lastMessage;

  return (
    <div
      onClick={onClick}
      className={`px-5 py-4 border-b border-slate-100/80 cursor-pointer transition-all duration-200 group ${
        isSelected
          ? 'bg-white border-l-[4px] border-l-emerald-500 pl-[16px] shadow-sm'
          : 'bg-white hover:bg-slate-50/80 border-l-[4px] border-l-transparent'
      }`}
    >
      {/* Row 1: Ticket ID + Time */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`font-mono text-xs font-bold tracking-wider ${
            isSelected ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
          }`}
        >
          {formatTicketNumber(ticket.id)}
        </span>
        <span className="text-xs text-slate-400 font-medium">
          {formatRelativeTime(ticket.lastMessageAt || ticket.updatedAt)}
        </span>
      </div>

      {/* Row 2: Customer Name (prominent) */}
      <p className="text-sm font-bold text-slate-900 truncate mb-1.5 leading-tight">
        {ticket.customer?.name || 'Customer'}
      </p>

      {/* Row 3: Message preview */}
      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
        {lastMsg?.body || ticket.subject || 'Tidak ada pesan'}
      </p>

      {/* Row 4: Status + Assignee */}
      <div className="flex items-center justify-between">
        <StatusBadge status={ticket.status} />
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[100px] font-medium">
            {ticket.assignedAgent ? ticket.assignedAgent.name : 'Belum diambil'}
          </span>
        </div>
      </div>
    </div>
  );
}
