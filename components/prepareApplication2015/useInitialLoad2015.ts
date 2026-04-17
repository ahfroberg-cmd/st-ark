"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildDefaultAttachmentsFor2015, type AttachmentItem, type PresetKey } from "@/components/prepareApplication2015/attachmentsDomain";

type Args = {
  open: boolean;
  storageKey: string;
  isoToday: () => string;
  makeId: () => string;
  presetChecked: Record<PresetKey, boolean>;
  presetDates: Record<PresetKey, string>;
  sortByBilagaNumber: (a: AttachmentItem, b: AttachmentItem) => number;
  managerModeChangedRef: React.MutableRefObject<boolean>;
  setProfile: React.Dispatch<React.SetStateAction<any>>;
  setPlacements: React.Dispatch<React.SetStateAction<any[]>>;
  setCourses: React.Dispatch<React.SetStateAction<any[]>>;
  setApplicant: React.Dispatch<React.SetStateAction<any>>;
  setCert: React.Dispatch<React.SetStateAction<any>>;
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
  setTempOrder: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
  setPaidFeeDate: React.Dispatch<React.SetStateAction<string>>;
  setPresetChecked: React.Dispatch<React.SetStateAction<Record<PresetKey, boolean>>>;
  setPresetDates: React.Dispatch<React.SetStateAction<Record<PresetKey, string>>>;
  setThirdCountryDelmalCodes: React.Dispatch<React.SetStateAction<string>>;
  setThirdCountryActivities: React.Dispatch<React.SetStateAction<string>>;
  setThirdCountryVerification: React.Dispatch<React.SetStateAction<string>>;
  setThirdCountryWorkplaces: React.Dispatch<
    React.SetStateAction<Array<{ id: string; site: string; startDate: string; endDate: string }>>
  >;
};

