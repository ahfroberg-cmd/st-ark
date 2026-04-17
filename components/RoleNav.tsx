// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserRole } from "@/lib/repositories/starkRepository";

export default function RoleNav() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const currentRole = await getCurrentUserRole();
      setRole(currentRole);
    })();
  }, []);

  if (!role || role === "st_lakare") return null;

  return (
    <div className="fixed top-2 right-2 z-50 flex gap-1.5">
      {(role === "studierektor" || role === "superadmin") && (
        <button
          onClick={() => router.push("/admin/invite")}
          className="bg-purple-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow hover:bg-purple-700 transition"
        >
          Bjud in
        </button>
      )}
      {role === "superadmin" && (
        <button
          onClick={() => router.push("/admin")}
          className="bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow hover:bg-amber-700 transition"
        >
          Admin
        </button>
      )}
    </div>
  );
}
