'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { studentsApi, thesisApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { ArrowLeft, PenLine, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentProposalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [firma, setFirma] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentsApi.myProfile,
    enabled: !!user,
  });

  const activeWork = profile?.thesisWorks?.find((w: any) => w.id === id);

  const submitMutation = useMutation({
    mutationFn: (firma: string) => thesisApi.submitProposal(id, firma),
    onSuccess: () => {
      toast.success('Propuesta enviada a Coordinación');
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      router.push('/dashboard/student');
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Error al enviar la propuesta'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!activeWork || !['POSTULATION', 'PROPOSAL_FORM'].includes(activeWork.status)) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Formulario no disponible</h2>
          <p className="text-sm text-gray-500 mb-4">
            Este formulario solo está disponible cuando tu trabajo está en etapa de Postulación.
          </p>
          <Link href="/dashboard/student" className="btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Volver al panel
          </Link>
        </div>
      </div>
    );
  }

  const student = profile;
  const career = activeWork.career;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/student" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formulario de Propuesta</h1>
          <p className="text-gray-500 text-sm">Completa y firma tu propuesta de trabajo de grado</p>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
          <p className="font-medium mb-1">Instrucciones</p>
          <p>Revisa que tus datos sean correctos. Al firmar y enviar este formulario, Coordinación recibirá tu propuesta para revisión. Una vez aprobada, será enviada al Dpto. de Registro.</p>
        </div>

        {/* Auto-filled fields */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Nombre completo</label>
            <p className="input bg-gray-50 cursor-not-allowed text-gray-700">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Matrícula</label>
            <p className="input bg-gray-50 cursor-not-allowed text-gray-700">{student.matricula}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Carrera</label>
            <p className="input bg-gray-50 cursor-not-allowed text-gray-700">{career?.name}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Correo electrónico</label>
            <p className="input bg-gray-50 cursor-not-allowed text-gray-700">{user?.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tema propuesto</label>
          <p className="input bg-gray-50 cursor-not-allowed text-gray-700 h-auto py-3 whitespace-pre-wrap">{activeWork.title}</p>
        </div>

        {/* Firma */}
        <div className="pt-4 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <PenLine className="w-4 h-4 text-unphu-600" />
            Firma digital
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Escribe tu nombre completo como firma para confirmar que los datos son correctos y que autorizas el inicio de este proceso.
          </p>
          <input
            type="text"
            placeholder={`${user?.firstName} ${user?.lastName}`}
            value={firma}
            onChange={(e) => setFirma(e.target.value)}
            className="input font-handwriting text-lg"
            style={{ fontFamily: "'Dancing Script', cursive, serif" }}
          />
          {firma && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Firma capturada
            </p>
          )}
        </div>

        <div className="pt-4 flex gap-3">
          <button
            onClick={() => submitMutation.mutate(firma)}
            disabled={!firma.trim() || submitMutation.isPending}
            className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
          >
            {submitMutation.isPending ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Enviar propuesta a Coordinación
          </button>
          <Link href="/dashboard/student" className="btn-secondary px-6 py-2.5">
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  );
}
