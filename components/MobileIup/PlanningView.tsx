// components/MobileIup/PlanningView.tsx
"use client";

import React, { useState } from "react";
import type { IupPlanning, ExtraPlanningSection } from "@/components/IupModal";

type Props = {
  planning: IupPlanning;
  setPlanning: (planning: IupPlanning) => void;
  planningExtra: ExtraPlanningSection[];
  setPlanningExtra: (sections: ExtraPlanningSection[]) => void;
  setDirty: (dirty: boolean) => void;
};

const PLANNING_FIELDS: [keyof IupPlanning, string][] = [
  ["clinicalService", "Kliniska tjänstgöringar"],
  ["courses", "Kurser"],
  ["supervisionMeetings", "Handledarsamtal"],
  ["theoreticalStudies", "Teoretiska studier"],
  ["researchWork", "Vetenskapligt arbete"],
  ["journalClub", "Journal club"],
  ["congresses", "Kongresser"],
  ["qualityWork", "Kvalitetsarbete"],
  ["patientSafety", "Patientsäkerhetsarbete"],
  ["leadership", "Ledarskap"],
  ["supervisingStudents", "Handledning av studenter/underläkare"],
  ["teaching", "Undervisning"],
  ["formativeAssessments", "Formativa bedömningar"],
];

export default function PlanningView({
  planning,
  setPlanning,
  planningExtra,
  setPlanningExtra,
  setDirty,
}: Props) {
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const addPlanningSection = () => {
    const trimmed = newSectionTitle.trim();
    if (!trimmed) return;
    const id = `ps_${Math.random().toString(36).slice(2, 10)}`;
    setPlanningExtra([...planningExtra, { id, title: trimmed, content: "" }]);
    setNewSectionTitle("");
    setDirty(true);
  };

  const removePlanningSection = (id: string) => {
    setPlanningExtra(planningExtra.filter((sec) => sec.id !== id));
    setDirty(true);
  };

  const updatePlanning = (key: keyof IupPlanning, value: string) => {
    setPlanning({ ...planning, [key]: value });
    setDirty(true);
  };

  const updatePlanningSectionContent = (id: string, content: string) => {
    setPlanningExtra(
      planningExtra.map((sec) => (sec.id === id ? { ...sec, content } : sec))
    );
    setDirty(true);
  };

  return (
    <div className="space-y-6">

      {/* Övergripande mål */}
      <div>
        <label className="mb-3 block text-base font-semibold text-slate-800">
          Övergripande mål med utbildningen
        </label>
        <textarea
          rows={5}
          value={planning.overallGoals}
          onChange={(e) => updatePlanning("overallGoals", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
        />
      </div>

      {/* Övriga planeringsrubriker */}
      <div className="space-y-5">
        <h3 className="text-base font-semibold text-slate-800">
          Övriga planeringsrubriker
        </h3>

        <div className="space-y-5">
          {PLANNING_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label className="mb-3 block text-base font-semibold text-slate-800">
                {label}
              </label>
              <textarea
                rows={4}
                value={planning[key]}
                onChange={(e) => updatePlanning(key, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
          ))}

          {/* Dynamiskt tillagda rubriker */}
          {planningExtra.map((sec) => (
            <div key={sec.id}>
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-base font-semibold text-slate-800">
                  {sec.title}
                </label>
                <button
                  type="button"
                  onClick={() => removePlanningSection(sec.id)}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 active:translate-y-px"
                >
                  Ta bort
                </button>
              </div>
              <textarea
                rows={4}
                value={sec.content}
                onChange={(e) => updatePlanningSectionContent(sec.id, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
          ))}
        </div>

        {/* Lägg till ny rubrik */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <label className="mb-3 block text-base font-semibold text-slate-800">
            Lägg till ny planeringsrubrik
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Rubrik..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPlanningSection();
                }
              }}
            />
            <button
              type="button"
              onClick={addPlanningSection}
              className="rounded-lg border border-sky-600 bg-sky-600 px-6 py-3 text-base font-semibold text-white hover:bg-sky-700 active:translate-y-px whitespace-nowrap"
            >
              Lägg till
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

