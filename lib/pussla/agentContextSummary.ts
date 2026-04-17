export function buildAgentContextSummaryText(input: {
  startYear: number;
  activities: any[];
  courses: any[];
  getPlacementStartISOForAgent: (placement: any) => string;
  getPlacementEndISOForAgent: (placement: any) => string;
  colleaguePlacementDescriptions: any[];
  colleagueCourseDescriptions: any[];
  srPlacementTemplates: any[];
  srCourseTemplates: any[];
  srUtbildningsmomentTemplates: any[];
  activeLane: "placement" | "course";
  selectedPlacement: any;
  selectedCourse: any;
  modalFlags: {
    iupOpen: boolean;
    hemklinikOpen: boolean;
    scanOpen: boolean;
    prepareOpen: boolean;
    btModalOpen: boolean;
    profileOpen: boolean;
    aboutOpen: boolean;
    reportOpen: boolean;
    settingsOpen: boolean;
    sta3Open: boolean;
    courseModalOpen: boolean;
    previewOpen: boolean;
    milestoneOverviewOpen: boolean;
  };
  profileGoalsVersion: string;
  stStartISO: string | null;
  stEndISO: string | null;
  goalsCatalog: any;
  specialty: string | null;
  usesMetisCourses: (specialty: string | null | undefined) => boolean;
  redactContactInfoText: (
    text: string,
    options?: { redactAddressLikeLines?: boolean }
  ) => string;
}): string {
  const latestPlacements = [...input.activities]
    .sort((a, b) =>
      input
        .getPlacementEndISOForAgent(b)
        .localeCompare(input.getPlacementEndISOForAgent(a))
    )
    .slice(0, 3)
    .map((placement, index) => {
      const start = input.getPlacementStartISOForAgent(placement) || "?";
      const end = input.getPlacementEndISOForAgent(placement) || "?";
      return `${index + 1}) ${placement.label || "Klinisk tjänstgöring"} (${start} till ${end})`;
    });

  const colleaguePlacementNameSample = [
    ...new Set(
      input.colleaguePlacementDescriptions.flatMap((row) =>
        [row.placementName, row.placementNameAlt].filter(Boolean) as string[]
      )
    ),
  ]
    .sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }))
    .slice(0, 24)
    .join("; ");

  const colleagueFirstNameSample = [
    ...new Set(
      input.colleaguePlacementDescriptions
        .map((row) =>
          String(row.colleagueName || "")
            .trim()
            .split(/\s+/)[0]
        )
        .filter(Boolean)
    ),
  ]
    .sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }))
    .slice(0, 24)
    .join(", ");

  const openModals: string[] = [];
  if (input.modalFlags.iupOpen) openModals.push("iup");
  if (input.modalFlags.hemklinikOpen) openModals.push("hemklinik");
  if (input.modalFlags.scanOpen) openModals.push("scan_intyg");
  if (input.modalFlags.prepareOpen) openModals.push("specialistansokan");
  if (input.modalFlags.btModalOpen) openModals.push("bt_ansokan");
  if (input.modalFlags.profileOpen) openModals.push("profil");
  if (input.modalFlags.aboutOpen) openModals.push("om");
  if (input.modalFlags.reportOpen) openModals.push("rapport");
  if (input.modalFlags.settingsOpen) openModals.push("settings");
  if (input.modalFlags.sta3Open) openModals.push("sta3");
  if (input.modalFlags.courseModalOpen) openModals.push("course_prep");
  if (input.modalFlags.previewOpen) openModals.push("preview");
  if (input.modalFlags.milestoneOverviewOpen) openModals.push("milestone_overview");

  const templatePlacementNames = input.srPlacementTemplates
    .map((template) => String(template.title || "").trim())
    .filter(Boolean)
    .slice(0, 24)
    .join("; ");
  const templateCourseNames = input.srCourseTemplates
    .map((template) => String(template.title || "").trim())
    .filter(Boolean)
    .slice(0, 24)
    .join("; ");
  const templateUtbNames = input.srUtbildningsmomentTemplates
    .map((template) => String(template.title || "").trim())
    .filter(Boolean)
    .slice(0, 24)
    .join("; ");

  const stGoalsCount = Array.isArray((input.goalsCatalog as any)?.milestones)
    ? ((input.goalsCatalog as any).milestones as any[]).filter((milestone: any) => {
        const code = String((milestone as any)?.code ?? (milestone as any)?.id ?? "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "");
        return /^ST[ABC]\d+$/i.test(code) || /^[ABC]\d+$/i.test(code);
      }).length
    : 0;

  const latestPlacementLabel = input.activities.length
    ? (() => {
        const latest = [...input.activities].sort((a, b) =>
          input
            .getPlacementEndISOForAgent(b)
            .localeCompare(input.getPlacementEndISOForAgent(a))
        )[0];
        const start = input.getPlacementStartISOForAgent(latest);
        const end = input.getPlacementEndISOForAgent(latest);
        return `${latest.label || "Klinisk tjänstgöring"} (${start || "?"} till ${end || "?"})`;
      })()
    : "ingen";

  const summary = [
    `Startår: ${input.startYear}`,
    `Antal placeringar: ${input.activities.length}`,
    `Antal kurser: ${input.courses.length}`,
    `Sista placering: ${latestPlacementLabel}`,
    `Kollegbeskrivningar (placering): ${input.colleaguePlacementDescriptions.length}`,
    `Kollegbeskrivningar (kurs): ${input.colleagueCourseDescriptions.length}`,
    `Kollegor (förnamn) i kollegdata: ${colleagueFirstNameSample || "—"}`,
    `Placeringsnamn i kollegdata (exempel): ${colleaguePlacementNameSample || "—"}`,
    `SR-mallar placeringar: ${input.srPlacementTemplates.length} (${templatePlacementNames || "—"})`,
    `SR-mallar kurser: ${input.srCourseTemplates.length} (${templateCourseNames || "—"})`,
    `SR-mallar utbildningsmoment: ${input.srUtbildningsmomentTemplates.length} (${templateUtbNames || "—"})`,
    `Aktiv lane: ${input.activeLane}`,
    `Vald placering: ${input.selectedPlacement?.label || input.selectedPlacement?.type || "ingen"}`,
    `Vald placering start/slut: ${
      input.selectedPlacement
        ? `${input.getPlacementStartISOForAgent(input.selectedPlacement) || "?"} till ${
            input.getPlacementEndISOForAgent(input.selectedPlacement) || "?"
          }`
        : "ingen"
    }`,
    `Vald kurs: ${input.selectedCourse?.title || "ingen"}`,
    `Vald kurs start/slut: ${
      input.selectedCourse
        ? `${String(input.selectedCourse.startDate || "?")} till ${String(
            input.selectedCourse.endDate || input.selectedCourse.certificateDate || "?"
          )}`
        : "ingen"
    }`,
    `Senaste 3 placeringar:\n${latestPlacements.join("\n") || "inga"}`,
    `Öppna modaler: ${openModals.length ? openModals.join(", ") : "inga"}`,
    `IUP öppen: ${input.modalFlags.iupOpen ? "ja" : "nej"}`,
    `Hemklinik öppen: ${input.modalFlags.hemklinikOpen ? "ja" : "nej"}`,
    `Målversion: ${String(input.profileGoalsVersion || "okänd")}`,
    `ST-intervall (profil): ${String(input.stStartISO || "?")}–${String(input.stEndISO || "?")}`,
    `Delmål i laddad katalog: ${stGoalsCount}`,
    "Kontaktinformation (telefon/e-post/adress/personnummer) är spärrad i agentläget och får inte exponeras.",
    `För att föreslå kurser som täcker kursdelmål över hela ST (METIS), använd plan_courses_cover_course_milestones — inte plan_st_from_sr_templates. METIS-stöd: ${
      input.usesMetisCourses(input.specialty) ? "ja" : "nej (kräver psykiatrispecialitet med METIS)"
    }.`,
    "När användaren ber om alla delmål eller delmålens infosidor: använd summarize_goal_catalog (appens katalogdata).",
    "När användaren ber om en total genomgång av appens sidor: använd summarize_app_sections.",
    "När användaren ber om rollvyer (studierektor/huvudhandledare): använd summarize_role_views.",
    "Stödda placeringstyper: Klinisk tjänstgöring, Vetenskapligt arbete, Förbättringsarbete, Auskultation, Forskning, Tjänstledighet, Föräldraledighet, Annan ledighet, Sjukskriven",
    "Stödda kurstyper: Kurs, Konferens, Annat, Utbildningsmoment",
  ].join("\n");

  return input.redactContactInfoText(summary, { redactAddressLikeLines: true });
}
