// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import type { Dispatch, SetStateAction } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import { formatDate } from "@/lib/studierektor/dateUtils";
import type { StudentSortColumn } from "@/lib/studierektor/studierektorStudentListColumns";
import {
  calculateProgress,
  getNextPlacement,
  getOngoingPlacement,
  getStudentPhaseLabel,
  getStudentPlannedEndISO,
  mainSupervisorLabel,
  placementLabel,
} from "@/lib/studierektor/studierektorPageStudentUtils";

type ProgressTimelineStatus = {
  status: "ok" | "risk" | "late";
  statusLabel: string;
  statusClass: string;
  riskReasons: string[];
  timeText: string;
};

type Props = {
  clinicLoading: boolean;
  showFormerStudentList: boolean;
  setShowFormerStudentList: Dispatch<SetStateAction<boolean>>;
  formerStudentCount: number;
  sortedFormerStudents: SupervisorStudent[];
  studentCount: number;
  sortedStudents: SupervisorStudent[];
  toggleStudentSort: (column: StudentSortColumn) => void;
  sortIndicator: (column: StudentSortColumn) => string;
  setSelectedStudent: Dispatch<SetStateAction<SupervisorStudent | null>>;
  setDashboardOpen: Dispatch<SetStateAction<boolean>>;
  computeProgressTimelineStatus: (
    student: SupervisorStudent | null,
    endISOInput: string
  ) => ProgressTimelineStatus;
};

export function StudierektorStudentListMain({
  clinicLoading,
  showFormerStudentList,
  setShowFormerStudentList,
  formerStudentCount,
  sortedFormerStudents,
  studentCount,
  sortedStudents,
  toggleStudentSort,
  sortIndicator,
  setSelectedStudent,
  setDashboardOpen,
  computeProgressTimelineStatus,
}: Props) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 select-none">
          {showFormerStudentList ? "Tidigare ST-läkare" : "Mina ST-läkare"}
        </h1>
        <button
          type="button"
          onClick={() => setShowFormerStudentList((v) => !v)}
          disabled={clinicLoading}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {showFormerStudentList ? "Nuvarande ST-läkare" : "Tidigare ST-läkare"}
        </button>
      </div>

      {clinicLoading && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent mb-2"></div>
          <p className="text-slate-600">Laddar ST-läkare från kliniken...</p>
        </div>
      )}

      {!clinicLoading && showFormerStudentList && (
        formerStudentCount > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    <button
                      type="button"
                      onClick={() => toggleStudentSort("name")}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Namn
                      <span className="text-xs text-slate-400">{sortIndicator("name")}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    <button
                      type="button"
                      onClick={() => toggleStudentSort("mainSupervisor")}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Huvudhandledare
                      <span className="text-xs text-slate-400">{sortIndicator("mainSupervisor")}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    <button
                      type="button"
                      onClick={() => toggleStudentSort("stEndDate")}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      ST-slutdatum
                      <span className="text-xs text-slate-400">{sortIndicator("stEndDate")}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedFormerStudents.map((student: SupervisorStudent) => {
                  const stEndISO = getStudentPlannedEndISO(student);
                  return (
                    <tr
                      key={student.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{student.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{mainSupervisorLabel(student)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{stEndISO ? formatDate(stEndISO) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-600">Inga tidigare ST-läkare i kliniken.</p>
          </div>
        )
      )}

      {!clinicLoading && !showFormerStudentList && studentCount > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleStudentSort("name")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Namn
                    <span className="text-xs text-slate-400">{sortIndicator("name")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleStudentSort("goalsVersion")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Målversion
                    <span className="text-xs text-slate-400">{sortIndicator("goalsVersion")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleStudentSort("mainSupervisor")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Huvudhandledare
                    <span className="text-xs text-slate-400">{sortIndicator("mainSupervisor")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleStudentSort("ongoingPlacement")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Pågående placering
                    <span className="text-xs text-slate-400">{sortIndicator("ongoingPlacement")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleStudentSort("nextPlacement")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Nästa placering
                    <span className="text-xs text-slate-400">{sortIndicator("nextPlacement")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleStudentSort("stEndDate")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    ST-slutdatum
                    <span className="text-xs text-slate-400">{sortIndicator("stEndDate")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleStudentSort("progress")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Progress
                    <span className="text-xs text-slate-400">{sortIndicator("progress")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleStudentSort("phase")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Fas
                    <span className="text-xs text-slate-400">{sortIndicator("phase")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                  <button type="button" onClick={() => toggleStudentSort("lastUpdated")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Uppdaterad
                    <span className="text-xs text-slate-400">{sortIndicator("lastUpdated")}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedStudents.map((student: SupervisorStudent) => {
                const progress = calculateProgress(student);
                const ongoing = getOngoingPlacement(student);
                const nextPl = getNextPlacement(student);
                const stEndISO = getStudentPlannedEndISO(student);
                const phase = getStudentPhaseLabel(student);
                const progressTimelineMeta = computeProgressTimelineStatus(student, stEndISO || "");
                const progressBarFillClass =
                  progressTimelineMeta.status === "ok"
                    ? "h-2 rounded-full bg-emerald-500"
                    : "h-2 rounded-full bg-orange-500";
                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{student.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{student.goalsVersion}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{mainSupervisorLabel(student)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{ongoing ? placementLabel(ongoing) : "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{nextPl ? placementLabel(nextPl) : "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{stEndISO ? formatDate(stEndISO) : "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-slate-200">
                          <div className={progressBarFillClass} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-sm text-slate-600">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{phase}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {student.lastUpdated ? new Date(student.lastUpdated).toLocaleDateString("sv-SE") : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !clinicLoading && !showFormerStudentList ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">Inga ST-läkare i kliniken ännu.</p>
          <button
            type="button"
            onClick={() => setDashboardOpen(true)}
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Bjud in via Dashboard
          </button>
        </div>
      ) : null}
    </main>
  );
}
