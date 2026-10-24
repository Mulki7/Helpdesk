import { Search, X, Inbox } from 'lucide-react';
import { TicketFilters } from './TicketFilters.jsx';
import { TicketCard } from './TicketCard.jsx';
import { EmptyState } from '../common/EmptyState.jsx';

export function TicketList({
  tickets,
  counts,
  activeTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
  selectedTicketId,
  onSelectTicket,
  loading,
}) {
  return (
    <div className="w-[420px] flex flex-col border-r border-slate-200/70 bg-white h-full shrink-0 shadow-sm">
      {/* Panel Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Tiket Masuk
        </p>
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari tiket atau customer..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 transition-all shadow-sm focus:shadow-md"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <TicketFilters
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        counts={counts}
      />

      {/* Tickets List */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Memuat tiket...
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Tidak ada tiket"
            description={
              searchQuery
                ? `Tidak ditemukan tiket untuk "${searchQuery}"`
                : 'Tidak ada tiket dalam filter ini.'
            }
          />
        ) : (
          tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              isSelected={selectedTicketId === t.id}
              onClick={() => onSelectTicket(t.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
