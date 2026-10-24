import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import logoImg from '../../../assets/logo.jpg';
import { Inbox, Users, Shield } from 'lucide-react';

export function Sidebar() {
  const { isAdmin } = useAuth();

  return (
    <aside className="w-72 bg-[#111111] text-slate-300 flex flex-col shrink-0 border-r border-white/[0.06] select-none">
      {/* Brand Header */}
      <div className="h-20 flex items-center px-6 gap-3.5 border-b border-white/[0.06]">
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 p-1 border border-emerald-500/30 shrink-0 shadow-lg shadow-emerald-500/10">
          <img
            src={logoImg}
            alt="Ciheul Technologies"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-white text-base tracking-tight leading-tight truncate">
            Ciheul Helpdesk
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            <span className="text-[11px] text-slate-400 font-medium tracking-wide">
              Workspace Pro
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="p-4 space-y-2 flex-1">
        <div className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Menu Utama
        </div>

        <NavLink
          to="/tickets"
          className={({ isActive }) =>
            `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
              isActive
                ? 'bg-emerald-500/10 text-white border border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Inbox
                className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span className="flex-1">Daftar Tiket</span>
            </>
          )}
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/agents"
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                isActive
                  ? 'bg-emerald-500/10 text-white border border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Users
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span className="flex-1">Kelola Pengguna</span>
              </>
            )}
          </NavLink>
        )}
      </div>

      {/* Footer Branding & Version */}
      <div className="p-5 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500/80" />
          <span className="font-medium">Ciheul Support</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">v1.0.0</span>
      </div>
    </aside>
  );
}

