'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { advisorsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { CheckCircle, BookOpen, X, Plus } from 'lucide-react';

interface ProfileForm {
  department: string;
  maxWorkload: number;
}

export default function AdvisorProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['advisor-profile'],
    queryFn: advisorsApi.myProfile,
    enabled: !!user,
    retry: false,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    defaultValues: { maxWorkload: 5 },
  });

  useEffect(() => {
    if (profile) {
      reset({ department: profile.department || '', maxWorkload: profile.maxWorkload || 5 });
      setSpecialties(profile.specialties || []);
    }
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) => {
      const payload = { ...data, specialties };
      return profile
        ? advisorsApi.updateProfile(profile.id, payload)
        : advisorsApi.createProfile(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advisor-profile'] });
      router.push('/dashboard/advisor');
    },
  });

  const addSpecialty = () => {
    const trimmed = specialtyInput.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties([...specialties, trimmed]);
      setSpecialtyInput('');
    }
  };

  const removeSpecialty = (s: string) => setSpecialties(specialties.filter((x) => x !== s));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Perfil de asesor</h1>
        <p className="text-gray-500 text-sm mt-1">
          {profile ? 'Actualiza tu información académica.' : 'Configura tu perfil para empezar a recibir trabajos.'}
        </p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full bg-unphu-100 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-unphu-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <div>
            <label className="label">Departamento / Facultad *</label>
            <input
              {...register('department', { required: 'El departamento es obligatorio' })}
              className="input"
              placeholder="Ej: Ingeniería en Sistemas"
            />
            {errors.department && <p className="text-xs text-red-600 mt-1">{errors.department.message}</p>}
          </div>

          <div>
            <label className="label">Capacidad máxima de trabajos</label>
            <input
              {...register('maxWorkload', { valueAsNumber: true, min: 1, max: 20 })}
              type="number"
              min={1}
              max={20}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">Máximo de trabajos activos simultáneos que puedes asesorar.</p>
          </div>

          <div>
            <label className="label">Especialidades</label>
            <div className="flex gap-2 mb-2">
              <input
                value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(); } }}
                placeholder="Ej: Inteligencia Artificial"
                className="input flex-1"
              />
              <button type="button" onClick={addSpecialty} className="btn-secondary px-3 py-2">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {specialties.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {specialties.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 badge bg-unphu-50 text-unphu-700 pr-1">
                    {s}
                    <button type="button" onClick={() => removeSpecialty(s)} className="hover:text-red-500 transition-colors ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Ocurrió un error al guardar. Intenta de nuevo.
            </p>
          )}

          {mutation.isSuccess && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Perfil guardado correctamente</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? 'Guardando...' : profile ? 'Actualizar perfil' : 'Crear perfil'}
            </button>
            {profile && (
              <button type="button" className="btn-secondary" onClick={() => router.push('/dashboard/advisor')}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
