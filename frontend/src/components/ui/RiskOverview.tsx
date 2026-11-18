'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2 } from 'lucide-react';
import { riskApi } from '@/lib/api';
import { RiskLevel, ThesisRisk, ThesisStatus } from '@/types';
import { cn } from '@/lib/utils';
import RiskBadge, { RISK_META, RISK_ORDER } from './RiskBadge';
import StatusBadge from './StatusBadge';

interface AtRiskWork {
  id: string;
  title: string;
  status: ThesisStatus;
  student?: { user?: { firstName: string; lastName: string } };
  advisor?: { user?: { firstName: string; lastName: string } } | null;
  career?: { code: string };
  risk: ThesisRisk;
}

interface Summary {
  total: number;
  counts: Record<RiskLevel, number>;
  atRisk: AtRiskWork[];
}

interface Props {
  /** Enlace al detalle de cada tesis según el rol. */
  hrefFor: (id: string) => string;
  limit?: number;
}

export default function RiskOverview({ hrefFor, limit = 6 }: Props) {
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ['risk-summary'],
    queryFn: riskApi.summary,
  });

  const visible = data?.atRisk.slice(0, limit) ?? [];
  const hidden = (data?.atRisk.length ?? 0) - visible.length;

  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-unphu-600" />
          Semáforo de seguimiento
        </h2>
        {data && <span className="text-xs text-gray-400">{data.total} tesis activas</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {RISK_ORDER.map((level) => (
          <div
            key={level}
            className={cn(
              'rounded-xl px-3 py-2.5 transition-opacity',
              RISK_META[level].tile,
              !isLoading && !data?.counts[level] && 'opacity-40',
            )}
          >
            <p className="text-2xl font-bold tabular-nums leading-none">
              {isLoading ? '–' : data?.counts[level] ?? 0}
            </p>
            <p className="text-xs mt-1 font-medium opacity-90">{RISK_META[level].label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        {!isLoading && visible.length === 0 ? (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Todas las tesis activas están al día.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((w) => (
              <li key={w.id}>
                <Link
                  href={hrefFor(w.id)}
                  className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{w.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {w.student?.user?.firstName} {w.student?.user?.lastName}
                      {w.career?.code && ` · ${w.career.code}`}
                    </p>
                    <p className="text-xs text-gray-700 mt-0.5 line-clamp-2" title={w.risk.reasons.join(' · ')}>
                      {w.risk.reasons[0]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={w.status} className="hidden md:inline-flex" />
                    <RiskBadge risk={w.risk} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && (
          <p className="text-xs text-gray-400 mt-2">y {hidden} más en la lista de trabajos.</p>
        )}
      </div>
    </div>
  );
}
