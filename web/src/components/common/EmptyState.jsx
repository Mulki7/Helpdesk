export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3.5 shadow-2xs">
          <Icon className="w-6 h-6 stroke-[1.75]" />
        </div>
      )}
      <h3 className="text-sm font-bold text-slate-800 mb-1">{title}</h3>
      {description && <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">{description}</p>}
      {action}
    </div>
  );
}

