'use client';
import { useState } from 'react';
import { X, KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/api';

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const toggle = (field: keyof typeof show) => setShow((s) => ({ ...s, [field]: !s[field] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.next.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (form.next !== form.confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      await authApi.changePassword(form.current, form.next);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Contraseña actual incorrecta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-unphu-800" />
            <h2 className="text-base font-semibold text-gray-900">Cambiar contraseña</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-4 text-center gap-3">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="font-medium text-gray-800">Contraseña actualizada</p>
            <p className="text-sm text-gray-500">Tu contraseña fue cambiada exitosamente.</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-unphu-800 text-white rounded-lg text-sm font-medium hover:bg-unphu-700"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {(['current', 'next', 'confirm'] as const).map((field) => {
              const labels = { current: 'Contraseña actual', next: 'Nueva contraseña', confirm: 'Confirmar nueva contraseña' };
              return (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{labels[field]}</label>
                  <div className="relative">
                    <input
                      type={show[field] ? 'text' : 'password'}
                      value={form[field]}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-unphu-800/30 focus:border-unphu-800"
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => toggle(field)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {show[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}

            {error && <p className="text-red-600 text-xs">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 bg-unphu-800 text-white rounded-lg text-sm font-medium hover:bg-unphu-700 disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
