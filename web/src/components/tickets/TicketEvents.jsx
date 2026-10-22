import { formatDateTime } from '../../utils/formatters.js';
import { History, Activity } from 'lucide-react';
import { EmptyState } from '../common/EmptyState.jsx';

export function TicketEvents({ events }) {
  if (!events || events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Belum ada aktivitas"
        description="Riwayat perubahan tiket akan dicatat di sini secara otomatis."
      />
    );
  }

  const getEventDescription = (ev) => {
    const actor = ev.actorUser ? ev.actorUser.name : 'Sistem / Pelanggan';

    switch (ev.type) {
      case 'CREATED':
        return `Tiket dibuat.`;
      case 'ASSIGNED':
        return `Tiket ditugaskan ke ${ev.newValue || 'agen'} oleh ${actor}.`;
      case 'RELEASED':
        return `Tiket dilepas oleh ${actor}.`;
      case 'STATUS_CHANGED':
        return `Status diubah dari ${ev.oldValue} menjadi ${ev.newValue} oleh ${actor}.`;
      case 'PRIORITY_CHANGED':
        return `Prioritas diubah dari ${ev.oldValue} menjadi ${ev.newValue} oleh ${actor}.`;
      case 'REOPENED':
        return `Tiket dibuka kembali oleh pelanggan.`;
      default:
        return `${ev.type} oleh ${actor}.`;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto space-y-4">
        {events.map((ev, index) => (
          <div key={ev.id || index} className="flex gap-3 text-xs">
            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 bg-white border border-slate-200 p-3 rounded-xl shadow-xs">
              <p className="font-medium text-slate-800 leading-relaxed">
                {getEventDescription(ev)}
              </p>
              <span className="block text-[11px] text-slate-400 mt-1">
                {formatDateTime(ev.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
