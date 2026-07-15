'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi, careersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { CheckCircle, User } from 'lucide-react';

interface ProfileForm {
  matricula: string;
  careerId: string;
  creditsApproved: number;
}

export default function StudentProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentsApi.myProfile,
    enabled: !!user,
  });

  const { data: careers, isLoading: loadingCareers } = useQuery({
    queryKey: ['careers'],
    queryFn: careersApi.list,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileForm>();

  useEffect(() => {
    if (profile) {
      reset({
        matricula: profile.matricula || '',
        careerId: profile.careerId || '',
        creditsApproved: profile.creditsApproved || 0,
      });
    }
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) =>
      profile ? studentsApi.updateProfile(data) : studentsApi.createProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      router.push('/dashboard/student');
    },
  });

  if (loadingProfile || loadingCareers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Perfil académico</h1>
        <p className="text-gray-500 text-sm mt-1">
          Completa tu información académica para iniciar el proceso de trabajo de grado.
        </p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full bg-unphu-100 flex items-center justify-center">
            <User className="w-6 h-6 text-unphu-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <div>
            <label className="label">Matrícula *</label>
            <input
              {...register('matricula', { required: 'La matrícula es obligatoria' })}
              className="input"
              placeholder="2021-0001"
            />
            {errors.matricula && <p className="text-xs text-red-600 mt-1">{errors.matricula.message}</p>}
          </div>

          <div>
            <label className="label">Carrera *</label>
            <select
              {...register('careerId', { required: 'Selecciona tu carrera' })}
              className="input"
            >
              <option value="">-- Selecciona tu carrera --</option>
              {careers?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
            {errors.careerId && <p className="text-xs text-red-600 mt-1">{errors.careerId.message}</p>}
          </div>

          <div>
            <label className="label">Créditos aprobados</label>
            <input
              {...register('creditsApproved', { valueAsNumber: true, min: 0 })}
              type="number"
              min={0}
              max={300}
              className="input"
              placeholder="180"
            />
            <p className="text-xs text-gray-400 mt-1">
              Ingresa los créditos aprobados hasta la fecha según tu expediente académico.
            </p>
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Ocurrió un error al guardar. Intenta de nuevo.
            </p>
          )}

          {mutation.isSuccess && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Perfil actualizado correctamente</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? 'Guardando...' : profile ? 'Actualizar perfil' : 'Guardar perfil'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push('/dashboard/student')}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
