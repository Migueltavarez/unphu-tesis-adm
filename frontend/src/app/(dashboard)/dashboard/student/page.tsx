'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { studentsApi, thesisApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import ProcessTimeline from '@/components/ui/ProcessTimeline';
import { FileText, Upload, CreditCard, AlertCircle, ArrowRight, CheckCircle, UserCog } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuthStore();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentsApi.myProfile,
    enabled: !!user,
  });

  const activeWork = profile?.thesisWorks?.find(
    (w: any) => !['REJECTED', 'PUBLISHED'].includes(w.status),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Sin perfil de estudiante
  if (!profile) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card p-8 text-center">
          <AlertCircle className="w-14 h-14 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Completa tu perfil académico</h2>
          <p className="text-gray-500 mb-6 text-sm">
            Antes de iniciar tu trabajo de grado debes registrar tu matrícula y carrera.
          </p>
          <Link href="/dashboard/student/profile" className="btn-primary inline-flex items-center gap-2">
            Completar perfil <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Eligibility warning */}
      {!profile.isEligible && !activeWork && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">Elegibilidad pendiente de validación</p>
            <p className="text-xs text-amber-700 mt-0.5">
              El Departamento de Registro o Coordinación debe validar tu elegibilidad académica antes de que puedas iniciar tu postulación.
            </p>
          </div>
          <Link href="/dashboard/student/profile" className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900">
            <UserCog className="w-3.5 h-3.5" /> Ver perfil
          </Link>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user?.firstName} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {profile.career?.name} · Matrícula {profile.matricula}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Estado', value: activeWork ? STATUS_LABELS[activeWork.status] : 'Sin trabajo', icon: FileText, color: 'text-blue-600 bg-blue-50' },
          { label: 'Avances enviados', value: activeWork?._count?.advances || 0, icon: Upload, color: 'text-teal-600 bg-teal-50' },
          { label: 'Documentos', value: activeWork?._count?.documents || 0, icon: FileText, color: 'text-purple-600 bg-purple-50' },
          { label: 'Pago', value: activeWork?.payment?.status || 'N/A', icon: CreditCard, color: 'text-orange-600 bg-orange-50' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="font-semibold text-gray-900 mt-0.5 text-sm truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Work + Timeline */}
      {activeWork ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Trabajo actual */}
          <div className="lg:col-span-2 card p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{activeWork.title}</h2>
                <p className="text-sm text-gray-500 mt-1">{activeWork.type === 'TESIS' ? 'Tesis' : 'Monográfico'} · {activeWork.year}</p>
              </div>
              <StatusBadge status={activeWork.status} />
            </div>

            {activeWork.abstract && (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{activeWork.abstract}</p>
            )}

            {activeWork.advisor && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  {activeWork.advisor.user?.firstName?.[0]}{activeWork.advisor.user?.lastName?.[0]}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Asesor asignado</p>
                  <p className="text-sm font-medium text-gray-900">
                    {activeWork.advisor.user?.firstName} {activeWork.advisor.user?.lastName}
                  </p>
                </div>
              </div>
            )}

            {/* Acciones rápidas */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/dashboard/student/thesis" className="btn-primary text-sm py-1.5 px-4 inline-flex items-center gap-1.5">
                Ver detalle <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/dashboard/student/advances" className="btn-secondary text-sm py-1.5 px-4 inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Enviar avance
              </Link>
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">Progreso del proceso</h3>
            <ProcessTimeline currentStatus={activeWork.status} />
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-700 mb-2">No tienes un trabajo de grado activo</h3>
          <p className="text-sm text-gray-500 mb-5">
            {profile.isEligible
              ? 'Puedes iniciar tu postulación ahora.'
              : 'Debes cumplir los requisitos académicos para iniciar.'}
          </p>
          {profile.isEligible && (
            <Link href="/dashboard/student/thesis/new" className="btn-primary inline-flex items-center gap-2">
              Iniciar postulación <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          {!profile.isEligible && (
            <div className="flex items-center gap-2 justify-center text-yellow-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              Eligibilidad pendiente de aprobación por coordinación
            </div>
          )}
        </div>
      )}

      {/* Trabajos anteriores */}
      {profile.thesisWorks?.filter((w: any) => ['REJECTED', 'PUBLISHED', 'APPROVED'].includes(w.status)).length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Historial</h3>
          <div className="space-y-3">
            {profile.thesisWorks
              .filter((w: any) => ['REJECTED', 'PUBLISHED', 'APPROVED'].includes(w.status))
              .map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{w.title}</p>
                    <p className="text-xs text-gray-500">{w.year}</p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
