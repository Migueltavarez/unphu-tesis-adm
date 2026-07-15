'use client';
import { useQuery } from '@tanstack/react-query';
import { advisorsApi } from '@/lib/api';
import { UserCheck, Briefcase } from 'lucide-react';

export default function CoordinatorAdvisorsPage() {
  const { data: advisors, isLoading } = useQuery({
    queryKey: ['advisors-list'],
    queryFn: advisorsApi.list,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asesores</h1>
        <p className="text-gray-500 text-sm mt-1">{advisors?.length ?? 0} asesores activos</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
        </div>
      ) : advisors?.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No hay asesores registrados</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {advisors?.map((a: any) => {
            const worksCount = a.worksCount ?? a._count?.thesisWorks ?? 0;
            const capacity = a.maxWorkload || 5;
            const pct = Math.min(100, Math.round((worksCount / capacity) * 100));
            const full = worksCount >= capacity;

            return (
              <div key={a.id} className="card p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                    {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{a.user?.firstName} {a.user?.lastName}</p>
                    <p className="text-xs text-gray-400 truncate">{a.user?.email}</p>
                  </div>
                </div>

                {a.department && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> {a.department}
                  </p>
                )}

                {a.specialties?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.specialties.slice(0, 3).map((sp: string) => (
                      <span key={sp} className="badge bg-teal-50 text-teal-700 text-xs">{sp}</span>
                    ))}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500">Carga de trabajo</p>
                    <p className="text-xs font-medium text-gray-700">{worksCount}/{capacity}</p>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${full ? 'bg-red-400' : pct > 70 ? 'bg-yellow-400' : 'bg-teal-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  {full && <p className="text-xs text-red-500 mt-1">Capacidad máxima alcanzada</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
