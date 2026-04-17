type WindowSetter = (open: boolean) => void;

const OPEN_MESSAGES: Record<string, string> = {
  iup: "Öppnade IUP.",
  hemklinik: "Öppnade Hemklinik.",
  scan_intyg: "Öppnade Skanna intyg.",
  bt_ansokan: "Öppnade BT-intyg.",
  specialistansokan: "Öppnade Specialistansökan.",
  profile: "Öppnade Profil.",
  about: "Öppnade Om-fönstret.",
  report: "Öppnade Rapport.",
  settings: "Öppnade inställningsmenyn.",
  sta3: "Öppnade STa3.",
  course_prep: "Öppnade kursintyg.",
  preview: "Öppnade förhandsvisning.",
  milestone_overview: "Öppnade delmålsöversikt.",
};

export function openAgentWindowCommand(
  windowName: string,
  windowSetters: Record<string, WindowSetter | undefined>
): { ok: boolean; message: string } {
  const setter = windowSetters[windowName];
  if (!setter) return { ok: false, message: "Okänt fönster." };
  setter(true);
  return {
    ok: true,
    message: OPEN_MESSAGES[windowName] || `Öppnade ${windowName}.`,
  };
}

export function closeAgentWindowCommand(
  windowName: string,
  windowSetters: Record<string, WindowSetter | undefined>
): { ok: boolean; message: string } {
  const setter = windowSetters[windowName];
  if (!setter) return { ok: false, message: "Okänt fönster." };
  setter(false);
  return { ok: true, message: `Stängde ${windowName}.` };
}
