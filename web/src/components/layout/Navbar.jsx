import { useAuth } from '../../context/AuthContext.jsx';
import { useConnection } from '../../context/ConnectionContext.jsx';
import { RoleBadge } from '../common/Badge.jsx';
import { LogOut, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const { status } = useConnection();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 z-10 shadow-sm">
      {/* Left: Search / Page context or Empty */}
      <div className="flex items-center gap-3">
        {/* Can be used for mobile toggle if needed */}
      </div>

      {/* Right: Connection Status & User Profile */}
      <div className="flex items-center gap-4">
        {/* Connection status pill */}
        <div className="flex items-center">
          {status === 'connected' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Terhubung
            </span>
          )}
          {status === 'reconnecting' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
              Menyambungkan ulang...
            </span>
          )}
          {status === 'offline' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <WifiOff className="w-3.5 h-3.5 text-rose-600" />
              Offline
            </span>
          )}
        </div>

        <div className="h-5 w-px bg-slate-200" />

        {/* User Info */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm border border-brand-200">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-800 leading-tight">
              {user?.name}
            </span>
            <span className="text-[10px] text-slate-400 leading-tight">
              {user?.email}
            </span>
          </div>
          <RoleBadge role={user?.role} />
        </div>

        {/* Logout button */}
        <button
          onClick={logout}
          title="Keluar"
          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
