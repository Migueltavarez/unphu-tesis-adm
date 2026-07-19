'use client';
import { useQuery } from '@tanstack/react-query';
import { thesisApi } from '@/lib/api';
import { GraduationCap, FileText } from 'lucide-react';

export default function JuradoDashboard() {
  const { data } = useQuery({
    queryKey: ['thesis-works-jurado'],
    queryFn: () => thesisApi.list({ status: 'PRESENTATION_SCHEDULED', limit: 10 }),
  });

  const { data: doneData } = useQuery({
    queryKey: ['thesis-works-jurado-done'],
    queryFn: () => thesisApi.list({ status: 'PRESENTATION_DONE', limit: 10 }),
  });

  const { data: gradedData } = useQuery({
    queryKey: ['thesis-works-jurado-graded'],
    queryFn: () => thesisApi.list({ status: 'GRADED', limit: 10 }),
  });

  const scheduled = data?.data ?? [];
  const toGrade = [...(doneData?.data ?? []), ...(gradedData?.data ?? [])];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Jurado</h1>
        <p className="text-gray-500 text-sm mt-1">Trabajos asignados para evaluación y calificación</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-unphu-700">{scheduled.length}</p>
          <p className="text-xs text-gray-500 mt-1">Presentaciones programadas</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-purple-700">{toGrade.length}</p>
          <p className="text-xs text-gray-500 mt-1">Pendientes de calificación</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Próximas presentaciones</h2>
        {scheduled.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <GraduationCap className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No hay presentaciones programadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduled.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{w.title}</p>
                  <p className="text-xs text-gray-500">
                    {w.student?.user?.firstName} {w.student?.user?.lastName}
                    {w.presentation?.scheduledAt && ` · ${new Date(w.presentation.scheduledAt).toLocaleDateString('es-DO')}`}
                  </p>
                </div>
                <a href={`/dashboard/jurado/works/${w.id}`}
                  className="text-xs text-unphu-600 hover:underline shrink-0">
                  Ver detalles
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {toGrade.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Pendientes de calificación</h2>
          <div className="space-y-3">
            {toGrade.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{w.title}</p>
                  <p className="text-xs text-gray-500">
                    {w.student?.user?.firstName} {w.student?.user?.lastName}
                    {w.presentation?.scheduledAt && ` · ${new Date(w.presentation.scheduledAt).toLocaleDateString('es-DO')}`}
                  </p>
                </div>
                <a href={`/dashboard/jurado/works/${w.id}`}
                  className="text-xs text-purple-600 hover:underline shrink-0">
                  Calificar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Todos los trabajos a calificar</h2>
        <p className="text-sm text-gray-500 mb-4">Accede al listado completo de trabajos asignados para evaluación.</p>
        <a href="/dashboard/jurado/works"
          className="inline-flex items-center gap-2 px-4 py-2 bg-unphu-700 hover:bg-unphu-800 text-white text-sm font-medium rounded-lg">
          <FileText className="w-4 h-4" /> Ver todos los trabajos
        </a>
      </div>
    </div>
  );
}
