export function TicketFilters({ activeTab, onSelectTab, counts }) {
  const tabs = [
    { id: 'antrean', label: 'Antrean', count: counts.antrean },
    { id: 'mine', label: 'Tiket Saya', count: counts.mine },
    { id: 'all', label: 'Semua', count: counts.all },
    { id: 'resolved', label: 'Resolved', count: counts.resolved },
    { id: 'closed', label: 'Closed', count: counts.closed },
  ];

  return (
    <div className="flex border-b border-slate-200 bg-white px-3 gap-1 overflow-x-auto shrink-0 scrollbar-none">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex items-center gap-1.5 py-3 px-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              isActive
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isActive
                  ? 'bg-brand-100 text-brand-700'
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
