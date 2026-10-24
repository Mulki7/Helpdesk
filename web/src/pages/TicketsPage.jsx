import { useState } from 'react';
import { useTickets } from '../context/TicketsContext.jsx';
import { TicketList } from '../components/tickets/TicketList.jsx';
import { TicketHeader } from '../components/tickets/TicketHeader.jsx';
import { TicketChat } from '../components/tickets/TicketChat.jsx';
import { TicketEvents } from '../components/tickets/TicketEvents.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { MessageSquareDashed } from 'lucide-react';

export function TicketsPage() {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    tickets,
    counts,
    loadingTickets,
    selectedTicketId,
    setSelectedTicketId,
    selectedTicket,
    messages,
    events,
    loadingDetail,
    sendMessage,
    discardMessage,
    reloadDetail,
  } = useTickets();

  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'events'

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-100">
      {/* Left Column: Ticket List & Filters */}
      <TicketList
        tickets={tickets}
        counts={counts}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTicketId={selectedTicketId}
        onSelectTicket={setSelectedTicketId}
        loading={loadingTickets}
      />

      {/* Right Column: Ticket Conversation & Activities */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white">
        {selectedTicketId && selectedTicket ? (
          <>
            <TicketHeader
              ticket={selectedTicket}
              activeView={activeView}
              onViewChange={setActiveView}
              onTicketUpdated={reloadDetail}
            />

            <div className="flex-1 min-h-0 relative">
              {loadingDetail ? (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center text-sm text-slate-400 z-10">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3" />
                  Memuat percakapan...
                </div>
              ) : null}

              {activeView === 'chat' ? (
                <TicketChat
                  ticket={selectedTicket}
                  messages={messages}
                  onSendMessage={sendMessage}
                  onDiscardMessage={discardMessage}
                />
              ) : (
                <TicketEvents events={events} />
              )}
            </div>
          </>
        ) : (
          <EmptyState
            icon={MessageSquareDashed}
            title="Pilih Tiket"
            description="Pilih salah satu tiket dari daftar di sebelah kiri untuk melihat riwayat percakapan dan membalas pesan."
          />
        )}
      </div>
    </div>
  );
}
