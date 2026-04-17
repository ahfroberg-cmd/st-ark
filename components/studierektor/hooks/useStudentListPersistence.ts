"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import { downloadStudentList, parseStudentListFile } from "@/lib/studierektor/listPersistence";

export function useStudentListPersistence({
  students,
  setStudents,
}: {
  students: SupervisorStudent[];
  setStudents: Dispatch<SetStateAction<SupervisorStudent[]>>;
}) {
  const saveList = useCallback(async () => {
    await downloadStudentList(students);
  }, [students]);

  const loadList = useCallback(
    async (file: File) => {
      try {
        const loadedStudents = await parseStudentListFile(file);
        for (const student of loadedStudents) {
          setStudents((prev) => {
            const idx = prev.findIndex((s) => s.id === student.id);
            if (idx >= 0) return [...prev.slice(0, idx), student, ...prev.slice(idx + 1)];
            return [...prev, student];
          });
        }
      } catch {
        alert("Kunde inte läsa sparfilen.");
      }
    },
    [setStudents]
  );

  return { saveList, loadList };
}
