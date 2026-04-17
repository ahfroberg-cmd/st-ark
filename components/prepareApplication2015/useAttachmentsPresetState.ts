"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttachmentItem, PresetKey } from "@/components/prepareApplication2015/attachmentsDomain";

type Args = {
  open: boolean;
  profileIsThirdCountrySpecialist: boolean;
  sortByBilagaNumber: (a: AttachmentItem, b: AttachmentItem) => number;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
  isoToday: () => string;
};

export function useAttachmentsPresetState({
  open,
  profileIsThirdCountrySpecialist,
  sortByBilagaNumber,
  setDirty,
  isoToday,
}: Args) {
  const [paidFeeDate, setPaidFeeDate] = useState<string>(isoToday());
  const [presetChecked, setPresetChecked] = useState<Record<PresetKey, boolean>>({
    intyg: true,
    svDoc: false,
    foreignDocEval: false,
    foreignService: false,
    thirdCountry: true,
    individProg: false,
  });
  const [presetDates, setPresetDates] = useState<Record<PresetKey, string>>({
    intyg: isoToday(),
    svDoc: isoToday(),
    foreignDocEval: isoToday(),
    foreignService: isoToday(),
    thirdCountry: isoToday(),
    individProg: isoToday(),
  });
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [userReordered, setUserReordered] = useState(false);

  const markSaveEnabled = useCallback(() => {
    try {
      (document.getElementById("save-2015") ?? document.getElementById("save-2021"))?.setAttribute(
        "data-disabled",
        "false"
      );
    } catch {
      // no-op
    }
  }, []);

  const rebuildWithPresets = useCallback(
    (nextChecked: Record<PresetKey, boolean>, nextDates: Record<PresetKey, string>) => {
      const base = attachments.filter((x) => !x.preset);
      const list: AttachmentItem[] = [];

      if (nextChecked.intyg) {
        list.push({
          id: "preset-intyg",
          type: "Uppnådd specialistkompetens",
          label: "Uppnådd specialistkompetens",
          date: nextDates.intyg || isoToday(),
          preset: "intyg",
        });
      }

      list.push(...base);

      if (nextChecked.svDoc) {
        list.push({
          id: "preset-svdoc",
          type: "Svensk doktorsexamen",
          label: "Godkänd svensk doktorsexamen",
          date: nextDates.svDoc || isoToday(),
          preset: "svDoc",
        });
      }

      if (nextChecked.foreignDocEval) {
        list.push({
          id: "preset-foreignDocEval",
          type: "Utländsk doktorsexamen",
          label: "Bedömning av utländsk doktorsexamen",
          date: nextDates.foreignDocEval || isoToday(),
          preset: "foreignDocEval",
        });
      }

      if (nextChecked.foreignService) {
        list.push({
          id: "preset-foreignService",
          type: "Utländsk tjänstgöring",
          label: "Intyg om utländsk tjänstgöring",
          date: nextDates.foreignService || isoToday(),
          preset: "foreignService",
        });
      }

      if (nextChecked.thirdCountry && profileIsThirdCountrySpecialist) {
        list.push({
          id: "preset-thirdCountry-8a",
          type: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
          label: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
          date: nextDates.thirdCountry || isoToday(),
          preset: "thirdCountry",
        });
        list.push({
          id: "preset-thirdCountry-8b",
          type: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
          label: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
          date: nextDates.thirdCountry || isoToday(),
          preset: "thirdCountry",
        });
      }

      if (nextChecked.individProg && profileIsThirdCountrySpecialist) {
        list.push({
          id: "preset-individProg",
          type: "Individuellt utbildningsprogram",
          label: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
          date: nextDates.individProg || isoToday(),
          preset: "individProg",
        });
      }

      setAttachments(userReordered ? list : list.slice().sort(sortByBilagaNumber));
      setDirty(true);
    },
    [attachments, isoToday, profileIsThirdCountrySpecialist, setDirty, sortByBilagaNumber, userReordered]
  );

  const togglePreset = useCallback(
    (key: PresetKey) => {
      setPresetChecked((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        rebuildWithPresets(next, presetDates);
        return next;
      });
      markSaveEnabled();
    },
    [markSaveEnabled, presetDates, rebuildWithPresets]
  );

  const updatePresetDate = useCallback(
    (key: PresetKey, dateISO: string) => {
      setPresetDates((prev) => {
        const next = { ...prev, [key]: dateISO };
        setAttachments((list) => list.map((it) => (it.preset === key ? { ...it, date: dateISO } : it)));
        return next;
      });
      setDirty(true);
      markSaveEnabled();
    },
    [markSaveEnabled, setDirty]
  );

  useEffect(() => {
    if (!open) return;

    setAttachments((prev) => {
      const list = [...prev];
      let changed = false;

      if (presetChecked.intyg && !list.some((it) => it.preset === "intyg")) {
        list.push({
          id: "preset-intyg",
          type: "Uppnådd specialistkompetens",
          label: "Uppnådd specialistkompetens",
          date: presetDates.intyg || isoToday(),
          preset: "intyg",
        });
        changed = true;
      }

      if (presetChecked.thirdCountry && profileIsThirdCountrySpecialist) {
        if (!list.some((it) => it.id === "preset-thirdCountry-8a")) {
          list.push({
            id: "preset-thirdCountry-8a",
            type: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
            label: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
            date: presetDates.thirdCountry || isoToday(),
            preset: "thirdCountry",
          });
          changed = true;
        }
        if (!list.some((it) => it.id === "preset-thirdCountry-8b")) {
          list.push({
            id: "preset-thirdCountry-8b",
            type: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
            label: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
            date: presetDates.thirdCountry || isoToday(),
            preset: "thirdCountry",
          });
          changed = true;
        }
      } else {
        const filtered = list.filter((it) => it.id !== "preset-thirdCountry-8a" && it.id !== "preset-thirdCountry-8b");
        if (filtered.length !== list.length) {
          list.length = 0;
          list.push(...filtered);
          changed = true;
        }
      }

      if (!changed) return prev;
      return userReordered ? list : list.slice().sort(sortByBilagaNumber);
    });
  }, [
    isoToday,
    open,
    presetChecked.intyg,
    presetChecked.thirdCountry,
    presetDates.intyg,
    presetDates.thirdCountry,
    profileIsThirdCountrySpecialist,
    sortByBilagaNumber,
    userReordered,
  ]);

  return {
    paidFeeDate,
    setPaidFeeDate,
    presetChecked,
    setPresetChecked,
    presetDates,
    setPresetDates,
    attachments,
    setAttachments,
    userReordered,
    setUserReordered,
    togglePreset,
    updatePresetDate,
    rebuildWithPresets,
  };
}
