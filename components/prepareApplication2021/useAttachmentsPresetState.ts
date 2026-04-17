"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type AttachmentItem,
  type PresetKey,
} from "@/components/prepareApplication2021/attachmentsDomain";

type Args = {
  open: boolean;
  isoToday: () => string;
  sortByBilaga: (a: AttachmentItem, b: AttachmentItem) => number;
  markDirty: () => void;
};

export function useAttachmentsPresetState2021({
  open,
  isoToday,
  sortByBilaga,
  markDirty,
}: Args) {
  const [paidFeeDate, setPaidFeeDate] = useState<string>(isoToday());
  const [btApprovedDate, setBtApprovedDate] = useState<string>(isoToday());
  const [presetChecked, setPresetChecked] = useState<Record<PresetKey, boolean>>({
    fullgjordST: true,
    intyg: true,
    sta3: false,
    svDoc: false,
    foreignDocEval: false,
    foreignService: false,
    thirdCountry: false,
    individProg: false,
  });
  const [presetDates, setPresetDates] = useState<Record<PresetKey, string>>({
    fullgjordST: isoToday(),
    intyg: isoToday(),
    sta3: isoToday(),
    svDoc: isoToday(),
    foreignDocEval: isoToday(),
    foreignService: isoToday(),
    thirdCountry: isoToday(),
    individProg: isoToday(),
  });
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [userReordered, setUserReordered] = useState(false);
  const [tempOrder, setTempOrder] = useState<AttachmentItem[]>([]);

  useEffect(() => setTempOrder(attachments), [attachments]);

  const markSaveEnabled = useCallback(() => {
    try {
      (document.getElementById("save-2015") ?? document.getElementById("save-2021"))?.setAttribute(
        "data-disabled",
        "false"
      );
    } catch {
      // ignore DOM edge cases
    }
  }, []);

  const rebuildWithPresets = useCallback(
    (nextChecked: Record<PresetKey, boolean>, nextDates: Record<PresetKey, string>) => {
      setAttachments((currentAttachments) => {
        const base = currentAttachments.filter((x) => !x.preset);
        const list: AttachmentItem[] = [];

        if (nextChecked.fullgjordST) {
          list.push({
            id: "preset-fullgjordST",
            type: "Fullgjord specialiseringstjänstgöring",
            label: "Intyg om fullgjord specialiseringstjänstgöring",
            date: nextDates.fullgjordST || isoToday(),
            preset: "fullgjordST",
          });
        }
        if (nextChecked.intyg) {
          list.push({
            id: "preset-intyg",
            type: "Uppnådd specialistkompetens",
            label: "Uppnådd specialistkompetens",
            date: nextDates.intyg || isoToday(),
            preset: "intyg",
          });
        }
        if (nextChecked.sta3) {
          list.push({
            id: "preset-sta3",
            type: "Delmål STa3",
            label: "Intyg delmål STa3",
            date: nextDates.sta3 || isoToday(),
            preset: "sta3",
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
        if (nextChecked.thirdCountry) {
          list.push({
            id: "preset-thirdCountry",
            type: "Delmål för specialistläkare från tredjeland",
            label: "Delmål för specialistläkare från tredjeland",
            date: nextDates.thirdCountry || isoToday(),
            preset: "thirdCountry",
          });
        }
        if (nextChecked.individProg) {
          list.push({
            id: "preset-individProg",
            type: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
            label: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
            date: nextDates.individProg || isoToday(),
            preset: "individProg",
          });
        }

        const fullgjordST = list.filter((a) => a.type === "Fullgjord specialiseringstjänstgöring");
        const rest = list.filter((a) => a.type !== "Fullgjord specialiseringstjänstgöring");
        return userReordered ? [...fullgjordST, ...rest] : [...fullgjordST, ...rest.slice().sort(sortByBilaga)];
      });
      markDirty();
    },
    [isoToday, markDirty, sortByBilaga, userReordered]
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
      markDirty();
      markSaveEnabled();
    },
    [markDirty, markSaveEnabled]
  );

  useEffect(() => {
    if (!open) return;
    if (attachments.length === 0) return;
    rebuildWithPresets(presetChecked, presetDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetChecked, presetDates, attachments.length]);

  return {
    paidFeeDate,
    setPaidFeeDate,
    btApprovedDate,
    setBtApprovedDate,
    presetChecked,
    setPresetChecked,
    presetDates,
    setPresetDates,
    attachments,
    setAttachments,
    userReordered,
    setUserReordered,
    tempOrder,
    setTempOrder,
    rebuildWithPresets,
    togglePreset,
    updatePresetDate,
  };
}