export function useInitialLoad2015({
  open,
  storageKey,
  isoToday,
  makeId,
  presetChecked,
  presetDates,
  sortByBilagaNumber,
  managerModeChangedRef,
  setProfile,
  setPlacements,
  setCourses,
  setApplicant,
  setCert,
  setAttachments,
  setTempOrder,
  setPaidFeeDate,
  setPresetChecked,
  setPresetDates,
  setThirdCountryDelmalCodes,
  setThirdCountryActivities,
  setThirdCountryVerification,
  setThirdCountryWorkplaces,
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
            .eq("draft_key", "st_application_2015")
            .maybeSingle();
          if (draftRow?.draft_data) {
            saved = draftRow.draft_data;
          }
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
                studyDirector: "",
                mainSupervisor: {
                  ...(savedCert.mainSupervisor || prev.mainSupervisor),
                  name: "",
                },
              };
            });
            const mm = savedCert.managerMode || "self";
            managerModeChangedRef.current = mm !== "self";
          }

          if (Array.isArray(saved.attachments) && saved.attachments.length > 0) {
            setAttachments(saved.attachments as AttachmentItem[]);
            setTempOrder(saved.attachments as AttachmentItem[]);
          }

          if (typeof saved.paidFeeDate === "string" && saved.paidFeeDate) setPaidFeeDate(saved.paidFeeDate);
          if (saved.presetChecked) setPresetChecked(saved.presetChecked as Record<PresetKey, boolean>);
          if (saved.presetDates) {
            hadSavedPresetDates = true;
            setPresetDates(saved.presetDates as Record<PresetKey, string>);
          }
          if (typeof saved.thirdCountryDelmalCodes === "string") setThirdCountryDelmalCodes(saved.thirdCountryDelmalCodes);
          if (typeof saved.thirdCountryActivities === "string") setThirdCountryActivities(saved.thirdCountryActivities);
          if (typeof saved.thirdCountryVerification === "string") setThirdCountryVerification(saved.thirdCountryVerification);
          if (Array.isArray(saved.thirdCountryWorkplaces)) setThirdCountryWorkplaces(saved.thirdCountryWorkplaces);
        }
      } catch (err) {
        console.error("Kunde inte ladda specialistansökan:", err);
      }

      const [p, pls, crs] = await (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) return [null, [], []] as const;

        const [profileRes, placementsRes, coursesRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("placements").select("*").eq("user_id", user.id),
          supabase.from("courses").select("*").eq("user_id", user.id),
        ]);

        const profileRow: any = profileRes.data || null;
        const mappedProfile: any = profileRow
          ? {
              ...profileRow,
              goalsVersion: profileRow.goals_version ?? profileRow.goalsVersion ?? "",
              personalNumber: profileRow.personal_number ?? profileRow.personalNumber ?? "",
              homeClinic: profileRow.home_clinic ?? profileRow.homeClinic ?? "",
              specialty: profileRow.specialty ?? profileRow.speciality ?? "",
            }
          : null;

        const mappedPlacements = ((placementsRes.data || []) as any[]).map((row) => ({
          ...row,
          startDate: row.start_date ?? row.startDate ?? "",
          endDate: row.end_date ?? row.endDate ?? "",
          showOnTimeline: row.show_on_timeline ?? row.showOnTimeline ?? true,
          fulfillsStGoals: row.fulfills_st_goals ?? row.fulfillsStGoals ?? false,
        }));

        const mappedCourses = ((coursesRes.data || []) as any[]).map((row) => ({
          ...row,
          title: row.title ?? row.course_title ?? "",
          startDate: row.start_date ?? row.startDate ?? "",
          endDate: row.end_date ?? row.endDate ?? "",
          certificateDate: row.certificate_date ?? row.certificateDate ?? "",
          showOnTimeline: row.show_on_timeline ?? row.showOnTimeline ?? true,
          fulfillsStGoals: row.fulfills_st_goals ?? row.fulfillsStGoals ?? false,
        }));

        return [mappedProfile, mappedPlacements, mappedCourses] as const;
      })();

      setProfile(p ?? null);

      const allPlacements = (pls || []) as any[];
      const allCourses = (crs || []) as any[];
      const gvRaw = String((p as any)?.goalsVersion || "").toLowerCase();
      const is2021 = gvRaw.includes("2021");

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

      const baseList: AttachmentItem[] = buildDefaultAttachmentsFor2015({
        placements: filteredPlacements as any,
        courses: filteredCourses as any,
      });
      const list: AttachmentItem[] = [];

      if (presetChecked.intyg) {
        list.push({
          id: "preset-intyg",
          type: "Uppnådd specialistkompetens",
          label: "Uppnådd specialistkompetens",
          date: presetDates.intyg || isoToday(),
          preset: "intyg",
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
      if (presetChecked.thirdCountry && !!(p as any)?.isThirdCountrySpecialist) {
        list.push({
          id: "preset-thirdCountry-8a",
          type: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
          label: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
          date: presetDates.thirdCountry || isoToday(),
          preset: "thirdCountry",
        });
        list.push({
          id: "preset-thirdCountry-8b",
          type: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
          label: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
          date: presetDates.thirdCountry || isoToday(),
          preset: "thirdCountry",
        });
      }
      if (presetChecked.individProg && !!(p as any)?.isThirdCountrySpecialist) {
        list.push({
          id: "preset-individProg",
          type: "Individuellt utbildningsprogram",
          label: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
          date: presetDates.individProg || isoToday(),
          preset: "individProg",
        });
      }

      const finalList = list.slice().sort(sortByBilagaNumber);
      setAttachments(finalList);
      setTempOrder(finalList);

      if (!hadSavedPresetDates) {
        setPresetDates({
          intyg: isoToday(),
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
          specialty: prev.mainSupervisor.specialty || (p as any)?.specialty || "",
        },
        managerSelf: {
          ...prev.managerSelf,
          workplace: prev.managerSelf.workplace || (p as any)?.homeClinic || "",
          specialty: prev.managerSelf.specialty || (p as any)?.specialty || "",
        },
        managerAppointed: {
          ...prev.managerAppointed,
          managerWorkplace: prev.managerAppointed.managerWorkplace || (p as any)?.homeClinic || "",
          managerSpecialty: prev.managerAppointed.managerSpecialty || (p as any)?.specialty || "",
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
