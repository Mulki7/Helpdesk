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
    <div className="w-80 md:w-96 flex flex-col border-r border-slate-200 bg-white h-full shrink-0">
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-200/80 bg-slate-50/50">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari tiket, customer, pesan..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Memuat daftar tiket...
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Tidak ada tiket"
            description={
              searchQuery
                ? `Tidak ditemukan tiket untuk "${searchQuery}"`
                : 'Tidak ada tiket dalam filter ini saat ini.'
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
