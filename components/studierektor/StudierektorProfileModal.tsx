"use client";

import type { Dispatch, SetStateAction } from "react";
import { SPECIALTIES } from "@/lib/swedishSpecialties";

export type StudierektorProfileData = {
  name: string;
  sr_specialty: string;
  sr_for_specialty: string;
  email: string;
  mobile: string;
  phone_work: string;
  address: string;
  postal_code: string;
  city: string;
  personal_number: string;
};

export default function StudierektorProfileModal({
  open,
  onClose,
  srProfile,
  setSrProfile,
  srProfileSaving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  srProfile: StudierektorProfileData;
  setSrProfile: Dispatch<SetStateAction<StudierektorProfileData>>;
  srProfileSaving: boolean;
  onSave: () => Promise<void> | void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Studierektorsprofil</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Namn *</label>
            <input
              type="text"
              value={srProfile.name}
              onChange={(e) => setSrProfile((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Studierektor för specialitet *</label>
            <select
              value={srProfile.sr_for_specialty}
              onChange={(e) => setSrProfile((p) => ({ ...p, sr_for_specialty: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            >
              <option value="">Välj specialitet…</option>
              {SPECIALTIES.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-post</label>
              <input
                type="email"
                value={srProfile.email}
                onChange={(e) => setSrProfile((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mobil</label>
              <input
                type="text"
                value={srProfile.mobile}
                onChange={(e) => setSrProfile((p) => ({ ...p, mobile: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Arbetstelefon</label>
              <input
                type="text"
                value={srProfile.phone_work}
                onChange={(e) => setSrProfile((p) => ({ ...p, phone_work: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Personnummer</label>
              <input
                type="text"
                value={srProfile.personal_number}
                onChange={(e) => setSrProfile((p) => ({ ...p, personal_number: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Adress</label>
              <input
                type="text"
                value={srProfile.address}
                onChange={(e) => setSrProfile((p) => ({ ...p, address: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Postnummer</label>
              <input
                type="text"
                value={srProfile.postal_code}
                onChange={(e) => setSrProfile((p) => ({ ...p, postal_code: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ort</label>
              <input
                type="text"
                value={srProfile.city}
                onChange={(e) => setSrProfile((p) => ({ ...p, city: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={srProfileSaving || !srProfile.name.trim() || !srProfile.sr_for_specialty}
              className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {srProfileSaving ? "Sparar…" : "Spara"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
