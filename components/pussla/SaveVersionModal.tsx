"use client";

import React, { useEffect, useRef, useState } from "react";
import { getSessionUser, supabase } from "@/lib/supabase";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";

export default function SaveVersionModal({
  open,
  onClose,
  activities,
  courses,
}: {
  open: boolean;
  onClose: () => void;
  activities: any[];
  courses: any[];
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [versionName, setVersionName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedVersions, setSavedVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function loadVersions() {
      setLoadingVersions(true);
      try {
        const user = await getSessionUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("timeline_versions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setSavedVersions(data);
        }
      } catch (e) {
        console.error("Kunde inte ladda versioner:", e);
      } finally {
        setLoadingVersions(false);
      }
    }

    loadVersions();

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 16).replace("T", " ");
    setVersionName(`Version ${dateStr}`);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = overlayRef.current;
    if (!el) return;
    registerModal(el, onClose);
    return () => {
      unregisterModal(el);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSave() {
    if (!versionName.trim()) {
      alert("Ange ett namn för versionen");
      return;
    }

    setSaving(true);
    try {
      const user = await getSessionUser();
      if (!user) throw new Error("Inte inloggad");

      const versionData = {
        activities: activities.map((a) => ({
          id: a.id,
          label: a.label,
          type: a.type,
          startSlot: a.startSlot,
          lengthSlots: a.lengthSlots,
          exactStartISO: a.exactStartISO,
          exactEndISO: a.exactEndISO,
          attendance: a.attendance,
          supervisor: a.supervisor,
          supervisorSpeciality: a.supervisorSpeciality,
          supervisorSite: a.supervisorSite,
          milestones: a.milestones,
          btMilestones: a.btMilestones,
          note: (a as any).note,
        })),
        courses: courses.map((c) => ({
          id: c.id,
          title: c.title,
          certificateDate: c.certificateDate,
          kind: c.kind,
          startDate: c.startDate,
          endDate: c.endDate,
          milestones: c.milestones,
          btMilestones: c.btMilestones,
          showAsInterval: c.showAsInterval,
          note: c.note,
        })),
      };

      const { error } = await supabase
        .from("timeline_versions")
        .insert({
          user_id: user.id,
          version_name: versionName.trim(),
          version_data: versionData,
        })
        .select();

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(error.message || "Kunde inte spara till databasen");
      }

      onClose();
    } catch (e) {
      console.error("Full error:", e);
      const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
      alert(`Kunde inte spara version: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadVersion(versionId: string) {
    if (!window.confirm("Vill du ladda denna version? Nuvarande osparade ändringar går förlorade.")) {
      return;
    }
    try {
      const version = savedVersions.find((v) => v.id === versionId);
      if (!version) return;
      alert("Ladda version-funktionalitet kommer snart!");
      onClose();
    } catch (e) {
      console.error(e);
      alert("Kunde inte ladda version");
    }
  }

  async function handleDeleteVersion(versionId: string) {
    if (!window.confirm("Vill du radera denna version?")) return;
    try {
      const user = await getSessionUser();
      if (!user) return;

      const { error } = await supabase
        .from("timeline_versions")
        .delete()
        .eq("id", versionId)
        .eq("user_id", user.id);

      if (error) throw error;

      setSavedVersions((prev) => prev.filter((v) => v.id !== versionId));
      alert("Version raderad");
    } catch (e) {
      console.error(e);
      alert("Kunde inte radera version");
    }
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">Spara och ladda versioner</h2>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Spara nuvarande tidslinje som version</label>
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="Ange versionsnamn"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
            >
              {saving ? "Sparar..." : "Spara version"}
            </button>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Sparade versioner</h3>
            {loadingVersions ? (
              <p className="text-sm text-slate-500">Laddar...</p>
            ) : savedVersions.length === 0 ? (
              <p className="text-sm text-slate-500">Inga sparade versioner ännu</p>
            ) : (
              <div className="space-y-2">
                {savedVersions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-semibold">{v.version_name}</p>
                      <p className="text-xs text-slate-500">{new Date(v.created_at).toLocaleString("sv-SE")}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoadVersion(v.id)}
                        className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                      >
                        Ladda
                      </button>
                      <button
                        onClick={() => handleDeleteVersion(v.id)}
                        className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:border-red-400 hover:bg-red-50 active:translate-y-px"
                      >
                        Radera
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t px-5 py-4">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}
