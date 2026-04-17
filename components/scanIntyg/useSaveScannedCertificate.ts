"use client";

import { useCallback } from "react";
import type { IntygKind } from "@/lib/intygDetect";
import { mapAndSaveKurs, mapAndSavePlacement2015 } from "@/lib/intygMap";
import { supabase } from "@/lib/supabase";
import {
  insertActivityDocumentRow,
  updateActivityDocumentLink,
} from "@/lib/repositories/starkRepository";
import type { ExistingAppDocument } from "@/components/scanIntyg/useDocumentPickerState";

type Args = {
  parsed: any;
  kind: IntygKind | null;
  file: File | null;
  attachUploadedDocument: boolean;
  sourceAppDocument: ExistingAppDocument | null;
  onSaved?: () => void;
  setWarning: React.Dispatch<React.SetStateAction<string | null>>;
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setBaselineParsed: React.Dispatch<any>;
  handleForceClose: () => void;
};

export function useSaveScannedCertificate({
  parsed,
  kind,
  file,
  attachUploadedDocument,
  sourceAppDocument,
  onSaved,
  setWarning,
  setBusy,
  setBaselineParsed,
  handleForceClose,
}: Args) {
  const checkOverlappingDates = useCallback(async (): Promise<{ hasOverlap: boolean; overlappingItems: string[] }> => {
    const overlappingItems: string[] = [];
    const parsedPeriod = (parsed as any)?.period;
    let startISO: string = (parsedPeriod?.startISO as string | undefined) || "";
    let endISO: string = (parsedPeriod?.endISO as string | undefined) || "";

    if (!startISO && !endISO) {
      const certRaw = (parsed as any)?.certificateDate || "";
      const certISO = typeof certRaw === "string" && certRaw ? certRaw : "";
      if (certISO) {
        startISO = certISO;
        endISO = certISO;
      }
    }

    if (startISO && !endISO) endISO = startISO;
    else if (!startISO && endISO) startISO = endISO;

    if (!startISO || !endISO) {
      return { hasOverlap: false, overlappingItems: [] };
    }

    const datesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean =>
      start1 <= end2 && start2 <= end1;

    const allPlacements: any[] = [];
    if (false) {
      for (const placement of allPlacements) {
        if (!placement.showOnTimeline) continue;
        const placementType = String(placement.type || "").toLowerCase();
        if (!placementType.includes("klinisk")) continue;
        const placementStart = placement.startDate || placement.endDate || placement.certificateDate || "";
        const placementEnd = placement.endDate || placement.startDate || placement.certificateDate || "";
        if (placementStart && placementEnd && datesOverlap(startISO, endISO, placementStart, placementEnd)) {
          const clinic = placement.clinic || placement.title || "";
          const label = clinic ? `Klinisk tjänstgöring: ${clinic}` : "Klinisk tjänstgöring";
          overlappingItems.push(`${label} (${placementStart} - ${placementEnd})`);
        }
      }
    }

    return { hasOverlap: overlappingItems.length > 0, overlappingItems };
  }, [parsed]);

  const handleSave = useCallback(async () => {
    if (!parsed) return;
    setBusy(true);

    try {
      if (kind === "2021-B10-KURS" || kind === "2021-B11-UTV") {
        const hasStartDate = !!(parsed as any)?.period?.startISO;
        const hasEndDate = !!(parsed as any)?.period?.endISO;
        if (!hasStartDate && !hasEndDate) {
          setWarning("Du måste ange datum för placering i tidslinjen innan du kan spara intyget.");
          setBusy(false);
          return;
        }
      }

      const looksLikeCourse =
        kind === "2015-B5-KURS" ||
        kind === "2021-B10-KURS" ||
        Boolean((parsed as any)?.courseTitle || (parsed as any)?.subject);
      const shouldCheckOverlap = (kind === "2015-B4-KLIN" || kind === "2021-B9-KLIN") && !looksLikeCourse;
      if (shouldCheckOverlap) {
        const overlapCheck = await checkOverlappingDates();
        if (overlapCheck.hasOverlap) {
          const itemsList = overlapCheck.overlappingItems.join("\n");
          setWarning(
            `Det finns redan aktiviteter på tidslinjen med överlappande datum:\n\n${itemsList}\n\nVänligen kontrollera datumen innan du sparar.`
          );
          setBusy(false);
          return;
        }
      }

      let createdKind: "placement" | "course" | null = null;
      let createdId: string | number | null = null;

      switch (kind) {
        case "2021-B10-KURS":
          createdKind = "course";
          createdId = await mapAndSaveKurs({
            ...parsed,
            showOnTimeline: !!(parsed as any)?.showOnTimeline,
            showAsInterval: !!(parsed as any)?.showAsInterval,
          });
          break;
        case "2015-B5-KURS":
          createdKind = "course";
          createdId = await mapAndSaveKurs(parsed);
          break;
        case "2021-B11-UTV":
          createdKind = "placement";
          createdId = await mapAndSavePlacement2015({
            ...parsed,
            clinic: (parsed as any)?.subject || (parsed as any)?.clinic,
          });
          break;
        case "2021-B8-AUSK":
        case "2021-B9-KLIN":
        case "2015-B3-AUSK":
        case "2015-B4-KLIN":
        case "2015-B6-UTV":
        case "2015-B7-SKRIFTLIGT":
          createdKind = "placement";
          createdId = await mapAndSavePlacement2015(parsed);
          break;
        default:
          setWarning("Sparfunktion saknas för vald intygsmall i denna version.");
          setBusy(false);
          return;
      }

      if (attachUploadedDocument && file && createdKind && createdId != null) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;
          if (userId) {
            const ext = String(file.name.split(".").pop() || "bin").toLowerCase();
            const safeKind = createdKind === "placement" ? "placement" : "course";
            if (sourceAppDocument?.id) {
              await updateActivityDocumentLink(sourceAppDocument.id, userId, {
                activity_kind: safeKind,
                activity_id: String(createdId),
              });
            } else {
              const targetKey = `${safeKind}:${String(createdId)}`;
              const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
              const filePath = `${userId}/${targetKey}/${fileName}`;
              const { error: uploadError } = await supabase.storage
                .from("activity-documents")
                .upload(filePath, file, {
                  upsert: false,
                  cacheControl: "3600",
                  contentType: file.type || "application/octet-stream",
                });
              if (!uploadError) {
                await insertActivityDocumentRow({
                  user_id: userId,
                  title: file.name || "Skannat intyg",
                  activity_kind: safeKind,
                  activity_id: String(createdId),
                  file_path: filePath,
                  mime_type: file.type || "application/octet-stream",
                  size_bytes: file.size || 0,
                });
              }
            }
          }
        } catch (e) {
          console.warn("Kunde inte koppla dokument till aktivitet:", e);
        }
      }

      try {
        if (typeof window !== "undefined") {
          try {
            window.localStorage?.setItem("timeline_sync", String(Date.now()));
          } catch {
            // ignore
          }
          try {
            window.dispatchEvent(new Event("timeline_sync"));
          } catch {
            // ignore
          }
          if (createdKind && createdId != null) {
            try {
              window.dispatchEvent(
                new CustomEvent("timeline_select_from_scan", {
                  detail: { kind: createdKind, dbId: createdId },
                })
              );
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }

      onSaved?.();
      setBaselineParsed(null);
      handleForceClose();
    } finally {
      setBusy(false);
    }
  }, [
    attachUploadedDocument,
    checkOverlappingDates,
    file,
    handleForceClose,
    kind,
    onSaved,
    parsed,
    setBaselineParsed,
    setBusy,
    setWarning,
    sourceAppDocument?.id,
  ]);

  return { handleSave };
}
