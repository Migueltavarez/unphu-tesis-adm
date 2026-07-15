'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { advisorsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import { FileText, Clock, ArrowRight } from 'lucide-react';

export default function AdvisorWorksPage() {
  const { user } = useAuthStore();

  const { data: works, isLoading } = useQuery({
    queryKey: ['advisor-works'],
    queryFn: advisorsApi.myWorks,
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trabajos asignados</h1>
        <p className="text-gray-500 text-sm mt-1">
          {works?.length ?? 0} trabajo{works?.length !== 1 ? 's' : ''} bajo tu asesoría
        </p>
      </div>

      {works?.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No tienes trabajos asignados actualmente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {works?.map((w: any) => (
            <Link
              key={w.id}
              href={`/dashboard/advisor/works/${w.id}`}
              className="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow block"
            >
              <div className="w-10 h-10 rounded-xl bg-unphu-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-unphu-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-gray-900 line-clamp-1">{w.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {w.student?.user?.firstName} {w.student?.user?.lastName} · {w.career?.name}
                    </p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Actualizado {formatDate(w.updatedAt)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {w._count?.advances ?? 0} avance{w._count?.advances !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 self-center flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
