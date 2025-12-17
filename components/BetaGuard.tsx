//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function BetaGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Hoppa över beta-guard för beta-login-sidan och API-routes
    if (pathname?.startsWith("/beta-login") || pathname?.startsWith("/api")) {
      setIsAuthenticated(true);
      return;
    }

    // Kontrollera autentisering
    if (typeof window !== "undefined") {
      const authenticated = sessionStorage.getItem("beta_authenticated") === "true";
      setIsAuthenticated(authenticated);

      if (!authenticated) {
        // Redirecta till beta-login
        router.push("/beta-login");
      }
    }
  }, [pathname, router]);

  // Visa ingenting medan vi kontrollerar autentisering
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="text-sm text-slate-600">Laddar...</p>
        </div>
      </div>
    );
  }

  // Om inte autentiserad, visa ingenting (redirect sker i useEffect)
  if (!isAuthenticated) {
    return null;
  }

  // Om autentiserad, visa innehållet
  return <>{children}</>;
}
