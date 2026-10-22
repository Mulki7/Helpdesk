import { useState } from 'react';
import { formatTicketNumber } from '../../utils/formatters.js';
import { StatusBadge, PriorityBadge } from '../common/Badge.jsx';
import { AssignModal } from './AssignModal.jsx';
import * as ticketsApi from '../../api/tickets.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  UserCheck,
  UserX,
  CheckCircle2,
  RotateCcw,
  Archive,
  ArrowRightLeft,
  MessageSquare,
  History,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export function TicketHeader({
  ticket,
  activeView, // 'chat' | 'events'
  onViewChange,
  onTicketUpdated,
}) {
  const { user, isAdmin } = useAuth();
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!ticket) return null;

  const isAssignee = ticket.assignedAgentId === user?.id;
  const canManage = isAssignee || isAdmin;
  const isClosed = ticket.status === 'CLOSED';
  const isOpenUnassigned = ticket.status === 'OPEN' && !ticket.assignedAgentId;
  const isInProgress = ticket.status === 'IN_PROGRESS';
  const isResolved = ticket.status === 'RESOLVED';

  // Claim action (Rule 4: atomic claim, handles 409)
  const handleClaim = async () => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await ticketsApi.claimTicket(ticket.id);
      onTicketUpdated();
    } catch (err) {
      if (err.status === 409 || err.code === 'TICKET_ALREADY_CLAIMED') {
        setErrorMsg('Tiket sudah diambil agen lain.');
      } else {
        setErrorMsg(err.message || 'Gagal mengambil tiket.');
      }
      onTicketUpdated();
    } finally {
      setActionLoading(false);
    }
  };

  // Release action (Rule 5)
  const handleRelease = async () => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await ticketsApi.releaseTicket(ticket.id);
      onTicketUpdated();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal melepas tiket.');
    } finally {
      setActionLoading(false);
    }
  };

  // Status transitions
  const handleUpdateStatus = async (newStatus) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await ticketsApi.updateTicket(ticket.id, { status: newStatus });
      onTicketUpdated();
    } catch (err) {
      setErrorMsg(err.message || `Gagal mengubah status ke ${newStatus}.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Priority transition
  const handlePriorityChange = async (newPriority) => {
    if (newPriority === ticket.priority) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await ticketsApi.updateTicket(ticket.id, { priority: newPriority });
      onTicketUpdated();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengubah prioritas.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200/80 px-6 py-4 shrink-0 shadow-sm">
      {/* Alert Error Message */}
      {errorMsg && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="text-rose-500 hover:text-rose-700 text-xs underline font-medium"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Top Header Row: Ticket Number & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <span className="font-mono font-extrabold text-lg text-brand-700">
            {formatTicketNumber(ticket.id)}
          </span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}

          {/* 1. Ambil Tiket (Claim) */}
          {isOpenUnassigned && (
            <button
              onClick={handleClaim}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Ambil Tiket
            </button>
          )}

          {/* 2. Lepas Tiket (Release) */}
          {isInProgress && canManage && (
            <button
              onClick={handleRelease}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              <UserX className="w-3.5 h-3.5" />
              Lepas
            </button>
          )}

          {/* 3. Tandai Resolved */}
          {isInProgress && canManage && (
            <button
              onClick={() => handleUpdateStatus('RESOLVED')}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tandai Resolved
            </button>
          )}

          {/* 4. Buka Kembali (Reopen) */}
          {isResolved && canManage && (
            <button
              onClick={() => handleUpdateStatus('IN_PROGRESS')}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Buka Kembali
            </button>
          )}

          {/* 5. Tutup Tiket (Close) */}
          {isResolved && canManage && (
            <button
              onClick={() => handleUpdateStatus('CLOSED')}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Archive className="w-3.5 h-3.5" />
              Tutup Tiket
            </button>
          )}

          {/* 6. Dropdown Prioritas */}
          {!isClosed && canManage && (
            <select
              value={ticket.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              disabled={actionLoading}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-brand-500"
            >
              <option value="LOW">Prioritas: Rendah</option>
              <option value="MEDIUM">Prioritas: Sedang</option>
              <option value="HIGH">Prioritas: Tinggi</option>
            </select>
          )}

          {/* 7. Pindahkan ke... (Admin only) */}
          {isAdmin && !isClosed && (
            <button
              onClick={() => setIsAssignOpen(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Pindahkan ke...
            </button>
          )}
        </div>
      </div>

      {/* Middle Row: Subject & Customer & Assignee metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-snug">
            {ticket.subject || 'Percakapan Pelanggan'}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="font-medium text-slate-700">
              {ticket.customer?.name}
            </span>
            {ticket.customer?.email && (
              <>
                <span>&bull;</span>
                <span>{ticket.customer.email}</span>
              </>
            )}
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-slate-400">Assignee: </span>
          <span className="font-semibold text-slate-700">
            {ticket.assignedAgent ? ticket.assignedAgent.name : 'Belum diambil'}
          </span>
        </div>
      </div>

      {/* Bottom Row: View Switcher (Percakapan vs Aktivitas) */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 text-xs font-semibold">
        <button
          onClick={() => onViewChange('chat')}
          className={`flex items-center gap-1.5 pb-1 border-b-2 transition-colors ${
            activeView === 'chat'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Percakapan</span>
        </button>

        <button
          onClick={() => onViewChange('events')}
          className={`flex items-center gap-1.5 pb-1 border-b-2 transition-colors ${
            activeView === 'events'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Aktivitas</span>
        </button>
      </div>

      {/* Reassign Modal */}
      <AssignModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        ticket={ticket}
        onAssigned={onTicketUpdated}
      />
    </div>
  );
}
