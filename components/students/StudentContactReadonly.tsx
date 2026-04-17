"use client";

import type { SupervisorStudent } from "@/lib/mappers/studentData";

type Props = {
  student: SupervisorStudent;
};

function birthDateFromPersonalNumber(raw: unknown): string {
  const pnr = String(raw || "");
  if (!pnr) return "—";
  return pnr.replace(/[-+]?\d{4}$/, "") || "—";
}

export default function StudentContactReadonly({ student }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Kontaktuppgifter</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Namn</label>
          <p className="text-sm text-slate-900">{student.name || "—"}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Födelsedatum</label>
          <p className="text-sm text-slate-900 font-mono">
            {birthDateFromPersonalNumber((student.profile as any)?.personalNumber)}
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">E-postadress</label>
          <p className="text-sm text-slate-900">{String((student.profile as any)?.email || "—")}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Mobiltelefon</label>
          <p className="text-sm text-slate-900">{String((student.profile as any)?.mobile || "—")}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Arbetstelefon</label>
          <p className="text-sm text-slate-900">{String((student.profile as any)?.phoneWork || "—")}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Hemtelefon</label>
          <p className="text-sm text-slate-900">{String((student.profile as any)?.phoneHome || "—")}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Adress</label>
          <p className="text-sm text-slate-900">{String((student.profile as any)?.address || "—")}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Postnummer</label>
          <p className="text-sm text-slate-900">{String((student.profile as any)?.postalCode || "—")}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Postort</label>
          <p className="text-sm text-slate-900">{String((student.profile as any)?.city || "—")}</p>
        </div>
      </div>
    </div>
  );
}
