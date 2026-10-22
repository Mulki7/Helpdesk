import { formatTicketNumber, formatRelativeTime } from '../../utils/formatters.js';
import { StatusBadge, PriorityBadge } from '../common/Badge.jsx';
import { User, MessageSquare } from 'lucide-react';

export function TicketCard({ ticket, isSelected, onClick }) {
  const lastMsg = ticket.lastMessage;

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-slate-100 cursor-pointer transition-all duration-150 ${
        isSelected
          ? 'bg-blue-50/70 border-l-4 border-l-brand-600 pl-3'
          : 'hover:bg-slate-50/80 bg-white'
      }`}
    >
      {/* Top row: Number, relative time, Priority */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-xs text-brand-700 tracking-wide font-mono">
          {formatTicketNumber(ticket.id)}
        </span>
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={ticket.priority} />
          <span className="text-[11px] text-slate-400">
            {formatRelativeTime(ticket.lastMessageAt || ticket.updatedAt)}
          </span>
        </div>
      </div>

      {/* Customer Name */}
      <h4 className="text-sm font-semibold text-slate-900 truncate mb-1">
        {ticket.customer?.name || 'Customer'}
      </h4>

      {/* Last message snippet or Subject */}
      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2.5">
        {lastMsg?.body || ticket.subject || 'Tidak ada pesan'}
      </p>

      {/* Bottom row: Status and Assignee */}
      <div className="flex items-center justify-between text-xs pt-1">
        <StatusBadge status={ticket.status} />

        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[110px]">
            {ticket.assignedAgent ? ticket.assignedAgent.name : 'Belum diambil'}
          </span>
        </div>
      </div>
    </div>
  );
}
