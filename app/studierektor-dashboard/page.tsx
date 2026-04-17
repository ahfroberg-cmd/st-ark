"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StudierektorDashboard from '@/components/StudierektorDashboard';
import { supabase } from "@/lib/supabase";
import { fetchProfileById } from "@/lib/repositories/starkRepository";

export default function StudierektorDashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth(userId: string) {
      console.log('[Dashboard] Checking profile for user:', userId);
      const { data: profile, error: profileError } = await fetchProfileById(userId);

      console.log('[Dashboard] Profile result:', { profile, error: profileError });

      if (!mounted) return;

      if (!profile || profile.role !== "studierektor") {
        console.log('[Dashboard] Not studierektor, redirecting to /');
        router.replace("/");
        return;
      }

      if (!String(profile.name || "").trim()) {
        console.log('[Dashboard] Needs setup');
        router.replace("/studierektor-profile?setup=1");
        return;
      }

      console.log('[Dashboard] All checks passed, showing dashboard');
      setChecking(false);
    }

    async function tryRestoreSession(): Promise<string | null> {
      console.log('[Dashboard] tryRestoreSession starting...');
      
      // 1. Kolla om session redan finns
      const { data } = await supabase.auth.getSession();
      console.log('[Dashboard] getSession result:', data.session ? 'found' : 'null');
      if (data.session?.user?.id) {
        console.log('[Dashboard] Session found directly, userId:', data.session.user.id);
        return data.session.user.id;
      }

      // 2. Försök getUser() som fallback
      console.log('[Dashboard] Trying getUser()...');
      try {
        const { data: userData } = await supabase.auth.getUser();
        console.log('[Dashboard] getUser result:', userData?.user ? 'found' : 'null');
        if (userData?.user?.id) {
          console.log('[Dashboard] User found via getUser(), userId:', userData.user.id);
          return userData.user.id;
        }
      } catch (err) {
        console.log('[Dashboard] getUser error:', err);
      }

      // 3. Försök återställa från sessionStorage-tokens
      console.log('[Dashboard] Checking sessionStorage...');
      try {
        const accessToken = sessionStorage.getItem('temp_access_token');
        const refreshToken = sessionStorage.getItem('temp_refresh_token');
        console.log('[Dashboard] sessionStorage tokens:', { 
          hasAccess: !!accessToken, 
          hasRefresh: !!refreshToken,
          accessPreview: accessToken ? accessToken.substring(0, 20) + '...' : 'null'
        });
        
        if (accessToken && refreshToken) {
          console.log('[Dashboard] Restoring session from sessionStorage tokens...');
          const { data: restored, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error && restored.session?.user?.id) {
            console.log('[Dashboard] Session restored successfully, userId:', restored.session.user.id);
            sessionStorage.removeItem('temp_access_token');
            sessionStorage.removeItem('temp_refresh_token');
            return restored.session.user.id;
          }
          console.log('[Dashboard] Token restore failed:', error?.message);
        } else {
          console.log('[Dashboard] No tokens in sessionStorage');
        }
      } catch (err) {
        console.log('[Dashboard] sessionStorage restore error:', err);
      }

      console.log('[Dashboard] All restore attempts failed');
      return null;
    }

    tryRestoreSession().then(async (userId) => {
      if (!mounted) return;
      if (!userId) {
        console.log('[Dashboard] No session found, redirecting to /auth');
        router.replace("/auth");
        return;
      }
      await checkAuth(userId);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Laddar...</div>;
  }

  return <StudierektorDashboard />;
}
