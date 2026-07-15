'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { usersApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Users, Plus, X, Search, CheckCircle, XCircle, Edit2 } from 'lucide-react';

const ROLES = ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN', 'DIRECTOR', 'REGISTRO', 'COBROS', 'JURADO', 'EVALUATOR'] as const;
const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Estudiante', ADVISOR: 'Asesor', COORDINATOR: 'Coordinador',
  ADMIN: 'Admin', EVALUATOR: 'Evaluador', DIRECTOR: 'Director',
  REGISTRO: 'Dpto. Registro', COBROS: 'Dpto. Cobros', JURADO: 'Jurado',
};
const ROLE_COLORS: Record<string, string> = {
  STUDENT: 'bg-blue-100 text-blue-700', ADVISOR: 'bg-teal-100 text-teal-700',
  COORDINATOR: 'bg-purple-100 text-purple-700', ADMIN: 'bg-red-100 text-red-700',
  EVALUATOR: 'bg-orange-100 text-orange-700', DIRECTOR: 'bg-indigo-100 text-indigo-700',
  REGISTRO: 'bg-cyan-100 text-cyan-700', COBROS: 'bg-yellow-100 text-yellow-700',
  JURADO: 'bg-pink-100 text-pink-700',
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn: () => usersApi.list({ search, role: roleFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: usersApi.adminCreate,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.adminUpdate(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); setEditUser(null); },
  });

  const { register: regCreate, handleSubmit: handleCreate, reset: resetCreate, formState: { errors: errCreate } } = useForm<any>();
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit } = useForm<any>();

  const openEdit = (u: any) => {
    setEditUser(u);
    resetEdit({ role: u.role, isActive: u.isActive });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">{users?.length ?? 0} usuarios registrados</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..." className="input pl-9 text-sm" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input w-auto text-sm">
          <option value="">Todos los roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Último acceso</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users?.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Activo</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle className="w-3.5 h-3.5" /> Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{u.lastLogin ? formatDate(u.lastLogin) : 'Nunca'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(u)} className="text-unphu-600 hover:text-unphu-700 p-1.5 rounded hover:bg-unphu-50">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900 text-lg">Crear usuario</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate((d) => createMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre *</label>
                  <input {...regCreate('firstName', { required: true })} className="input" placeholder="Juan" />
                  {errCreate.firstName && <p className="text-xs text-red-600 mt-1">Requerido</p>}
                </div>
                <div>
                  <label className="label">Apellido *</label>
                  <input {...regCreate('lastName', { required: true })} className="input" placeholder="Pérez" />
                  {errCreate.lastName && <p className="text-xs text-red-600 mt-1">Requerido</p>}
                </div>
              </div>
              <div>
                <label className="label">Correo *</label>
                <input {...regCreate('email', { required: true })} type="email" className="input" placeholder="juan.perez@unphu.edu.do" />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input {...regCreate('phone')} className="input" placeholder="809-555-0001" />
              </div>
              <div>
                <label className="label">Contraseña *</label>
                <input {...regCreate('password', { required: true, minLength: 8 })} type="password" className="input" placeholder="Mínimo 8 caracteres" />
              </div>
              <div>
                <label className="label">Rol *</label>
                <select {...regCreate('role', { required: true })} className="input">
                  <option value="">-- Seleccionar --</option>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {createMutation.isError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {(createMutation.error as any)?.response?.data?.message || 'Error al crear usuario'}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creando...' : 'Crear usuario'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Editar usuario</h2>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">{editUser.firstName} {editUser.lastName} — {editUser.email}</p>
            <form onSubmit={handleEdit((d) => updateMutation.mutate({ id: editUser.id, data: d }))} className="space-y-4">
              <div>
                <label className="label">Rol</label>
                <select {...regEdit('role')} className="input">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Estado</label>
                <select {...regEdit('isActive', { setValueAs: (v) => v === 'true' })} className="input">
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={() => setEditUser(null)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
