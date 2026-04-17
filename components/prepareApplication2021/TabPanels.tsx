"use client";

import React, { useEffect, useMemo, useState } from "react";

import DesktopMilestonePicker from "@/components/DesktopMilestonePicker";
import { sortMilestoneIds as sortMilestoneIdsBySequence } from "@/lib/milestoneSequence";
import type { GoalsCatalog } from "@/lib/goals";
import type { Profile } from "@/lib/types";

type Sta3TabContentProps = {
  profile: Profile | null;
  sta3OtherText: string;
  setSta3OtherText: (v: string) => void;
  sta3HowVerifiedText: string;
  setSta3HowVerifiedText: (v: string) => void;
  onPreview: (blob: Blob) => void;
  includeInAttachments: boolean;
  onToggleIncludeInAttachments: (checked: boolean) => void;
};

export function Sta3TabContent({
  profile,
  sta3OtherText,
  setSta3OtherText,
  sta3HowVerifiedText,
  setSta3HowVerifiedText,
  onPreview,
  includeInAttachments,
  onToggleIncludeInAttachments,
}: Sta3TabContentProps) {
  const [autoPlacements, setAutoPlacements] = useState<Array<{ id: string; title: string; period?: string }>>([]);
  const [autoCourses, setAutoCourses] = useState<Array<{ id: string; title: string; period?: string }>>([]);
  const [researchTitle, setResearchTitle] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  const isSta3Token = (val: unknown): boolean => {
    const s = String(val ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return s === "STA3" || s === "A3";
  };

  const hasSta3InObj = (obj: any): boolean => {
    if (!obj || typeof obj !== "object") return false;
    const fields = [obj?.milestones, obj?.stMilestones, obj?.goals, obj?.goalIds, obj?.milestoneIds, obj?.codes];
    for (const arr of fields) {
      if (!arr) continue;
      for (const v of arr as any[]) {
        if (isSta3Token(v)) return true;
      }
    }
    return false;
  };

  useEffect(() => {
    (async () => {
      try {
        const [achsRaw, placsRaw, crsRaw] = await Promise.all([[] as any[], [] as any[], [] as any[]]);

        const achs = achsRaw as any[];
        const placs = placsRaw as any[];
        const crs = crsRaw as any[];

        const placementIds = new Set<string>();
        const courseIds = new Set<string>();
        let foundResearch = "";

        for (const ach of achs) {
          const cands = [ach.milestoneId, ach.goalId, ach.code, ach.milestone];
          if (cands.some(isSta3Token)) {
            if (ach.placementId) {
              const placement = placs.find((p: any) => String(p.id) === String(ach.placementId));
              if (placement && placement.type !== "Vetenskapligt arbete") {
                placementIds.add(String(ach.placementId));
              } else if (placement && placement.type === "Vetenskapligt arbete") {
                foundResearch = placement.clinic || placement.label || placement.note || "";
              }
            }
            if (ach.courseId) courseIds.add(String(ach.courseId));
          }
        }

        for (const p of placs) {
          if (p.type === "Vetenskapligt arbete" && hasSta3InObj(p)) {
            foundResearch = p.clinic || p.label || p.note || "";
          } else if (hasSta3InObj(p)) {
            placementIds.add(String(p.id));
          }
        }
        for (const c of crs) {
          if (hasSta3InObj(c)) courseIds.add(String(c.id));
        }

        const pickedPlacements = placs.filter((p: any) => placementIds.has(String(p.id))).map((p: any) => ({
          id: String(p.id),
          title: p.clinic || p.title || "Klinisk tjänstgöring",
          period: `${p.startDate || ""}${p.endDate ? ` – ${p.endDate}` : ""}${p.attendance ? ` · ${p.attendance}%` : ""}`.trim(),
        }));

        const pickedCourses = crs.filter((c: any) => courseIds.has(String(c.id))).map((c: any) => ({
          id: String(c.id),
          title: c.title || c.provider || "Kurs",
          period: [c.city, c.certificateDate || c.endDate || c.startDate].filter(Boolean).join(" · "),
        }));

        setAutoPlacements(pickedPlacements);
        setAutoCourses(pickedCourses);
        if (foundResearch) setResearchTitle(foundResearch);
      } catch (err) {
        console.error("STa3 auto-plockning misslyckades:", err);
      }
    })();
  }, []);

  const listPlacements = autoPlacements;
  const listCourses = autoCourses;

  const handleGenerate = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { exportSta3Certificate } = await import("@/lib/exporters");

      const rawLines: string[] = [];
      if (researchTitle) rawLines.push(`Vetenskapligt arbete: ${researchTitle}`);
      listPlacements.forEach((p) => {
        rawLines.push(`Klinisk tjänstgöring: ${p.title}${p.period ? ` (${p.period})` : ""}`);
      });
      listCourses.forEach((c) => {
        rawLines.push(`Kurs: ${c.title}${c.period ? ` (${c.period})` : ""}`);
      });
      if (sta3OtherText?.trim()) {
        rawLines.push("");
        rawLines.push(sta3OtherText.trim());
      }

      const activitiesBlock = rawLines.filter((line) => line.trim().length > 0).join("\n");
      const howBlock = (sta3HowVerifiedText ?? "").trim();

      if (!activitiesBlock && !howBlock) {
        alert("Lägg till minst en rad under aktiviteter eller hur det kontrollerats innan du skapar intyget.");
        return;
      }

      const supervisorName = (profile as any)?.supervisor || "";
      const supervisorSpeciality = (profile as any)?.specialty || (profile as any)?.speciality || "";
      const supervisorSite = (profile as any)?.supervisorWorkplace || (profile as any)?.homeClinic || "";

      const blob = await exportSta3Certificate(
        {
          profile: profile as any,
          supervisor: {
            name: supervisorName,
            speciality: supervisorSpeciality,
            site: supervisorSite,
          },
          activitiesText: activitiesBlock,
          howVerifiedText: howBlock,
        },
        { output: "blob", filename: "intyg-sta3-2021.pdf" }
      );

      if (blob instanceof Blob) {
        onPreview(blob);
      }
    } catch (err) {
      console.error("exportSta3Certificate error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 text-base font-semibold text-slate-900">Utbildningsaktiviteter som genomförts för att uppnå delmålet</div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1 text-sm font-semibold text-slate-800">Vetenskapligt arbete</div>
              <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900">{researchTitle || "—"}</div>
            </div>

            <div>
              <div className="mb-1 text-sm font-semibold text-slate-800">Klinisk tjänstgöring med godkänt delmål STa3</div>
              <div className="rounded-xl border border-slate-200">
                {listPlacements.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">Inget registrerat</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {listPlacements.map((p) => (
                      <li key={p.id} className="px-3 py-2">
                        <div className="text-sm font-medium text-slate-900">{p.title || "—"}</div>
                        {p.period && <div className="text-xs text-slate-600">{p.period}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm font-semibold text-slate-800">Kurser med godkänt delmål STa3</div>
            <div className="rounded-xl border border-slate-200">
              {listCourses.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-500">Inget registrerat</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {listCourses.map((c) => (
                    <li key={c.id} className="px-3 py-2">
                      <div className="text-sm font-medium text-slate-900">{c.title || "—"}</div>
                      {c.period && <div className="text-xs text-slate-600">{c.period}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm text-slate-700">Övriga aktiviteter</label>
          <textarea
            value={sta3OtherText}
            onChange={(e) => setSta3OtherText(e.target.value)}
            className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-1 text-base font-semibold text-slate-900">Hur det kontrollerats att sökanden uppnått delmålet</div>
        <div className="mb-2 text-xs text-slate-600">Exempel: bedömningar av kliniskt omhändertagande eller kursexaminationer</div>
        <textarea
          value={sta3HowVerifiedText}
          onChange={(e) => setSta3HowVerifiedText(e.target.value)}
          className="min-h-[140px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeInAttachments}
            onChange={(e) => onToggleIncludeInAttachments(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Visa i listan över bilagor</span>
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={downloading}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-60"
          data-info="Intyg delmål STa3"
        >
          {downloading ? "Skapar förhandsgranskning…" : "Intyg delmål STa3"}
        </button>
      </div>
    </div>
  );
}

type ThirdCountryTabContentProps = {
  profile: Profile | null;
  goals: GoalsCatalog | null;
  thirdCountryMilestones: Set<string>;
  setThirdCountryMilestones: (v: Set<string>) => void;
  thirdCountryMilestonePickerOpen: boolean;
  setThirdCountryMilestonePickerOpen: (v: boolean) => void;
  thirdCountryActivities: string;
  setThirdCountryActivities: (v: string) => void;
  thirdCountryVerification: string;
  setThirdCountryVerification: (v: string) => void;
  onPreview: (blob: Blob) => void;
};

export function ThirdCountryTabContent({
  profile,
  goals,
  thirdCountryMilestones,
  setThirdCountryMilestones,
  thirdCountryMilestonePickerOpen,
  setThirdCountryMilestonePickerOpen,
  thirdCountryActivities,
  setThirdCountryActivities,
  thirdCountryVerification,
  setThirdCountryVerification,
  onPreview,
}: ThirdCountryTabContentProps) {
  const [downloading, setDownloading] = useState(false);

  const milestonesSorted = useMemo(
    () => sortMilestoneIdsBySequence(Array.from(thirdCountryMilestones)),
    [thirdCountryMilestones]
  );
  const milestonesString = useMemo(() => milestonesSorted.join(", "), [milestonesSorted]);

  const handleGenerate = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { exportThirdCountryCertificate } = await import("@/lib/exporters");

      const blob = await exportThirdCountryCertificate(
        {
          profile: profile as any,
          delmalCodes: milestonesString,
          activitiesText: thirdCountryActivities,
          verificationText: thirdCountryVerification,
        },
        { output: "blob", filename: "intyg-bilaga13-2021.pdf" }
      );

      if (blob instanceof Blob) {
        onPreview(blob);
      }
    } catch (err) {
      console.error("exportThirdCountryCertificate error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen.");
    } finally {
      setDownloading(false);
    }
  };

  const handleToggleMilestone = (milestoneId: string) => {
    const next = new Set<string>(thirdCountryMilestones);
    if (next.has(milestoneId)) {
      next.delete(milestoneId);
    } else {
      next.add(milestoneId);
    }
    setThirdCountryMilestones(next);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-lg border border-slate-200 p-3">
        <label className="mb-1 block text-sm font-semibold text-slate-900">Delmål som intyget avser</label>
        <div className="space-y-2">
          {thirdCountryMilestones.size > 0 ? (
            <div className="flex flex-wrap gap-2">
              {milestonesSorted.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  {code}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Inga delmål valda</p>
          )}
          <button
            type="button"
            onClick={() => setThirdCountryMilestonePickerOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
            data-info="Välj delmål"
          >
            {thirdCountryMilestones.size > 0 ? "Ändra delmål" : "Välj delmål"}
          </button>
        </div>
      </div>

      {goals && (
        <DesktopMilestonePicker
          open={thirdCountryMilestonePickerOpen}
          title="Välj delmål för specialistläkare från tredjeland"
          goals={goals}
          checked={thirdCountryMilestones}
          onToggle={handleToggleMilestone}
          onClose={() => setThirdCountryMilestonePickerOpen(false)}
        />
      )}

      <div className="rounded-lg border border-slate-200 p-3">
        <label className="mb-1 block text-sm font-semibold text-slate-900">Utbildningsaktiviteter som sökanden genomfört</label>
        <textarea
          value={thirdCountryActivities}
          onChange={(e) => setThirdCountryActivities(e.target.value)}
          className="min-h-[200px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
        />
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <label className="mb-1 block text-sm font-semibold text-slate-900">Hur det kontrollerats att sökanden uppnått delmålet</label>
        <textarea
          value={thirdCountryVerification}
          onChange={(e) => setThirdCountryVerification(e.target.value)}
          className="min-h-[200px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={downloading}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-60"
          data-info="Intyg"
        >
          {downloading ? "Skapar förhandsgranskning…" : "Intyg"}
        </button>
      </div>
    </div>
  );
}
