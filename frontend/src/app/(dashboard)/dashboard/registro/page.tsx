'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi, thesisApi } from '@/lib/api';
import { UserCheck, Clock, CheckCircle, FileCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegistroDashboard() {
  const queryClient = useQueryClient();

  const { data: students } = useQuery({
    queryKey: ['students-all'],
    queryFn: () => studentsApi.list(),
  });

  // Works sent from Coordinator to Registro for processing
  const { data: processingData, isLoading: loadingProcessing } = useQuery({
    queryKey: ['registro-processing'],
    queryFn: () => thesisApi.list({ status: 'REGISTRO_PROCESSING' }),
  });

  const registerMutation = useMutation({
    mutationFn: (id: string) =>
      thesisApi.updateStatus(id, 'REGISTERED', 'Registro completado por Dpto. de Registro'),
    onSuccess: () => {
      toast.success('Trabajo marcado como Registrado');
      queryClient.invalidateQueries({ queryKey: ['registro-processing'] });
    },
    onError: () => toast.error('Error al actualizar el estado'),
  });

  const list = students?.data ?? students ?? [];
  const eligible = list.filter((s: any) => s.isEligible).length;
  const pending = list.filter((s: any) => !s.isEligible).length;
  const processing = processingData?.data ?? processingData ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Departamento de Registro</h1>
        <p className="text-gray-500 text-sm mt-1">Validación académica y procesamiento de registro de trabajos de grado</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{list.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total estudiantes</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{eligible}</p>
          <p className="text-xs text-gray-500 mt-1">Elegibles</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-orange-600">{processing.length}</p>
          <p className="text-xs text-gray-500 mt-1">En proceso</p>
        </div>
      </div>

      {/* Works awaiting Registro processing */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-sky-600" />
          Propuestas para registrar
          {processing.length > 0 && (
            <span className="ml-1 bg-sky-100 text-sky-700 text-xs font-bold px-2 py-0.5 rounded-full">{processing.length}</span>
          )}
        </h2>

        {loadingProcessing ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin w-6 h-6 border-2 border-unphu-600 border-t-transparent rounded-full" />
          </div>
        ) : processing.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No hay propuestas en proceso de registro</p>
        ) : (
          <div className="space-y-3">
            {processing.map((w: any) => (
              <div key={w.id} className="flex items-start gap-4 p-4 bg-sky-50 rounded-lg border border-sky-100">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">
                    {w.student?.user?.firstName} {w.student?.user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Matrícula: <span className="font-medium">{w.student?.matricula}</span>
                    {' · '}{w.career?.name}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">{w.title}</p>
                  {w.firma && (
                    <p className="text-xs text-gray-500 mt-1">
                      Firma: <span className="font-medium italic">{w.firma}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => registerMutation.mutate(w.id)}
                  disabled={registerMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg flex-shrink-0"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Registrar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Eligibility */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-blue-600" />
          Validación de elegibilidad académica
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Revisa y aprueba la elegibilidad académica de estudiantes para iniciar su postulación.
        </p>
        <a
          href="/dashboard/registro/students"
          className="inline-flex items-center gap-2 px-4 py-2 bg-unphu-700 hover:bg-unphu-800 text-white text-sm font-medium rounded-lg"
        >
          <UserCheck className="w-4 h-4" /> Ver estudiantes
        </a>
      </div>
    </div>
  );
}
