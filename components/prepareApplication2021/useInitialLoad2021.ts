"use client";

import { useEffect } from "react";
import { addMonths, toISO } from "@/lib/dateutils";
import { loadGoals } from "@/lib/goals";
import { supabase } from "@/lib/supabase";
import {
  buildDefaultAttachmentsFor2021,
  type AttachmentItem,
  type PresetKey,
} from "@/components/prepareApplication2021/attachmentsDomain";

type Args = {
  open: boolean;
  storageKey: string;
  isoToday: () => string;
  makeId: () => string;
  sortByBilaga: (a: AttachmentItem, b: AttachmentItem) => number;
  presetChecked: Record<PresetKey, boolean>;
  presetDates: Record<PresetKey, string>;
  managerModeChangedRef: React.MutableRefObject<boolean>;
  setPlacements: React.Dispatch<React.SetStateAction<any[]>>;
  setCourses: React.Dispatch<React.SetStateAction<any[]>>;
  setApplicant: React.Dispatch<React.SetStateAction<any>>;
  setCert: React.Dispatch<React.SetStateAction<any>>;
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
  setTempOrder: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
  setPaidFeeDate: React.Dispatch<React.SetStateAction<string>>;
  setBtApprovedDate: React.Dispatch<React.SetStateAction<string>>;
  setPresetChecked: React.Dispatch<React.SetStateAction<Record<PresetKey, boolean>>>;
  setPresetDates: React.Dispatch<React.SetStateAction<Record<PresetKey, string>>>;
  setSta3OtherText: React.Dispatch<React.SetStateAction<string>>;
  setSta3HowVerifiedText: React.Dispatch<React.SetStateAction<string>>;
  setThirdCountryDelmalCodes: React.Dispatch<React.SetStateAction<string>>;
  setThirdCountryMilestones: React.Dispatch<React.SetStateAction<Set<string>>>;
  setThirdCountryActivities: React.Dispatch<React.SetStateAction<string>>;
  setThirdCountryVerification: React.Dispatch<React.SetStateAction<string>>;
  setProfile: React.Dispatch<React.SetStateAction<any>>;
  setGoals: React.Dispatch<React.SetStateAction<any>>;
};

