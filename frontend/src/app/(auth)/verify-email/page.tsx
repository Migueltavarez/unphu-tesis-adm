'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { GraduationCap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>;
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-unphu-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-gold-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verificación de correo</h1>
          <p className="text-gray-500 mt-1 text-sm">Plataforma de Gestión de Tesis – UNPHU</p>
        </div>

        <div className="card p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-14 h-14 text-unphu-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Verificando tu correo…</h2>
              <p className="text-gray-500 text-sm">Un momento, por favor.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">¡Correo verificado!</h2>
              <p className="text-gray-500 text-sm mb-6">
                Tu cuenta ha sido verificada exitosamente. Ya puedes acceder a todos los servicios de la plataforma.
              </p>
              <Link href="/login" className="btn-primary inline-flex items-center gap-2">
                Iniciar sesión
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Enlace inválido</h2>
              <p className="text-gray-500 text-sm mb-6">
                El enlace de verificación no es válido o ya fue utilizado anteriormente.
              </p>
              <div className="flex flex-col gap-3">
                <Link href="/login" className="btn-primary inline-flex items-center justify-center gap-2">
                  Ir al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
