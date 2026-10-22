import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Inbox, Users, Headphones } from 'lucide-react';

export function Sidebar() {
  const { isAdmin } = useAuth();

  return (
    <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
          <Headphones className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-white text-base tracking-tight leading-tight">
            Helpdesk
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Agent Workspace
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="p-4 space-y-1.5 flex-1">
        <NavLink
          to="/tickets"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              isActive
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`
          }
        >
          <Inbox className="w-4 h-4" />
          <span>Tiket</span>
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/agents"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`
            }
          >
            <Users className="w-4 h-4" />
            <span>Kelola Agen</span>
          </NavLink>
        )}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/60 text-[11px] text-slate-400 text-center">
        v1.0.0 &bull; Ciheul Technologies
      </div>
    </aside>
  );
}
