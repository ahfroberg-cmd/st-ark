"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { validateJsonFile, safeJsonParse } from "@/lib/validation";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import { uid } from "@/lib/studierektor/dateUtils";

type NameChangePromptPayload = {
  existingName: string;
  newName: string;
  personnummer: string;
  pendingData: any;
};

export function useStudentFileImport({
  students,
  setStudents,
  setImporting,
  setNameChangePrompt,
  setInfoToast,
}: {
  students: SupervisorStudent[];
  setStudents: Dispatch<SetStateAction<SupervisorStudent[]>>;
  setImporting: (value: boolean) => void;
  setNameChangePrompt: (value: NameChangePromptPayload) => void;
  setInfoToast: (value: { title: string; message: string } | null) => void;
}) {
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setImporting(true);
      const errors: string[] = [];

      try {
        for (const file of Array.from(files)) {
          try {
            const fileValidation = validateJsonFile(file);
            if (!fileValidation.valid) {
              errors.push(`${file.name}: ${fileValidation.error}`);
              continue;
            }

            const txt = await file.text();
            const parseResult = safeJsonParse(txt);
            if (!parseResult.success || !parseResult.data) {
              errors.push(`${file.name}: ${parseResult.error || "Kunde inte tolka JSON"}`);
              continue;
            }

            const data = parseResult.data;
            const profile = data.profile ?? data?.Profile ?? data?.prof ?? null;
            const placements = data.placements ?? data?.Placements ?? [];
            const courses = data.courses ?? data?.Courses ?? [];
            const achievements = data.achievements ?? data?.Achievements ?? [];
            const rawTimeline = data.timeline ?? data?.Timeline ?? data?.TIMELINE ?? [];
            const timeline = Array.isArray(rawTimeline) ? rawTimeline : rawTimeline ? [rawTimeline] : [];
            const iupMilestonePlans = data.iupMilestonePlans ?? [];

            if (!profile) {
              errors.push(`${file.name}: Ingen profil hittades i filen`);
              continue;
            }

            const name = profile.name || profile.fullName || "Okänd";
            const personnummer = profile.personnummer || profile.personalNumber || profile.pnr || "";
            const specialty = profile.specialty || profile.speciality || "Ej angiven";
            const goalsVersion = profile.goalsVersion === "2015" ? "2015" : "2021";

            const existingByPnr = personnummer
              ? (students || []).find((s: SupervisorStudent) => s.personnummer === personnummer)
              : null;

            if (existingByPnr && existingByPnr.name !== name) {
              setNameChangePrompt({
                existingName: existingByPnr.name,
                newName: name,
                personnummer,
                pendingData: {
                  id: existingByPnr.id,
                  personnummer,
                  specialty,
                  goalsVersion,
                  importedAt: existingByPnr.importedAt,
                  lastUpdated: new Date().toISOString(),
                  profile,
                  placements,
                  courses,
                  achievements,
                  timeline,
                  iupMilestonePlans,
                },
              });
              continue;
            }

            const studentData: SupervisorStudent = {
              id: existingByPnr?.id || uid(),
              name,
              personnummer,
              specialty,
              goalsVersion,
              importedAt: existingByPnr?.importedAt || new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              profile,
              placements,
              courses,
              achievements,
              timeline,
              iupMilestonePlans,
            };

            setStudents((prev) => {
              const idx = prev.findIndex((s) => s.id === studentData.id);
              if (idx >= 0) return [...prev.slice(0, idx), studentData, ...prev.slice(idx + 1)];
              return [...prev, studentData];
            });

            if (existingByPnr) {
              setInfoToast({
                title: "Fil ersatte befintlig",
                message: `Personnummer ${personnummer} fanns redan. Data uppdaterades från \"${file.name}\".`,
              });
            }
          } catch (err) {
            errors.push(`${file.name}: ${err instanceof Error ? err.message : "Okänt fel"}`);
          }
        }

        if (errors.length > 0) {
          alert(`Några filer kunde inte importeras:\n\n${errors.join("\n")}`);
        }
      } finally {
        setImporting(false);
      }
    },
    [setImporting, setInfoToast, setNameChangePrompt, setStudents, students]
  );

  return { handleFiles };
}
