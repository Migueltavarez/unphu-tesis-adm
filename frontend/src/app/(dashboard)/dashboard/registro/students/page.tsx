'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '@/lib/api';
import { CheckCircle, XCircle, UserCheck } from 'lucide-react';

export default function RegistroStudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['students-all', search],
    queryFn: () => studentsApi.list({ search: search || undefined }),
  });

  const eligibilityMutation = useMutation({
    mutationFn: ({ id, isEligible, notes }: { id: string; isEligible: boolean; notes?: string }) =>
      studentsApi.validateEligibility(id, isEligible, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['students-all'] }),
  });

  const students = data?.data ?? data ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Elegibilidad de Estudiantes</h1>
        <p className="text-gray-500 text-sm mt-1">Validar la aptitud académica para optar al trabajo de grado</p>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre o matrícula..." className="input w-full" />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
        </div>
      ) : students.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No hay estudiantes registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((s: any) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-gray-900">
                    {s.user?.firstName} {s.user?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    Mat. {s.matricula} · {s.career?.name} · {s.creditsApproved} créditos
                    {s.gpa && ` · GPA ${s.gpa.toFixed(2)}`}
                  </p>
                </div>
                <span className={`badge ${s.isEligible ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {s.isEligible ? 'Elegible' : 'Pendiente validación'}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 items-center flex-wrap">
                <input
                  value={notes[s.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  placeholder="Nota opcional..."
                  className="input text-sm flex-1 min-w-[160px]"
                />
                <button
                  onClick={() => eligibilityMutation.mutate({ id: s.id, isEligible: true, notes: notes[s.id] })}
                  disabled={s.isEligible || eligibilityMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg"
                >
                  <CheckCircle className="w-4 h-4" /> Aprobar
                </button>
                <button
                  onClick={() => eligibilityMutation.mutate({ id: s.id, isEligible: false, notes: notes[s.id] })}
                  disabled={!s.isEligible || eligibilityMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg"
                >
                  <XCircle className="w-4 h-4" /> Revocar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
