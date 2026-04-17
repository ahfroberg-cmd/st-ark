"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSessionUser } from "@/lib/supabase";
import { fetchProfileById, upsertProfile } from "@/lib/repositories/starkRepository";

type FormState = {
  name: string;
  email: string;
  secondaryEmail: string;
  phone: string;
  otherInformation: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function StudierektorProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetupMode = searchParams.get("setup") === "1";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    secondaryEmail: "",
    phone: "",
    otherInformation: "",
  });

  const title = useMemo(
    () => (isSetupMode ? "Välkommen som studierektor" : "Studierektorprofil"),
    [isSetupMode]
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const user = await getSessionUser();

      if (!mounted) return;

      if (!user) {
        router.replace("/auth");
        return;
      }

      setUserId(user.id);

      const { data: profile, error } = await fetchProfileById(user.id);

      if (!mounted) return;

      if (error) {
        setMessage(`Kunde inte läsa profil: ${error.message}`);
        setLoading(false);
        return;
      }

      const role = profile?.role || "st_lakare";
      if (role !== "studierektor") {
        router.replace("/");
        return;
      }

      setForm({
        name: profile?.name || "",
        email: user.email || "",
        secondaryEmail: String((profile as any)?.secondary_email || ""),
        phone: profile?.mobile || "",
        otherInformation: String((profile as any)?.other_information || ""),
      });

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function saveProfile() {
    if (!userId) {
      router.replace("/auth");
      return;
    }

    if (!form.name.trim()) {
      setMessage("Fyll i namn.");
      return;
    }

    if (!form.email.trim() || !isValidEmail(form.email.trim())) {
      setMessage("Fyll i en giltig e-postadress.");
      return;
    }

    if (form.secondaryEmail.trim() && !isValidEmail(form.secondaryEmail.trim())) {
      setMessage("Den extra e-postadressen är ogiltig.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await upsertProfile(userId, {
      role: "studierektor",
      name: form.name.trim(),
      mobile: form.phone.trim() || null,
      secondary_email: form.secondaryEmail.trim().toLowerCase() || null,
      other_information: form.otherInformation.trim() || null,
    });

    setSaving(false);

    if (error) {
      setMessage(`Kunde inte spara profil: ${error.message}`);
      return;
    }

    router.replace("/studierektor");
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Laddar...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Fyll i dina kontaktuppgifter för att fortsätta till studierektorssidan.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Namn</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">E-postadress</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Ytterligare e-postadress</label>
              <input
                type="email"
                value={form.secondaryEmail}
                onChange={(e) => setForm({ ...form, secondaryEmail: e.target.value })}
                className="h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Telefonnummer</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Övrig information</label>
              <textarea
                value={form.otherInformation}
                onChange={(e) => setForm({ ...form, otherInformation: e.target.value })}
                rows={6}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {message}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            {!isSetupMode && (
              <button
                type="button"
                onClick={() => router.push("/studierektor")}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Avbryt
              </button>
            )}
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "Sparar..." : "Spara och fortsätt"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
