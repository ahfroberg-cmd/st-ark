export function runCertificateForCertMenuZone(input: {
  certMenu: {
    kind: "placement" | "course" | null;
    placement?: any;
    course?: any;
  };
  profile: any;
  activities: any[];
  courses: any[];
  displayDatesForActivity: (activity: any) => { startISO: string; endISO: string };
  getCourseDisplayTitle: (course: any) => string;
  openPreviewForBtGoals: (activity: any) => void;
  openPreviewForPlacement: (activity: any) => void;
  setSta3Placements: (items: any[]) => void;
  setSta3Courses: (items: any[]) => void;
  setSta3ResearchTitle: (title: string) => void;
  setSta3SupervisorName: (name: string) => void;
  setSta3SupervisorSpec: (spec: string) => void;
  setSta3SupervisorSite: (site: string) => void;
  setSta3Open: (open: boolean) => void;
  setCourseForModal: (course: any) => void;
  setCourseModalOpen: (open: boolean) => void;
  alertFn: (message: string) => void;
}): void {
  if (input.certMenu.kind === "placement" && input.certMenu.placement) {
    const placement = input.certMenu.placement;
    if (placement.phase === "BT" && !(placement as any)?.fulfillsStGoals) {
      input.openPreviewForBtGoals(placement);
      return;
    }

    const goalsVersion = String(input.profile?.goalsVersion || "");
    if (placement.type === "Vetenskapligt arbete" && goalsVersion.includes("2021")) {
      const isSta3 = (milestone: any) => {
        const id = String(milestone ?? "")
          .trim()
          .split(/\s|–|-|:|\u2013/)[0]
          .toLowerCase();
        return id === "a3" || id === "sta3";
      };
      const placementItems = input.activities
        .filter(
          (item: any) =>
            item.type === "Klinisk tjänstgöring" &&
            Array.isArray((item as any).milestones) &&
            (item as any).milestones.some(isSta3)
        )
        .map((item: any) => {
          const { startISO, endISO } = input.displayDatesForActivity(item);
          return {
            id: (item as any).linkedPlacementId || item.id,
            title: item.label || "Klinisk tjänstgöring",
            period: `${startISO}${endISO ? ` – ${endISO}` : ""}`,
          };
        });
      const courseItems = input.courses
        .filter(
          (course: any) =>
            Array.isArray((course as any).milestones) &&
            (course as any).milestones.some(isSta3)
        )
        .map((course: any) => ({
          id: (course as any).linkedCourseId || course.id,
          title: input.getCourseDisplayTitle(course),
          period: [
            course.city,
            ((course as any).certificateDate || course.endDate || course.startDate || "") as string,
          ]
            .filter(Boolean)
            .join(" · "),
        }));
      input.setSta3Placements(placementItems);
      input.setSta3Courses(courseItems);
      input.setSta3ResearchTitle(placement.label || placement.note || "");
      input.setSta3SupervisorName(placement.supervisor || "");
      input.setSta3SupervisorSpec(placement.supervisorSpeciality || "");
      input.setSta3SupervisorSite(placement.supervisorSite || (input.profile as any)?.homeClinic || "");
      input.setSta3Open(true);
      return;
    }

    input.openPreviewForPlacement(placement);
    return;
  }

  if (input.certMenu.kind === "course" && input.certMenu.course) {
    const course = input.certMenu.course;
    if (course.phase === "BT" && !(course as any)?.fulfillsStGoals) {
      const dummyActivity = {
        id: course.id,
        type: "Kurs",
        label: input.getCourseDisplayTitle(course),
        startSlot: 0,
        lengthSlots: 1,
        hue: 0,
        phase: "BT",
        btAssessment: (course as any).btAssessment || "",
        btMilestones: (course as any).btMilestones || [],
      } as any;
      input.openPreviewForBtGoals(dummyActivity);
      return;
    }
    if (!input.profile) {
      input.alertFn("Profil saknas – kan inte skapa intyget.");
      return;
    }
    input.setCourseForModal(course);
    input.setCourseModalOpen(true);
  }
}
