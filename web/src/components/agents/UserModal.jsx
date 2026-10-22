import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.jsx';
import * as usersApi from '../../api/users.js';
import { Loader2 } from 'lucide-react';

export function UserModal({ isOpen, onClose, user, onSaved }) {
  const isEdit = Boolean(user);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('AGENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (user) {
        setName(user.name || '');
        setEmail(user.email || '');
        setPassword('');
        setRole(user.role || 'AGENT');
      } else {
        setName('');
        setEmail('');
        setPassword('');
        setRole('AGENT');
      }
    }
  }, [isOpen, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nama wajib diisi.');
      return;
    }

    if (!isEdit && !email.trim()) {
      setError('Email wajib diisi.');
      return;
    }

    if (!isEdit && (!password || password.length < 8)) {
      setError('Password minimal 8 karakter.');
      return;
    }

    if (isEdit && password && password.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        const payload = {
          name: name.trim(),
          role,
        };
        if (password) payload.password = password;
        await usersApi.updateUser(user.id, payload);
      } else {
        await usersApi.createUser({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan data user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Data User' : 'Tambah User Baru'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nama Lengkap <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth. Budi Pratama"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Email <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            disabled={isEdit}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cth. budi@perusahaan.com"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {isEdit ? 'Reset Password (kosongkan jika tidak diubah)' : 'Password'} {!isEdit && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? 'Biarkan kosong untuk mempertahankan password lama' : 'Minimal 8 karakter'}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Role <span className="text-rose-500">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
          >
            <option value="AGENT">Agen Customer Support</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? 'Simpan Perubahan' : 'Tambah User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
