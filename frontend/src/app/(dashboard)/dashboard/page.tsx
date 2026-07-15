'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

const ROLE_HOME: Record<string, string> = {
  STUDENT:     '/dashboard/student',
  ADVISOR:     '/dashboard/advisor',
  COORDINATOR: '/dashboard/coordinator',
  DIRECTOR:    '/dashboard/director',
  REGISTRO:    '/dashboard/registro',
  COBROS:      '/dashboard/cobros',
  JURADO:      '/dashboard/jurado',
  ADMIN:       '/dashboard/admin',
};

export default function DashboardRootPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user?.role) {
      router.replace(ROLE_HOME[user.role] ?? '/login');
    } else {
      router.replace('/login');
    }
  }, [user, router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-unphu-600 border-t-transparent rounded-full" />
    </div>
  );
}
