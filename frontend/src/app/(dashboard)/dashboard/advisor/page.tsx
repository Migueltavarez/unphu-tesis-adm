'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { advisorsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import { getAdvisorAction } from '@/lib/advisorActions';
import StatusBadge from '@/components/ui/StatusBadge';
import ProcessTimeline from '@/components/ui/ProcessTimeline';
import { FileText, Upload, Clock, CheckCircle, ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { ThesisWork } from '@/types';

export default function AdvisorDashboard() {
  const { user } = useAuthStore();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['advisor-profile'],
    queryFn: advisorsApi.myProfile,
    enabled: !!user,
    retry: false,
  });

  const works = profile?.thesisWorks || [];
  const activeWorks = works.filter((w: ThesisWork) => !['APPROVED', 'PUBLISHED', 'REJECTED'].includes(w.status));
  const completedWorks = works.filter((w: ThesisWork) => ['APPROVED', 'PUBLISHED'].includes(w.status));

  // Cola de "requieren tu acción": trabajos asignados donde es turno del asesor.
  const actionQueue = works
    .map((w: ThesisWork) => ({ work: w, action: getAdvisorAction(w.status) }))
    .filter((x: any) => x.action)
    .sort((a: any, b: any) =>
      a.action.order - b.action.order ||
      new Date(a.work.updatedAt).getTime() - new Date(b.work.updatedAt).getTime(),
    );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card p-8 text-center">
          <BookOpen className="w-14 h-14 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Completa tu perfil de asesor</h2>
          <p className="text-gray-500 mb-6 text-sm">
            Antes de comenzar debes registrar tu departamento y especialidades.
          </p>
          <Link href="/dashboard/advisor/profile" className="btn-primary inline-flex items-center gap-2">
            Completar perfil <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel del Asesor</h1>
        <p className="text-gray-500 text-sm mt-1">
          {profile?.department && `${profile.department} · `}
          {works.length}/{profile?.maxWorkload || 5} trabajos asignados
        </p>
      </div>

      {/* ── Requieren tu acción ──────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-unphu-600" />
            Requieren tu acción
            {actionQueue.length > 0 && (
              <span className="bg-unphu-100 text-unphu-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {actionQueue.length}
              </span>
            )}
          </h2>
          <Link href="/dashboard/advisor/works" className="text-sm text-unphu-600 hover:underline inline-flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {actionQueue.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-300" />
            <p className="text-sm font-medium text-gray-600">Todo al día</p>
            <p className="text-xs">No hay trabajos esperando tu revisión ahora mismo.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {actionQueue.map(({ work, action }: any) => (
              <Link
                key={work.id}
                href={`/dashboard/advisor/works/${work.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border border-gray-100 hover:border-unphu-200 hover:bg-unphu-50/40 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-unphu-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-unphu-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{work.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {work.student?.user?.firstName} {work.student?.user?.lastName} · {work.career?.code} · {formatDate(work.updatedAt)}
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-unphu-700 bg-unphu-100 group-hover:bg-unphu-200 rounded-full px-3 py-1.5 transition-colors">
                  {action.label} <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── KPIs secundarios ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-2">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeWorks.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">En proceso</p>
        </div>
        <div className="card p-4">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center mb-2">
            <Upload className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {works.filter((w: ThesisWork) => w.status === 'ADVANCES_SUBMITTED').length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Avances por revisar</p>
        </div>
        <div className="card p-4">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedWorks.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Completados</p>
        </div>
      </div>

      {/* ── Trabajos en proceso (referencia) ─────────────────────────────── */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Trabajos en proceso</h2>

        {activeWorks.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">No tienes trabajos activos asignados</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {activeWorks.map((w: ThesisWork) => (
              <Link
                key={w.id}
                href={`/dashboard/advisor/works/${w.id}`}
                className="border border-gray-200 rounded-xl p-5 hover:border-unphu-300 hover:shadow-sm transition-all block"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{w.title}</h3>
                  <StatusBadge status={w.status} />
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {w.student?.user?.firstName} {w.student?.user?.lastName} · {w.career?.name}
                </p>
                <ProcessTimeline currentStatus={w.status} compact />
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Upload className="w-3 h-3" /> {w._count?.advances || 0} avances</span>
                  <span>Actualizado {formatDate(w.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Especialidades */}
      {profile?.specialties?.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Mis especialidades</h2>
          <div className="flex flex-wrap gap-2">
            {profile.specialties.map((s: string) => (
              <span key={s} className="badge bg-unphu-50 text-unphu-700">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
