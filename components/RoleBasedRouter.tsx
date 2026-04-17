"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUserRole } from '@/lib/repositories/starkRepository';
import { getDefaultRouteForRole } from '@/lib/routing/roleRoutes';

export default function RoleBasedRouter({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkRoleAndRedirect() {
      try {
        const role = await getCurrentUserRole();
        if (!role) {
          setIsChecking(false);
          return;
        }

        if (!mounted) return;
        setUserRole(role);

        // Om användaren är på root-sidan, redirecta baserat på roll
        if (pathname === '/' || pathname === '/planera-st') {
          router.replace(getDefaultRouteForRole(role));
        }
      } catch (error) {
        console.error('Error checking role:', error);
      } finally {
        if (mounted) setIsChecking(false);
      }
    }

    checkRoleAndRedirect();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="text-sm text-slate-600">Laddar...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
