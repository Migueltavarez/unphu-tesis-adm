'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { careersApi } from '@/lib/api';
import { BookOpen, Plus, X, Edit2, CheckCircle, XCircle } from 'lucide-react';

export default function AdminCareersPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editCareer, setEditCareer] = useState<any>(null);

  const { data: careers, isLoading } = useQuery({ queryKey: ['careers-admin'], queryFn: careersApi.list });

  const createMutation = useMutation({
    mutationFn: careersApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['careers-admin'] }); queryClient.invalidateQueries({ queryKey: ['careers'] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => careersApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['careers-admin'] }); queryClient.invalidateQueries({ queryKey: ['careers'] }); setEditCareer(null); },
  });

  const { register: regC, handleSubmit: handleC, reset: resetC, formState: { errors: errC } } = useForm<any>();
  const { register: regE, handleSubmit: handleE, reset: resetE } = useForm<any>();

  const openEdit = (c: any) => {
    setEditCareer(c);
    resetE({ name: c.name, code: c.code, description: c.description, isActive: String(c.isActive) });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carreras</h1>
          <p className="text-gray-500 text-sm mt-1">Carreras académicas activas en el sistema</p>
        </div>
        <button onClick={() => { setShowCreate(true); resetC({}); }} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva carrera
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {careers?.map((c: any) => (
            <div key={c.id} className="card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-unphu-50 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-unphu-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <span className="badge bg-unphu-50 text-unphu-700 font-mono">{c.code}</span>
                  {c.isActive ? (
                    <span className="badge bg-green-100 text-green-700">Activa</span>
                  ) : (
                    <span className="badge bg-gray-100 text-gray-500">Inactiva</span>
                  )}
                </div>
                {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {c._count?.students ?? 0} estudiantes · {c._count?.thesisWorks ?? 0} trabajos
                </p>
              </div>
              <button onClick={() => openEdit(c)} className="text-unphu-600 hover:text-unphu-700 p-1.5 rounded hover:bg-unphu-50">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900 text-lg">Nueva carrera</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleC((d) => createMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input {...regC('name', { required: true })} className="input" placeholder="Ingeniería en Sistemas" />
                {errC.name && <p className="text-xs text-red-600 mt-1">Requerido</p>}
              </div>
              <div>
                <label className="label">Código *</label>
                <input {...regC('code', { required: true })} className="input" placeholder="ISC" />
                {errC.code && <p className="text-xs text-red-600 mt-1">Requerido</p>}
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea {...regC('description')} className="input" rows={2} placeholder="Descripción breve de la carrera" />
              </div>
              {createMutation.isError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {(createMutation.error as any)?.response?.data?.message || 'Error al crear carrera'}
                </p>
              )}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creando...' : 'Crear carrera'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editCareer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900 text-lg">Editar carrera</h2>
              <button onClick={() => setEditCareer(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleE((d) => updateMutation.mutate({ id: editCareer.id, data: { ...d, isActive: d.isActive === 'true' } }))} className="space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input {...regE('name')} className="input" />
              </div>
              <div>
                <label className="label">Código</label>
                <input {...regE('code')} className="input" />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea {...regE('description')} className="input" rows={2} />
              </div>
              <div>
                <label className="label">Estado</label>
                <select {...regE('isActive')} className="input">
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={() => setEditCareer(null)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
