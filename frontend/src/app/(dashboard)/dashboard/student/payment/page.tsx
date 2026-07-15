'use client';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi, paymentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import { CreditCard, Upload, CheckCircle, XCircle, Clock, ExternalLink, FileText } from 'lucide-react';

export default function StudentPaymentPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentsApi.myProfile,
    enabled: !!user,
  });

  const activeWork = profile?.thesisWorks?.find(
    (w: any) => !['REJECTED', 'PUBLISHED'].includes(w.status),
  );

  const submitMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('receipt', file);
      return paymentsApi.submitReceipt(activeWork.id, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      setSelectedFile(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const payment = activeWork?.payment;

  if (!activeWork) {
    return (
      <div className="max-w-xl mx-auto card p-8 text-center">
        <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sin trabajo de grado activo</h2>
        <p className="text-gray-500 text-sm">Debes tener una postulación aprobada para gestionar el pago.</p>
      </div>
    );
  }

  const STATUS_INFO: Record<string, { label: string; color: string; icon: any }> = {
    PENDING:   { label: 'Pago pendiente', color: 'text-yellow-600 bg-yellow-50 border-yellow-100', icon: Clock },
    SUBMITTED: { label: 'Comprobante enviado — en revisión', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: Clock },
    CONFIRMED: { label: 'Pago confirmado', color: 'text-green-600 bg-green-50 border-green-100', icon: CheckCircle },
    REJECTED:  { label: 'Comprobante rechazado', color: 'text-red-600 bg-red-50 border-red-100', icon: XCircle },
  };

  const info = payment ? STATUS_INFO[payment.status] || STATUS_INFO.PENDING : STATUS_INFO.PENDING;
  const Icon = info.icon;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pago de inscripción</h1>
        <p className="text-gray-500 text-sm mt-1">{activeWork.title}</p>
      </div>

      {/* Status card */}
      <div className={`card p-5 flex items-center gap-4 border ${info.color}`}>
        <Icon className="w-8 h-8 flex-shrink-0" />
        <div>
          <p className="font-semibold">{info.label}</p>
          {payment?.amount && (
            <p className="text-sm mt-0.5">Monto: RD$ {Number(payment.amount).toLocaleString()}</p>
          )}
          {payment?.confirmedAt && (
            <p className="text-xs mt-0.5 opacity-75">Confirmado el {formatDate(payment.confirmedAt)}</p>
          )}
          {payment?.rejectionReason && (
            <p className="text-xs mt-1 font-medium">Motivo: {payment.rejectionReason}</p>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Instrucciones de pago</h2>
        <div className="bg-unphu-50 border border-unphu-100 rounded-lg p-4 text-sm space-y-2">
          <p className="font-medium text-unphu-800">Datos para transferencia bancaria:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Banco:</span>
            <span className="text-gray-900 font-medium">Banco Popular Dominicano</span>
            <span className="text-gray-500">Cuenta:</span>
            <span className="text-gray-900 font-mono">800-000000-1</span>
            <span className="text-gray-500">Titular:</span>
            <span className="text-gray-900">UNPHU – Facultad de Ingeniería</span>
            <span className="text-gray-500">Monto:</span>
            <span className="text-gray-900 font-medium">RD$ 3,500.00</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Realiza la transferencia y sube el comprobante (imagen o PDF). El Departamento de Cobros confirmará el pago en un plazo de 1-2 días hábiles.
        </p>
      </div>

      {/* Upload receipt */}
      {(!payment || payment.status === 'REJECTED' || payment.status === 'PENDING') && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Subir comprobante</h2>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-unphu-300 hover:bg-unphu-50/50 transition-colors"
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2 text-unphu-700">
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium">{selectedFile.name}</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Haz clic para seleccionar el comprobante</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG o PDF — máx. 5 MB</p>
              </>
            )}
          </div>

          {submitMutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              Error al subir el comprobante. Intenta de nuevo.
            </p>
          )}
          {submitMutation.isSuccess && (
            <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Comprobante enviado correctamente
            </p>
          )}

          <button
            onClick={() => selectedFile && submitMutation.mutate(selectedFile)}
            disabled={!selectedFile || submitMutation.isPending}
            className="btn-primary w-full inline-flex items-center justify-center gap-2"
          >
            {submitMutation.isPending ? (
              <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Subiendo...</>
            ) : (
              <><Upload className="w-4 h-4" /> Enviar comprobante</>
            )}
          </button>
        </div>
      )}

      {/* Receipt link if already submitted */}
      {payment?.receiptUrl && payment.status !== 'REJECTED' && (
        <div className="card p-5 flex items-center gap-3">
          <FileText className="w-5 h-5 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Comprobante enviado</p>
            <p className="text-xs text-gray-400">{payment.receiptFileName}</p>
          </div>
          <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer"
            className="text-unphu-600 hover:text-unphu-700">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}
