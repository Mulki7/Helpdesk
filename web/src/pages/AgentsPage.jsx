import { useState, useEffect } from 'react';
import * as usersApi from '../api/users.js';
import { useAuth } from '../context/AuthContext.jsx';
import { UserModal } from '../components/agents/UserModal.jsx';
import { RoleBadge } from '../components/common/Badge.jsx';
import { formatDateTime } from '../utils/formatters.js';
import { UserPlus, Edit2, UserCheck, UserX, Loader2, AlertCircle } from 'lucide-react';

export function AgentsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await usersApi.getUsers();
      setUsers(data || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat data pengguna.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      setError('Anda tidak dapat menonaktifkan akun Anda sendiri.');
      return;
    }

    const nextActive = !targetUser.isActive;
    const confirmMsg = nextActive
      ? `Aktifkan kembali akun ${targetUser.name}?`
      : `Nonaktifkan akun ${targetUser.name}? User tidak akan dapat login.`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(targetUser.id);
    setError('');
    try {
      await usersApi.updateUser(targetUser.id, { isActive: nextActive });
      await fetchUsers();
    } catch (err) {
      setError(err.message || 'Gagal mengubah status aktif user.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (targetUser) => {
    setEditingUser(targetUser);
    setIsModalOpen(true);
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kelola Pengguna</h1>
            <p className="text-xs text-slate-500 mt-1">
              Daftar akun agen customer support dan administrator.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah User</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-xs text-rose-500 underline font-medium hover:text-rose-700"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600 mb-2" />
              <span>Memuat data user...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Nama Lengkap</th>
                  <th className="py-3 px-5">Email</th>
                  <th className="py-3 px-5">Role</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Terdaftar</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isActionLoading = actionLoadingId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-900">
                        {u.name}
                        {isSelf && (
                          <span className="ml-2 text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md border border-brand-100">
                            Anda
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500">{u.email}</td>
                      <td className="py-3.5 px-5">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="py-3.5 px-5">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400 font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 text-[11px]">
                        {formatDateTime(u.createdAt)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf || isActionLoading}
                            title={
                              isSelf
                                ? 'Tidak dapat menonaktifkan diri sendiri'
                                : u.isActive
                                ? 'Nonaktifkan Akun'
                                : 'Aktifkan Akun'
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed text-slate-300'
                                : u.isActive
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {isActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : u.isActive ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={editingUser}
        onSaved={fetchUsers}
      />
    </div>
  );
}
