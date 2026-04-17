"use client";

import React from "react";

type Props = {
  selCourse: any;
  profile: any;
  activities: any[];
  courses: any[];
  startYear: number;
  setCourses: React.Dispatch<React.SetStateAction<any[]>>;
  setActivities: React.Dispatch<React.SetStateAction<any[]>>;
  setDirty: (v: boolean) => void;
  isValidISO: (iso: string) => boolean;
  dateToSlot: (startYear: number, iso: string, mode: "start" | "end") => number;
  getCourseDisplayTitle: (course: any) => string;
  resolveMatchingUtbildningsmoment: (args: any) => { count: number; uniqueDescriptions: string[] };
  buildUpdatedPlacementNote: (existingNote: string, displayTitle: string, count: number, uniqueDescriptions: string[]) => string;
  sanitizeStMilestonesForGoals: (ids: string[], goalsVersion: any) => string[];
  srUtbildningsmomentTemplates: any[];
};

export default function CourseAddToPlacementSection({
  selCourse,
  profile,
  activities,
  courses,
  startYear,
  setCourses,
  setActivities,
  setDirty,
  isValidISO,
  dateToSlot,
  getCourseDisplayTitle,
  resolveMatchingUtbildningsmoment,
  buildUpdatedPlacementNote,
  sanitizeStMilestonesForGoals,
  srUtbildningsmomentTemplates,
}: Props) {
  if (selCourse.kind !== "Utbildningsmoment") return null;

  const template = srUtbildningsmomentTemplates.find((t) => t.title === selCourse.title);
  if (!template || template.suggested_milestones.length === 0) return null;
  const placements = activities
    .filter((a) => a.type === "Klinisk tjänstgöring")
    .slice()
    .sort((a, b) => {
      const aStart = String((a as any).exactStartISO || "");
      const bStart = String((b as any).exactStartISO || "");
      if (aStart && bStart && aStart !== bStart) return aStart.localeCompare(bStart);
      return Number(a.startSlot || 0) - Number(b.startSlot || 0);
    });
  const dateISO = selCourse.startDate || selCourse.endDate || selCourse.certificateDate || "";
  const courseSlot = dateISO && isValidISO(dateISO) ? dateToSlot(startYear, dateISO, "start") : null;
  const ongoingPlacement =
    courseSlot == null
      ? null
      : placements.find((a) => a.startSlot <= courseSlot && a.startSlot + a.lengthSlots > courseSlot) || null;
  const defaultTargetId = ongoingPlacement?.id ?? null;
  const targetId = String((selCourse as any)?.addToPlacementTargetId ?? defaultTargetId ?? (placements[0]?.id ?? ""));
  const targetPlacement = placements.find((p) => p.id === targetId) || null;

  return (
    <div className="flex items-start gap-2 py-0.5">
      <input
        type="checkbox"
        checked={(selCourse as any).addToPlacement === true}
        className="mt-0.5 accent-emerald-600"
        onChange={(e) => {
          const checked = e.target.checked;
          setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...c, addToPlacement: checked } : c)));
          setDirty(true);
          if (!checked) return;
          const dateISO = selCourse.startDate || selCourse.endDate || selCourse.certificateDate;
          if (!dateISO || !isValidISO(dateISO)) return;
          const courseSlotNow = dateToSlot(startYear, dateISO, "start");
          const placement =
            targetPlacement ||
            activities.find(
              (a) => a.type === "Klinisk tjänstgöring" && a.startSlot <= courseSlotNow && a.startSlot + a.lengthSlots > courseSlotNow
            );
          if (!placement) return;
          const displayTitle = getCourseDisplayTitle(selCourse);
          const { count: antal, uniqueDescriptions: uniqueMomentDescriptions } = resolveMatchingUtbildningsmoment({
            courses: courses as any[],
            displayTitle,
            placement: placement as any,
            startYear,
            isValidISO,
            dateToSlot,
            getCourseDisplayTitle: (course: any) => getCourseDisplayTitle(course),
          });
          const newNote = buildUpdatedPlacementNote(String(placement.note || ""), displayTitle, antal, uniqueMomentDescriptions);
          const currentMilestones: string[] = Array.isArray(placement.milestones) ? placement.milestones : [];
          const merged =
            template.suggested_milestones.length > 0
              ? sanitizeStMilestonesForGoals([...currentMilestones, ...template.suggested_milestones], (profile as any)?.goalsVersion)
              : currentMilestones;
          setActivities((prev) => prev.map((a) => (a.id === placement.id ? { ...a, note: newNote, milestones: merged } : a)));
        }}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm text-slate-700">Lägg till delmål och beskrivning från utbildningsmoment till klinisk tjänstgöring:</span>
        <select
          value={targetId}
          onChange={(e) => {
            const v = e.target.value;
            setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...c, addToPlacementTargetId: v } : c)));
            setDirty(true);
          }}
          className="h-6 rounded border border-slate-300 bg-white px-1.5 text-sm text-slate-700"
          title="Välj klinisk tjänstgöring att koppla till"
        >
          {placements.map((p) => (
            <option key={p.id} value={p.id}>
              {(p.label || "Klinisk tjänstgöring") +
                (p.exactStartISO ? ` (${p.exactStartISO}` : "") +
                (p.exactEndISO ? ` - ${p.exactEndISO})` : p.exactStartISO ? ")" : "")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
