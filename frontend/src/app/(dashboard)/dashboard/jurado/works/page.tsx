'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { thesisApi } from '@/lib/api';
import { GraduationCap } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'PRESENTATION_SCHEDULED', label: 'Presentación programada' },
  { value: 'PRESENTATION_DONE', label: 'Presentación realizada' },
  { value: 'GRADED', label: 'Calificado' },
  { value: '', label: 'Todos' },
];

export default function JuradoWorksPage() {
  const [status, setStatus] = useState('PRESENTATION_SCHEDULED');

  const { data, isLoading } = useQuery({
    queryKey: ['jurado-works', status],
    queryFn: () => thesisApi.list({ status: status || undefined, limit: 50 }),
  });

  const works = data?.data ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trabajos a Calificar</h1>
        <p className="text-gray-500 text-sm mt-1">Trabajos de grado asignados para evaluación por jurado</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_OPTIONS.map((s) => (
          <button key={s.value} onClick={() => setStatus(s.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${status === s.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
        </div>
      ) : works.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No hay trabajos en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-4">
          {works.map((w: any) => (
            <div key={w.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-gray-900">{w.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {w.student?.user?.firstName} {w.student?.user?.lastName} · {w.career?.name}
                  </p>
                  {w.presentation?.scheduledAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Presentación: {new Date(w.presentation.scheduledAt).toLocaleDateString('es-DO', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                      })}
                      {w.presentation.location && ` · ${w.presentation.location}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge bg-purple-100 text-purple-700">
                    {w.status === 'PRESENTATION_SCHEDULED' ? 'Programada'
                      : w.status === 'PRESENTATION_DONE' ? 'Realizada'
                      : w.status === 'GRADED' ? 'Calificado' : w.status}
                  </span>
                  <a href={`/dashboard/jurado/works/${w.id}`}
                    className="px-3 py-1.5 bg-unphu-700 hover:bg-unphu-800 text-white text-xs font-medium rounded-lg">
                    Ver y calificar
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
