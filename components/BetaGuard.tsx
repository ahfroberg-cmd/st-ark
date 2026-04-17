// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function BetaGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState(true);
  const publicPath =
    pathname === "/auth" ||
    pathname === "/auth/signup" ||
    pathname === "/auth/confirm" ||
    pathname === "/accept-invite" ||
    pathname === "/admin" ||
    pathname?.startsWith("/admin/") ||
    pathname?.startsWith("/api") ||
    pathname?.startsWith("/_next") ||
    pathname?.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico";

  useEffect(() => {
    let mounted = true;

    if (publicPath) {
      setIsAuthenticated(true);
      setIsChecking(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const authenticated = !!data.session?.user;
        setIsAuthenticated(authenticated);
        setIsChecking(false);
      })
      .catch(() => {
        if (!mounted) return;
        setIsAuthenticated(false);
        setIsChecking(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const authenticated = !!session?.user;
      setIsAuthenticated(authenticated);
      setIsChecking(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, publicPath]);

  // Visa ingenting medan vi kontrollerar autentisering
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

  // Låt respektive sida hantera redirectlogik om användaren inte är autentiserad
  return <>{children}</>;
}
