'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi, careersApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Users, Search, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function CoordinatorStudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [careerId, setCareerId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eligNotes, setEligNotes] = useState('');

  const { data: students, isLoading } = useQuery({
    queryKey: ['coordinator-students', search, careerId],
    queryFn: () => studentsApi.list({ search, careerId: careerId || undefined }),
  });

  const { data: careers } = useQuery({ queryKey: ['careers'], queryFn: careersApi.list });

  const eligMutation = useMutation({
    mutationFn: ({ id, isEligible, notes }: { id: string; isEligible: boolean; notes?: string }) =>
      studentsApi.validateEligibility(id, isEligible, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinator-students'] });
      setEditingId(null);
      setEligNotes('');
    },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estudiantes</h1>
        <p className="text-gray-500 text-sm mt-1">{students?.length ?? 0} estudiantes registrados</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o matrícula..." className="input pl-9 text-sm" />
        </div>
        <select value={careerId} onChange={(e) => setCareerId(e.target.value)} className="input w-auto text-sm">
          <option value="">Todas las carreras</option>
          {careers?.map((c: any) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
          </div>
        ) : students?.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">No se encontraron estudiantes</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estudiante</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Matrícula</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Carrera</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Créditos</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trabajos</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Elegibilidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students?.map((s: any) => (
                <>
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.user?.firstName} {s.user?.lastName}</p>
                      <p className="text-xs text-gray-400">{s.user?.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{s.matricula}</td>
                    <td className="px-4 py-3 text-gray-600">{s.career?.code || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.creditsApproved ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s._count?.thesisWorks ?? 0}</td>
                    <td className="px-4 py-3">
                      {editingId === s.id ? (
                        <div className="flex flex-col gap-2">
                          <input value={eligNotes} onChange={(e) => setEligNotes(e.target.value)}
                            placeholder="Nota..." className="input text-xs py-1" />
                          <div className="flex gap-1">
                            <button onClick={() => eligMutation.mutate({ id: s.id, isEligible: true, notes: eligNotes })}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded">Aprobar</button>
                            <button onClick={() => eligMutation.mutate({ id: s.id, isEligible: false, notes: eligNotes })}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded">Rechazar</button>
                            <button onClick={() => setEditingId(null)}
                              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setEditingId(s.id)} className="flex items-center gap-1.5 text-xs">
                          {s.isEligible ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-3.5 h-3.5" /> Elegible
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <Clock className="w-3.5 h-3.5" /> Pendiente
                            </span>
                          )}
                          <span className="text-gray-400 underline ml-1">cambiar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
