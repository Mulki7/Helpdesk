import { useAuth } from '../../context/AuthContext.jsx';
import { useConnection } from '../../context/ConnectionContext.jsx';
import { RoleBadge } from '../common/Badge.jsx';
import { LogOut, RefreshCw, WifiOff } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const { status } = useConnection();

  return (
    <header className="h-20 bg-white border-b border-slate-200/70 px-8 flex items-center justify-between shrink-0 z-10 shadow-sm">
      {/* Left: Empty or future breadcrumb */}
      <div className="flex items-center gap-3">
      </div>

      {/* Right: Connection Status & User Profile */}
      <div className="flex items-center gap-5">
        {/* Connection status pill */}
        <div className="flex items-center">
          {status === 'connected' && (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-400" />
              Terhubung
            </span>
          )}
          {status === 'reconnecting' && (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              Menyambungkan...
            </span>
          )}
          {status === 'offline' && (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
              <WifiOff className="w-4 h-4 text-rose-600" />
              Offline
            </span>
          )}
        </div>

        <div className="h-5 w-px bg-slate-200" />

        {/* User Info with Emerald Deep avatar */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#064e3b] text-[#34d399] flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-900/20 border-2 border-emerald-800/50">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900 leading-tight">
              {user?.name}
            </span>
            <span className="text-xs text-slate-400 leading-tight">
              {user?.email}
            </span>
          </div>
          <RoleBadge role={user?.role} />
        </div>

        {/* Logout button */}
        <button
          onClick={logout}
          title="Keluar"
          className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200 ml-1 cursor-pointer shadow-sm hover:shadow-md"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  );
}

