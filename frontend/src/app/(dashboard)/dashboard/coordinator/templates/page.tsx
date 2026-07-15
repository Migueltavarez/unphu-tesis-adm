'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { templatesApi, careersApi } from '@/lib/api';
import { Plus, BookOpen, Pencil, Trash2, Star, StarOff, ChevronRight } from 'lucide-react';

export default function TemplatesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCareerId, setNewCareerId] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.list(),
  });

  const { data: careers = [] } = useQuery({
    queryKey: ['careers'],
    queryFn: () => careersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => templatesApi.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewCareerId('');
      router.push(`/dashboard/coordinator/templates/${created.id}`);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => templatesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: ({ id, careerId }: { id: string; careerId: string }) =>
      templatesApi.setDefault(id, careerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName, description: newDesc, careerId: newCareerId || undefined });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plantillas de documento</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Define las secciones que tendrá el documento de tesis por carrera
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva plantilla
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Crear nueva plantilla</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Ej: Plantilla Ingeniería en Sistemas"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Carrera (opcional)</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newCareerId}
                onChange={(e) => setNewCareerId(e.target.value)}
              >
                <option value="">— Sin carrera específica —</option>
                {(careers as any[]).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Descripción opcional..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creando...' : 'Crear y editar secciones'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Cargando plantillas...</div>
      ) : (templates as any[]).length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No hay plantillas aún. Crea la primera.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(templates as any[]).map((t: any) => (
            <div
              key={t.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">{t.name}</span>
                    {t.isDefault && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                        Por defecto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {t.career && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{t.career.name}</span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {t.sections?.length ?? 0} secciones
                    </span>
                    {t.description && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{t.description}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-4">
                {t.career && !t.isDefault && (
                  <button
                    onClick={() => setDefaultMutation.mutate({ id: t.id, careerId: t.career.id })}
                    title="Establecer como plantilla por defecto para esta carrera"
                    className="p-2 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <StarOff className="w-4 h-4" />
                  </button>
                )}
                {t.career && t.isDefault && (
                  <span className="p-2 text-amber-500">
                    <Star className="w-4 h-4 fill-amber-500" />
                  </span>
                )}
                <button
                  onClick={() => router.push(`/dashboard/coordinator/templates/${t.id}`)}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar la plantilla "${t.name}"?`)) removeMutation.mutate(t.id);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => router.push(`/dashboard/coordinator/templates/${t.id}`)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
