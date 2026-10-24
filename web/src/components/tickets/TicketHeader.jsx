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
  User,
} from 'lucide-react';

export function TicketHeader({
  ticket,
  activeView,
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
    <div className="bg-white border-b border-slate-200/70 shrink-0 shadow-sm">
      {/* Error Alert */}
      {errorMsg && (
        <div className="mx-8 mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="text-rose-500 hover:text-rose-700 text-sm underline font-semibold cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      )}

      {/* === ROW 1: Ticket Identity === */}
      <div className="px-8 pt-6 pb-4">
        {/* Ticket number + status + priority badges */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className="font-mono font-bold text-base text-slate-900 tracking-wider">
            {formatTicketNumber(ticket.id)}
          </span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>

        {/* Subject line */}
        <h2 className="text-lg font-bold text-slate-900 leading-snug mb-3 truncate">
          {ticket.subject || 'Percakapan Pelanggan'}
        </h2>

        {/* Customer + Assignee meta */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700">
              {ticket.customer?.name}
            </span>
            {ticket.customer?.email && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 truncate max-w-[200px]">
                  {ticket.customer.email}
                </span>
              </>
            )}
          </div>
          <div className="text-xs text-slate-400 shrink-0">
            <span className="font-medium">Assignee: </span>
            <span className="font-semibold text-slate-700">
              {ticket.assignedAgent ? ticket.assignedAgent.name : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* === ROW 2: Action Toolbar === */}
      {!isClosed && (
        <div className="px-8 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center gap-2.5 flex-wrap">
          {actionLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
          )}

          {/* Ambil Tiket */}
          {isOpenUnassigned && (
            <button
              onClick={handleClaim}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              Ambil Tiket
            </button>
          )}

          {/* Lepas */}
          {isInProgress && canManage && (
            <button
              onClick={handleRelease}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <UserX className="w-4 h-4" />
              Lepas
            </button>
          )}

          {/* Tandai Resolved */}
          {isInProgress && canManage && (
            <button
              onClick={() => handleUpdateStatus('RESOLVED')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#191c21] text-white hover:bg-[#252a32] active:scale-[0.98] disabled:opacity-50 transition-all shadow-md cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Tandai Resolved
            </button>
          )}

          {/* Buka Kembali */}
          {isResolved && canManage && (
            <button
              onClick={() => handleUpdateStatus('IN_PROGRESS')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Buka Kembali
            </button>
          )}

          {/* Tutup Tiket */}
          {isResolved && canManage && (
            <button
              onClick={() => handleUpdateStatus('CLOSED')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              Tutup Tiket
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Prioritas dropdown */}
          {canManage && (
            <select
              value={ticket.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              disabled={actionLoading}
              className="text-xs bg-white border border-slate-200 rounded-lg px-3.5 py-2 font-semibold text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 cursor-pointer shadow-sm transition-all"
            >
              <option value="LOW">Rendah</option>
              <option value="MEDIUM">Sedang</option>
              <option value="HIGH">Tinggi</option>
            </select>
          )}

          {/* Pindahkan (Admin) */}
          {isAdmin && (
            <button
              onClick={() => setIsAssignOpen(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4 text-slate-400" />
              Pindahkan
            </button>
          )}
        </div>
      )}

      {/* === ROW 3: View Tab Switcher === */}
      <div className="px-8 flex items-center gap-6 border-t border-slate-100 bg-white">
        <button
          onClick={() => onViewChange('chat')}
          className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
            activeView === 'chat'
              ? 'border-emerald-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Percakapan
        </button>

        <button
          onClick={() => onViewChange('events')}
          className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
            activeView === 'events'
              ? 'border-emerald-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Aktivitas
        </button>
      </div>

      <AssignModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        ticket={ticket}
        onAssigned={onTicketUpdated}
      />
    </div>
  );
}
