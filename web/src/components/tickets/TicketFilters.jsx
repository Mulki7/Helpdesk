export function TicketFilters({ activeTab, onSelectTab, counts }) {
  const tabs = [
    { id: 'antrean', label: 'Antrean', count: counts.antrean },
    { id: 'mine', label: 'Tiket Saya', count: counts.mine },
    { id: 'all', label: 'Semua', count: counts.all },
    { id: 'resolved', label: 'Resolved', count: counts.resolved },
    { id: 'closed', label: 'Closed', count: counts.closed },
  ];

  return (
    <div className="flex border-b border-slate-100 bg-white px-3 gap-1 overflow-x-auto shrink-0 scrollbar-none">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex items-center gap-1.5 py-2.5 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer my-1.5 shadow-sm ${
              isActive
                ? 'bg-[#111111] text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 shadow-none'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`min-w-[18px] h-5 px-1.5 rounded-md text-[10px] font-bold flex items-center justify-center ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {tab.count || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
