import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.jsx';
import { getUsers } from '../../api/users.js';
import { assignTicket } from '../../api/tickets.js';
import { UserCheck, Loader2 } from 'lucide-react';

export function AssignModal({ isOpen, onClose, ticket, onAssigned }) {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError('');
      setSelectedAgentId(ticket?.assignedAgentId ? String(ticket.assignedAgentId) : '');
      getUsers()
        .then((res) => {
          // Only active users
          const active = (res || []).filter((u) => u.isActive);
          setAgents(active);
        })
        .catch((err) => {
          setError(err.message || 'Gagal memuat daftar agen.');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, ticket]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgentId) {
      setError('Pilih agen terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await assignTicket(ticket.id, Number(selectedAgentId));
      onAssigned();
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal memindahkan tiket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pindahkan Tiket ke Agen Lain">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Pilih Agen / Admin
          </label>
          {loading ? (
            <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              Memuat data agen...
            </div>
          ) : (
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 cursor-pointer"
            >
              <option value="">-- Pilih Agen --</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name} ({ag.role === 'ADMIN' ? 'Admin' : 'Agen'}) — {ag.email}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting || loading}
            className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-semibold bg-[#111111] text-white hover:bg-[#1f242c] active:scale-[0.99] disabled:opacity-50 transition-all shadow-xs cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