export function useInitialLoad2021({
  open,
  storageKey,
  isoToday,
  makeId,
  sortByBilaga,
  presetChecked,
  presetDates,
  managerModeChangedRef,
  setPlacements,
  setCourses,
  setApplicant,
  setCert,
  setAttachments,
  setTempOrder,
  setPaidFeeDate,
  setBtApprovedDate,
  setPresetChecked,
  setPresetDates,
  setSta3OtherText,
  setSta3HowVerifiedText,
  setThirdCountryDelmalCodes,
  setThirdCountryMilestones,
  setThirdCountryActivities,
  setThirdCountryVerification,
  setProfile,
  setGoals,
}: Args) {
  useEffect(() => {
    if (!open) return;

    (async () => {
      let saved: any = null;
      let hadSavedPresetDates = false;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: draftRow } = await supabase
            .from("app_drafts")
            .select("draft_data")
            .eq("user_id", user.id)
            .eq("draft_key", "st_application_2021")
            .maybeSingle();
          if (draftRow?.draft_data) saved = draftRow.draft_data;
        }

        if (!saved) {
          const savedRaw = localStorage.getItem(storageKey);
          if (savedRaw) saved = JSON.parse(savedRaw);
        }

        if (saved) {
          if (saved.placements) setPlacements(saved.placements);
          if (saved.courses) setCourses(saved.courses);
          if (saved.applicant) setApplicant(saved.applicant);

          if (saved.cert) {
            const savedCert = saved.cert as any;
            setCert((prev: any) => {
              const nextManagerMode = savedCert.managerMode || prev.managerMode || "self";
              return {
                ...prev,
                ...savedCert,
                managerMode: nextManagerMode,
                mainSupervisor: {
                  ...(savedCert.mainSupervisor || prev.mainSupervisor),
                  name: "",
                },
                certifyingSpecialist: {
                  name: savedCert.certifyingSpecialist?.name || prev.certifyingSpecialist?.name || "",
                  specialty:
                    savedCert.certifyingSpecialist?.specialty || prev.certifyingSpecialist?.specialty || "",
                  workplace:
                    savedCert.certifyingSpecialist?.workplace || prev.certifyingSpecialist?.workplace || "",
                },
              };
            });
            const mm = savedCert.managerMode || "self";
            managerModeChangedRef.current = mm !== "self";
          }

          if (Array.isArray(saved.attachments) && saved.attachments.length > 0) {
            setAttachments(saved.attachments);
            setTempOrder(saved.attachments);
          }

          if (typeof saved.paidFeeDate === "string" && saved.paidFeeDate) setPaidFeeDate(saved.paidFeeDate);
          if (typeof saved.btApprovedDate === "string" && saved.btApprovedDate) setBtApprovedDate(saved.btApprovedDate);

          if (saved.presetChecked) {
            const savedPresetChecked = saved.presetChecked as Record<PresetKey, boolean>;
            setPresetChecked({
              fullgjordST: savedPresetChecked.fullgjordST ?? true,
              intyg: savedPresetChecked.intyg ?? true,
              sta3: savedPresetChecked.sta3 ?? false,
              svDoc: savedPresetChecked.svDoc ?? false,
              foreignDocEval: savedPresetChecked.foreignDocEval ?? false,
              foreignService: savedPresetChecked.foreignService ?? false,
              thirdCountry: savedPresetChecked.thirdCountry ?? false,
              individProg: savedPresetChecked.individProg ?? false,
            });
          }

          if (saved.presetDates) {
            hadSavedPresetDates = true;
            const savedPresetDates = saved.presetDates as Record<PresetKey, string>;
            setPresetDates({
              fullgjordST: savedPresetDates.fullgjordST ?? isoToday(),
              intyg: savedPresetDates.intyg ?? isoToday(),
              sta3: savedPresetDates.sta3 ?? isoToday(),
              svDoc: savedPresetDates.svDoc ?? isoToday(),
              foreignDocEval: savedPresetDates.foreignDocEval ?? isoToday(),
              foreignService: savedPresetDates.foreignService ?? isoToday(),
              thirdCountry: savedPresetDates.thirdCountry ?? isoToday(),
              individProg: savedPresetDates.individProg ?? isoToday(),
            });
          }

          if (typeof saved.sta3OtherText === "string") setSta3OtherText(saved.sta3OtherText);
          if (typeof saved.sta3HowVerifiedText === "string") setSta3HowVerifiedText(saved.sta3HowVerifiedText);

          if (typeof saved.thirdCountryDelmalCodes === "string") {
            setThirdCountryDelmalCodes(saved.thirdCountryDelmalCodes);
            if (saved.thirdCountryDelmalCodes) {
              const codes = saved.thirdCountryDelmalCodes
                .split(",")
                .map((c: string) => c.trim())
                .filter(Boolean);
              setThirdCountryMilestones(new Set(codes));
            }
          }
          if (typeof saved.thirdCountryActivities === "string") setThirdCountryActivities(saved.thirdCountryActivities);
          if (typeof saved.thirdCountryVerification === "string") setThirdCountryVerification(saved.thirdCountryVerification);
        }
      } catch (err) {
        console.error("Kunde inte ladda specialistansökan:", err);
      }

      const [p, pls, crs] = await Promise.all([null, [], []]);
      setProfile(p ?? null);

      if ((p as any)?.goalsVersion && ((p as any).specialty || (p as any).speciality)) {
        try {
          const g = await loadGoals((p as any).goalsVersion, (p as any).specialty || (p as any).speciality || "");
          setGoals(g);
        } catch {
          setGoals(null);
        }
      } else {
        setGoals(null);
      }

      const gvRaw = String((p as any)?.goalsVersion || "").toLowerCase();
      const is2021 = gvRaw.includes("2021");

      if (p && is2021) {
        const btEndManual = (p as any)?.btEndDate;
        const btStartISO = (p as any)?.btStartDate;

        let calculatedBtEnd: string | null = null;
        if (btEndManual && /^\d{4}-\d{2}-\d{2}$/.test(btEndManual)) {
          calculatedBtEnd = btEndManual;
        } else if (btStartISO && /^\d{4}-\d{2}-\d{2}$/.test(btStartISO)) {
          try {
            const btDate = new Date(btStartISO + "T00:00:00");
            const btEndDate = addMonths(btDate, 24);
            calculatedBtEnd = toISO(btEndDate);
          } catch {
            // ignore invalid date input
          }
        }
        if (calculatedBtEnd && !saved?.btApprovedDate) setBtApprovedDate(calculatedBtEnd);
      }

      const allPlacements = (pls || []) as any[];
      const allCourses = (crs || []) as any[];
      const filteredPlacements = is2021
        ? allPlacements.filter((pl) => {
            const phase = String(pl?.phase || "ST").toUpperCase();
            const fulfills = !!pl?.fulfillsStGoals;
            return phase === "ST" || fulfills;
          })
        : allPlacements;
      const filteredCourses = is2021
        ? allCourses.filter((c) => {
            const phase = String(c?.phase || "ST").toUpperCase();
            const fulfills = !!c?.fulfillsStGoals;
            return phase === "ST" || fulfills;
          })
        : allCourses;

      setPlacements(filteredPlacements as any);
      setCourses(filteredCourses as any);

      const built: AttachmentItem[] = buildDefaultAttachmentsFor2021({
        placements: filteredPlacements as any,
        courses: filteredCourses as any,
      });
      const baseList: AttachmentItem[] = built;
      const list: AttachmentItem[] = [];

      if (presetChecked.fullgjordST) {
        list.push({
          id: "preset-fullgjordST",
          type: "Fullgjord specialiseringstjänstgöring",
          label: "Intyg om fullgjord specialiseringstjänstgöring",
          date: presetDates.fullgjordST || isoToday(),
          preset: "fullgjordST",
        });
      }
      if (presetChecked.intyg) {
        list.push({
          id: "preset-intyg",
          type: "Uppnådd specialistkompetens",
          label: "Uppnådd specialistkompetens",
          date: presetDates.intyg || isoToday(),
          preset: "intyg",
        });
      }
      if (presetChecked.sta3) {
        list.push({
          id: "preset-sta3",
          type: "Delmål STa3",
          label: "Intyg delmål STa3",
          date: presetDates.sta3 || isoToday(),
          preset: "sta3",
        });
      }

      list.push(...baseList);

      if (presetChecked.svDoc) {
        list.push({
          id: "preset-svdoc",
          type: "Svensk doktorsexamen",
          label: "Godkänd svensk doktorsexamen",
          date: presetDates.svDoc || isoToday(),
          preset: "svDoc",
        });
      }
      if (presetChecked.foreignDocEval) {
        list.push({
          id: "preset-foreignDocEval",
          type: "Utländsk doktorsexamen",
          label: "Bedömning av utländsk doktorsexamen",
          date: presetDates.foreignDocEval || isoToday(),
          preset: "foreignDocEval",
        });
      }
      if (presetChecked.foreignService) {
        list.push({
          id: "preset-foreignService",
          type: "Utländsk tjänstgöring",
          label: "Intyg om utländsk tjänstgöring",
          date: presetDates.foreignService || isoToday(),
          preset: "foreignService",
        });
      }
      if (presetChecked.thirdCountry) {
        list.push({
          id: "preset-thirdCountry",
          type: "Delmål för specialistläkare från tredjeland",
          label: "Delmål för specialistläkare från tredjeland",
          date: presetDates.thirdCountry || isoToday(),
          preset: "thirdCountry",
        });
      }
      if (presetChecked.individProg) {
        list.push({
          id: "preset-individProg",
          type: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
          label: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
          date: presetDates.individProg || isoToday(),
          preset: "individProg",
        });
      }

      const fullgjordST = list.filter((a) => a.type === "Fullgjord specialiseringstjänstgöring");
      const rest = list.filter((a) => a.type !== "Fullgjord specialiseringstjänstgöring");
      const finalList = [...fullgjordST, ...rest.slice().sort(sortByBilaga)];
      setAttachments(finalList);
      setTempOrder(finalList);

      if (!hadSavedPresetDates) {
        setPresetDates({
          fullgjordST: isoToday(),
          intyg: isoToday(),
          sta3: isoToday(),
          svDoc: isoToday(),
          foreignDocEval: isoToday(),
          foreignService: isoToday(),
          thirdCountry: isoToday(),
          individProg: isoToday(),
        });
      }

      setCert((prev: any) => ({
        ...prev,
        mainSupervisor: {
          ...prev.mainSupervisor,
          workplace: prev.mainSupervisor.workplace || (p as any)?.homeClinic || "",
        },
        managerSelf: {
          ...prev.managerSelf,
          workplace: prev.managerSelf.workplace || (p as any)?.homeClinic || "",
          specialty: prev.managerSelf.specialty || (p as any)?.specialty || (p as any)?.speciality || "",
        },
        managerAppointed: {
          ...prev.managerAppointed,
          managerWorkplace: prev.managerAppointed.managerWorkplace || (p as any)?.homeClinic || "",
        },
      }));

      setApplicant((prev: any) => {
        const next = { ...prev };
        const prof = (p as any) || {};
        if (!next.medDegreeCountry) next.medDegreeCountry = String(prof.medDegreeCountry ?? "");
        if (!next.medDegreeDate) next.medDegreeDate = String(prof.medDegreeDate ?? isoToday());

        const alreadyAny =
          Array.isArray(prev.licenseCountries) && prev.licenseCountries.some((r: any) => r?.country || r?.date);
        if (!alreadyAny) {
          const list: any[] = [];
          const licCountry = String(prof.licenseCountry ?? "").trim();
          if (licCountry) {
            list.push({
              id: makeId(),
              country: licCountry,
              date: String(prof.licenseDate ?? "") || isoToday(),
            });
          }
          const fl = Array.isArray(prof.foreignLicenses) ? prof.foreignLicenses.slice(0, 3 - list.length) : [];
          for (const r of fl) {
            list.push({
              id: makeId(),
              country: String(r?.country ?? ""),
              date: String(r?.date ?? "") || isoToday(),
            });
          }
          if (list.length) next.licenseCountries = list.slice(0, 3);
        }
        return next;
      });
    })();
  }, [open]);
}
