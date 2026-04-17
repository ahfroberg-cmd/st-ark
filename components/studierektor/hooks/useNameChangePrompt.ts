"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import type { NameChangePromptData } from "@/components/studierektor/NameChangePromptModal";

export function useNameChangePrompt({
  nameChangePrompt,
  setNameChangePrompt,
  setStudents,
  setInfoToast,
}: {
  nameChangePrompt: NameChangePromptData | null;
  setNameChangePrompt: Dispatch<SetStateAction<NameChangePromptData | null>>;
  setStudents: Dispatch<SetStateAction<SupervisorStudent[]>>;
  setInfoToast: (value: { title: string; message: string } | null) => void;
}) {
  const handleNameChange = useCallback(
    async (useName: "existing" | "new") => {
      if (!nameChangePrompt) return;
      const { pendingData, existingName, newName } = nameChangePrompt;
      const finalName = useName === "existing" ? existingName : newName;
      setStudents((prev) => {
        const idx = prev.findIndex((s) => s.id === pendingData.id);
        const updated = { ...pendingData, name: finalName };
        if (idx >= 0) return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
        return [...prev, updated];
      });
      setInfoToast({
        title: "Fil ersatte befintlig",
        message: `Personnummer ${nameChangePrompt.personnummer} fanns redan. Data uppdaterades och namn sattes till "${finalName}".`,
      });
      setNameChangePrompt(null);
    },
    [nameChangePrompt, setInfoToast, setNameChangePrompt, setStudents]
  );

  return { handleNameChange };
}
