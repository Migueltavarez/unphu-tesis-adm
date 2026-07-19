'use client';
import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, STATUS_LABELS } from '@/lib/utils';
import { CreditCard, CheckCircle, Clock, AlertCircle, Building } from 'lucide-react';

const PAYMENT_STAGES = [
  { status: 'REGISTERED',          label: 'Registrado',            desc: 'Tu propuesta fue registrada. Cobros asignará el monto.' },
  { status: 'COBROS_PROCESSING',   label: 'En Cobros',             desc: 'El Dpto. de Cobros está procesando tu pago.' },
  { status: 'CAJA_PENDING',        label: 'Pendiente de Caja',     desc: 'Ve a Caja para realizar el pago. El monto ya está asignado.' },
  { status: 'PAYMENT_CONFIRMED',   label: 'Pago Confirmado',       desc: 'Tu pago fue confirmado. El proceso continúa.' },
];

export default function StudentPaymentPage() {
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

  if (!activeWork) {
    return (
      <div className="max-w-xl mx-auto card p-8 text-center">
        <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sin trabajo de grado activo</h2>
        <p className="text-gray-500 text-sm">Debes tener una postulación activa para ver el estado del pago.</p>
      </div>
    );
  }

  const payment = activeWork?.payment;
  const currentStatus = activeWork.status;
  const inPaymentStage = PAYMENT_STAGES.some((s) => s.status === currentStatus);
  const isConfirmed = currentStatus === 'PAYMENT_CONFIRMED' || (payment?.status === 'CONFIRMED');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estado del pago</h1>
        <p className="text-gray-500 text-sm mt-1">{activeWork.title}</p>
      </div>

      {/* Main status card */}
      {isConfirmed ? (
        <div className="card p-6 flex items-center gap-4 border-2 border-green-200 bg-green-50">
          <CheckCircle className="w-10 h-10 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800 text-lg">Pago confirmado</p>
            {payment?.amount && (
              <p className="text-green-700 text-sm mt-0.5">
                Monto: <span className="font-semibold">RD$ {Number(payment.amount).toLocaleString()}</span>
              </p>
            )}
            {payment?.confirmedAt && (
              <p className="text-xs text-green-600 mt-0.5">Confirmado el {formatDate(payment.confirmedAt)}</p>
            )}
          </div>
        </div>
      ) : currentStatus === 'CAJA_PENDING' ? (
        <div className="card p-6 flex items-start gap-4 border-2 border-orange-200 bg-orange-50">
          <Building className="w-10 h-10 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800 text-lg">Debes ir a la Caja</p>
            {payment?.amount && (
              <p className="text-orange-700 font-bold text-2xl mt-1">
                RD$ {Number(payment.amount).toLocaleString()}
              </p>
            )}
            <p className="text-orange-700 text-sm mt-2">
              Dirígete al Departamento de Caja con tu matrícula y el monto indicado. Una vez que realices el pago, Caja lo confirmará en el sistema.
            </p>
          </div>
        </div>
      ) : inPaymentStage ? (
        <div className="card p-5 flex items-center gap-4 border border-yellow-200 bg-yellow-50">
          <Clock className="w-8 h-8 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800">{STATUS_LABELS[currentStatus as any] ?? currentStatus}</p>
            <p className="text-yellow-700 text-sm mt-0.5">
              {PAYMENT_STAGES.find((s) => s.status === currentStatus)?.desc}
            </p>
          </div>
        </div>
      ) : (
        <div className="card p-5 flex items-center gap-4 border border-gray-200 bg-gray-50">
          <AlertCircle className="w-8 h-8 text-gray-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-gray-700">Pago no disponible aún</p>
            <p className="text-gray-500 text-sm mt-0.5">
              El proceso de pago se habilitará una vez que tu propuesta haya sido aprobada y registrada.
              Estado actual: <span className="font-medium">{STATUS_LABELS[currentStatus as any] ?? currentStatus}</span>
            </p>
          </div>
        </div>
      )}

      {/* Payment process stages */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Proceso de pago</h2>
        <div className="space-y-3">
          {PAYMENT_STAGES.map((stage, i) => {
            const stageIdx = PAYMENT_STAGES.findIndex((s) => s.status === currentStatus);
            const isDone = stageIdx > i;
            const isCurrent = stage.status === currentStatus;
            return (
              <div key={stage.status} className={`flex items-start gap-3 p-3 rounded-lg ${isCurrent ? 'bg-unphu-50 border border-unphu-100' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isDone ? 'bg-green-100 text-green-600' : isCurrent ? 'bg-unphu-100 text-unphu-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isDone ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDone ? 'text-gray-500 line-through' : isCurrent ? 'text-unphu-800' : 'text-gray-400'}`}>
                    {stage.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-gray-500 mt-0.5">{stage.desc}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-5 text-sm text-gray-500 space-y-1">
        <p className="font-medium text-gray-700">¿Cómo funciona el pago?</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Tu propuesta es aprobada y enviada a Registro.</li>
          <li>Registro procesa y confirma tu inscripción.</li>
          <li>Cobros asigna el monto de inscripción y lo envía a Caja.</li>
          <li>Tú vas físicamente a Caja a realizar el pago.</li>
          <li>Caja confirma el pago y el proceso continúa.</li>
        </ol>
      </div>
    </div>
  );
}
