'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { studentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { STUDENT_PHASES, getStudentGuidance } from '@/lib/studentGuidance';
import PhaseStepper from '@/components/ui/PhaseStepper';
import { AlertCircle, ArrowRight, Clock, UserCog, GraduationCap } from 'lucide-react';

// Estilos por tono de la tarjeta "Tu siguiente paso"
const TONE: Record<string, { ring: string; pill: string; btn: string }> = {
  action:   { ring: 'border-unphu-200 bg-unphu-50/40', pill: 'bg-unphu-100 text-unphu-700', btn: 'btn-primary' },
  waiting:  { ring: 'border-amber-200 bg-amber-50/50',  pill: 'bg-amber-100 text-amber-700', btn: 'btn-primary' },
  success:  { ring: 'border-emerald-200 bg-emerald-50/50', pill: 'bg-emerald-100 text-emerald-700', btn: 'btn-primary' },
  rejected: { ring: 'border-red-200 bg-red-50/50', pill: 'bg-red-100 text-red-700', btn: 'btn-primary' },
};

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

  const guidance = activeWork ? getStudentGuidance(activeWork.status, activeWork.id) : null;
  const tone = guidance ? TONE[guidance.tone] : TONE.action;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hola, {user?.firstName} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">{profile.career?.name} · Matrícula {profile.matricula}</p>
      </div>

      {/* ── Sin trabajo activo ─────────────────────────────────────────────── */}
      {!activeWork && (
        <>
          {!profile.isEligible ? (
            <div className="card p-8 text-center border-amber-200 bg-amber-50/40">
              <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-900 mb-2">Estamos validando tu elegibilidad</h2>
              <p className="text-sm text-gray-600 mb-1">
                El Dpto. de Registro o Coordinación debe aprobar tu elegibilidad académica antes de que puedas postularte.
              </p>
              <p className="text-xs text-amber-700 mb-6">Te avisaremos cuando esté lista. No necesitas hacer nada por ahora.</p>
              <Link href="/dashboard/student/profile" className="btn-secondary inline-flex items-center gap-2 text-sm">
                <UserCog className="w-4 h-4" /> Revisar mi perfil
              </Link>
            </div>
          ) : (
            <div className="card p-8 text-center border-unphu-200 bg-unphu-50/40">
              <GraduationCap className="w-12 h-12 text-unphu-600 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-900 mb-2">¡Todo listo para empezar!</h2>
              <p className="text-sm text-gray-600 mb-6">Ya eres elegible. Inicia la postulación de tu trabajo de grado.</p>
              <Link href="/dashboard/student/thesis/new" className="btn-primary inline-flex items-center gap-2">
                Iniciar postulación <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </>
      )}

      {/* ── Con trabajo activo: TU SIGUIENTE PASO ──────────────────────────── */}
      {activeWork && guidance && (
        <>
          <div className={`card p-6 border ${tone.ring}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tone.pill}`}>
                Fase {guidance.phase + 1} de 6 · {STUDENT_PHASES[guidance.phase]}
              </span>
              <span className="text-xs text-gray-400">Tu siguiente paso</span>
            </div>

            <h2 className="text-xl font-bold text-gray-900">{guidance.title}</h2>
            <p className="text-sm text-gray-600 mt-1.5 max-w-2xl">{guidance.description}</p>

            <div className="mt-5">
              {guidance.action ? (
                <Link href={guidance.action.href} className={`${tone.btn} inline-flex items-center gap-2`}>
                  {guidance.action.label} <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <div className="flex items-start gap-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                  <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p>
                    Esperando a <span className="font-medium text-gray-800">{guidance.waitingOn}</span>.
                    No necesitas hacer nada por ahora — te avisaremos cuando avance.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Stepper de fases */}
          <div className="card p-6">
            <PhaseStepper current={guidance.phase} rejected={activeWork.status === 'REJECTED'} />
          </div>

          {/* Resumen compacto del trabajo */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Tu trabajo</p>
                <h3 className="font-semibold text-gray-900 mt-0.5">{activeWork.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {activeWork.type === 'TESIS' ? 'Tesis' : 'Monográfico'} · {activeWork.year}
                  {activeWork._count?.advances ? ` · ${activeWork._count.advances} avance${activeWork._count.advances !== 1 ? 's' : ''}` : ''}
                </p>
              </div>
              {activeWork.advisor && (
                <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {activeWork.advisor.user?.firstName?.[0]}{activeWork.advisor.user?.lastName?.[0]}
                  </div>
                  <div className="text-xs">
                    <p className="text-gray-500">Asesor</p>
                    <p className="font-medium text-gray-900">{activeWork.advisor.user?.firstName} {activeWork.advisor.user?.lastName}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Historial */}
      {profile.thesisWorks?.filter((w: any) => ['REJECTED', 'PUBLISHED', 'APPROVED'].includes(w.status)).length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Historial</h3>
          <div className="space-y-2">
            {profile.thesisWorks
              .filter((w: any) => ['REJECTED', 'PUBLISHED', 'APPROVED'].includes(w.status))
              .map((w: any) => {
                const g = getStudentGuidance(w.status, w.id);
                return (
                  <div key={w.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{w.title}</p>
                      <p className="text-xs text-gray-500">{w.year}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${TONE[g.tone].pill}`}>
                      {w.status === 'PUBLISHED' ? 'Publicado' : w.status === 'REJECTED' ? 'Rechazado' : 'Aprobado'}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
