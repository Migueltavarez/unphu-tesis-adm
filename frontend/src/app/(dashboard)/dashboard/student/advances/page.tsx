'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { studentsApi, advancesApi } from '@/lib/api';
import { Advance, AdvanceStatus } from '@/types';
import { formatDate } from '@/lib/utils';
import { Upload, MessageSquare, CheckCircle, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_ICONS: Record<AdvanceStatus, any> = {
  SUBMITTED: Clock,
  UNDER_REVIEW: Clock,
  APPROVED: CheckCircle,
  NEEDS_REVISION: AlertCircle,
};
const STATUS_COLORS: Record<AdvanceStatus, string> = {
  SUBMITTED: 'text-blue-600 bg-blue-50',
  UNDER_REVIEW: 'text-yellow-600 bg-yellow-50',
  APPROVED: 'text-green-600 bg-green-50',
  NEEDS_REVISION: 'text-red-600 bg-red-50',
};
const STATUS_LABELS_ADV: Record<AdvanceStatus, string> = {
  SUBMITTED: 'Enviado',
  UNDER_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  NEEDS_REVISION: 'Requiere revisión',
};

export default function AdvancesPage() {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: profile } = useQuery({ queryKey: ['student-profile'], queryFn: studentsApi.myProfile });
  const activeWork = profile?.thesisWorks?.find(
    (w: any) => !['REJECTED', 'PUBLISHED'].includes(w.status),
  );

  const { data: advances, isLoading } = useQuery({
    queryKey: ['advances', activeWork?.id],
    queryFn: () => advancesApi.list(activeWork!.id),
    enabled: !!activeWork,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ title: string; description: string }>();

  const submitMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      const form = new FormData();
      form.append('title', data.title);
      form.append('description', data.description);
      const fileInput = document.querySelector<HTMLInputElement>('#advance-file');
      if (fileInput?.files?.[0]) form.append('file', fileInput.files[0]);
      return advancesApi.create(activeWork!.id, form);
    },
    onSuccess: () => {
      toast.success('Avance enviado exitosamente');
      qc.invalidateQueries({ queryKey: ['advances'] });
      reset();
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error al enviar avance'),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Avances</h1>
          <p className="text-gray-500 text-sm mt-0.5">Historial versionado de avances enviados</p>
        </div>
        {activeWork && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary inline-flex items-center gap-2">
            <Upload className="w-4 h-4" /> Nuevo avance
          </button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Enviar nuevo avance</h2>
          <form onSubmit={handleSubmit((d) => submitMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Título del avance *</label>
              <input {...register('title', { required: 'Requerido' })} className="input" placeholder="Ej: Capítulo 2 – Marco Teórico" />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <label className="label">Descripción *</label>
              <textarea
                {...register('description', { required: 'Requerido', minLength: { value: 20, message: 'Mínimo 20 caracteres' } })}
                rows={4}
                className="input resize-none"
                placeholder="Describe los avances realizados, qué incluye este entregable..."
              />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
            </div>
            <div>
              <label className="label">Archivo PDF (opcional)</label>
              <input id="advance-file" type="file" accept=".pdf" className="input" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={submitMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {submitMutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Enviar avance
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
        </div>
      ) : advances?.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Upload className="w-10 h-10 mx-auto mb-3" />
          <p className="font-medium">Aún no has enviado avances</p>
          <p className="text-sm mt-1">Cada avance que envíes queda registrado aquí con versión y fecha.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {advances?.map((adv: Advance) => {
            const StatusIcon = STATUS_ICONS[adv.status];
            const isExpanded = expandedId === adv.id;
            return (
              <div key={adv.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : adv.id)}
                  className="w-full p-5 flex items-start gap-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-600">
                    v{adv.version}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 text-sm truncate">{adv.title}</h3>
                      <span className={cn('badge text-xs', STATUS_COLORS[adv.status])}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {STATUS_LABELS_ADV[adv.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(adv.submittedAt)}</p>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                    <p className="text-sm text-gray-600 mb-4">{adv.description}</p>
                    {adv.fileName && (
                      <a href={adv.fileUrl} className="inline-flex items-center gap-2 text-sm text-unphu-600 hover:underline mb-4">
                        📄 {adv.fileName}
                      </a>
                    )}
                    {adv.comments && adv.comments.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Comentarios del asesor</h4>
                        {adv.comments.map((c) => (
                          <div key={c.id} className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                            <p className="text-sm text-gray-700">{c.content}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatDate(c.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
