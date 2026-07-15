'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { thesisApi, presentationsApi } from '@/lib/api';
import { GraduationCap, Star } from 'lucide-react';

export default function JuradoWorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: work, isLoading } = useQuery({
    queryKey: ['thesis-work', id],
    queryFn: () => thesisApi.get(id),
    enabled: !!id,
  });

  const { data: grades } = useQuery({
    queryKey: ['grades', id],
    queryFn: () => presentationsApi.getGrades(id),
    enabled: !!id,
  });

  const [gradeForm, setGradeForm] = useState({
    evaluatorName: '',
    writtenGrade: '',
    oralGrade: '',
    observations: '',
  });

  const gradeMutation = useMutation({
    mutationFn: (data: any) => presentationsApi.recordGrade(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades', id] });
      setGradeForm({ evaluatorName: '', writtenGrade: '', oralGrade: '', observations: '' });
    },
  });

  const handleSubmitGrade = (e: React.FormEvent) => {
    e.preventDefault();
    gradeMutation.mutate({
      evaluatorName: gradeForm.evaluatorName,
      writtenGrade: gradeForm.writtenGrade ? parseFloat(gradeForm.writtenGrade) : undefined,
      oralGrade: gradeForm.oralGrade ? parseFloat(gradeForm.oralGrade) : undefined,
      observations: gradeForm.observations || undefined,
    });
  };

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
    </div>
  );

  if (!work) return <p className="text-center py-16 text-gray-400">Trabajo no encontrado</p>;

  const avgGrade = grades?.length
    ? grades.reduce((sum: number, g: any) => sum + (g.finalGrade ?? ((g.writtenGrade ?? 0) + (g.oralGrade ?? 0)) / 2), 0) / grades.length
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <a href="/dashboard/jurado/works" className="text-sm text-unphu-600 hover:underline">← Volver</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{work.title}</h1>
        <p className="text-gray-500 text-sm">
          {work.student?.user?.firstName} {work.student?.user?.lastName} · {work.career?.name} · {work.type}
        </p>
      </div>

      {work.presentation && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-2">Datos de la presentación</h2>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Fecha:</span>{' '}
            {new Date(work.presentation.scheduledAt).toLocaleDateString('es-DO', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
          {work.presentation.location && (
            <p className="text-sm text-gray-600"><span className="font-medium">Lugar:</span> {work.presentation.location}</p>
          )}
          {work.presentation.virtualLink && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Enlace:</span>{' '}
              <a href={work.presentation.virtualLink} target="_blank" rel="noopener noreferrer" className="text-unphu-600 hover:underline">
                {work.presentation.virtualLink}
              </a>
            </p>
          )}
        </div>
      )}

      {work.abstract && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-2">Resumen</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{work.abstract}</p>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Calificaciones registradas</h2>
          {avgGrade !== null && (
            <span className="text-lg font-bold text-unphu-700">Promedio: {avgGrade.toFixed(1)}</span>
          )}
        </div>
        {!grades?.length ? (
          <p className="text-sm text-gray-400 text-center py-4">No hay calificaciones registradas</p>
        ) : (
          <div className="space-y-3">
            {grades.map((g: any) => (
              <div key={g.id} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{g.evaluatorName}</p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    {g.writtenGrade != null && <span>Escrita: <strong>{g.writtenGrade}</strong></span>}
                    {g.oralGrade != null && <span>Oral: <strong>{g.oralGrade}</strong></span>}
                    {g.finalGrade != null && <span className="text-unphu-700 font-semibold">Final: <strong>{g.finalGrade}</strong></span>}
                    {g.approved != null && (
                      <span className={g.approved ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {g.approved ? 'Aprobado' : 'No aprobado'}
                      </span>
                    )}
                  </div>
                  {g.observations && <p className="text-xs text-gray-500 mt-1 italic">{g.observations}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {['PRESENTATION_SCHEDULED', 'PRESENTATION_DONE'].includes(work.status) && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Registrar calificación</h2>
          <form onSubmit={handleSubmitGrade} className="space-y-4">
            <div>
              <label className="label text-xs">Nombre del evaluador</label>
              <input value={gradeForm.evaluatorName}
                onChange={(e) => setGradeForm((p) => ({ ...p, evaluatorName: e.target.value }))}
                required placeholder="Tu nombre completo" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-xs">Nota escrita (0-100)</label>
                <input type="number" min="0" max="100" step="0.1"
                  value={gradeForm.writtenGrade}
                  onChange={(e) => setGradeForm((p) => ({ ...p, writtenGrade: e.target.value }))}
                  placeholder="Ej. 85" className="input" />
              </div>
              <div>
                <label className="label text-xs">Nota oral (0-100)</label>
                <input type="number" min="0" max="100" step="0.1"
                  value={gradeForm.oralGrade}
                  onChange={(e) => setGradeForm((p) => ({ ...p, oralGrade: e.target.value }))}
                  placeholder="Ej. 90" className="input" />
              </div>
            </div>
            <div>
              <label className="label text-xs">Observaciones</label>
              <textarea value={gradeForm.observations}
                onChange={(e) => setGradeForm((p) => ({ ...p, observations: e.target.value }))}
                placeholder="Comentarios sobre el trabajo..." rows={3} className="input resize-none" />
            </div>
            <button type="submit" disabled={gradeMutation.isPending || !gradeForm.evaluatorName}
              className="px-6 py-2 bg-unphu-700 hover:bg-unphu-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
              {gradeMutation.isPending ? 'Guardando...' : 'Registrar calificación'}
            </button>
            {gradeMutation.isError && (
              <p className="text-sm text-red-600">Error al guardar. Intenta de nuevo.</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
