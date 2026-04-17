export function collectOpenAgentModals(flags: {
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
}): string[] {
  const openModals: string[] = [];
  if (flags.iupOpen) openModals.push("iup");
  if (flags.hemklinikOpen) openModals.push("hemklinik");
  if (flags.scanOpen) openModals.push("scan_intyg");
  if (flags.prepareOpen) openModals.push("specialistansokan");
  if (flags.btModalOpen) openModals.push("bt_ansokan");
  if (flags.profileOpen) openModals.push("profile");
  if (flags.aboutOpen) openModals.push("about");
  if (flags.reportOpen) openModals.push("report");
  if (flags.settingsOpen) openModals.push("settings");
  if (flags.sta3Open) openModals.push("sta3");
  if (flags.courseModalOpen) openModals.push("course_prep");
  if (flags.previewOpen) openModals.push("preview");
  if (flags.milestoneOverviewOpen) openModals.push("milestone_overview");
  return openModals;
}
