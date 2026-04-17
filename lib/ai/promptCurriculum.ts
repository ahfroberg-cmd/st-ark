const ADVANCED_OBJECTIVES = [
  "inspireras av kollegor",
  "planera hela ST från nuläge",
  "täcka kursdelmål helt",
  "fokusera på psykos tidigt",
  "fokusera på suicidologi",
  "jämna ut arbetsbelastning",
  "förbereda inför specialistansökan",
  "minska kurskrockar",
  "öka progression i IUP",
  "balansera klinik och utbildning",
];

const ADVANCED_CONSTRAINTS = [
  "med två kurser per termin",
  "med två kurser per halvår",
  "utan luckor i delmål",
  "med jämn fördelning över hela ST",
  "med mjuk start första året",
  "med högre tempo sista året",
  "utan att flytta placeringar i onödan",
  "med minsta möjliga manuella justering",
  "med tydlig motivering steg för steg",
  "med robust fallback om något misslyckas",
];

const MIDDLE_PHASES = [
  "öppna rätt vyer",
  "välj relevanta objekt",
  "gör måttlig tidsjustering",
  "ersätt enstaka kurs",
  "synka delmål efter ändring",
  "kör kontroll av resultat",
  "finslipa fördelningen",
  "stabilisera plan mellan terminer",
  "säkra att sparning slog igenom",
  "förbered nästa justeringsrunda",
];

const MIDDLE_CONNECTORS = [
  "innan du gör global omplanering",
  "mellan analys och slutlig plan",
  "efter första kurspaketet",
  "före delmålssynk",
  "efter delmålssynk",
  "innan sista verifiering",
  "efter en misslyckad delplan",
  "när en krock uppstår",
  "innan du låser planen",
  "när användaren ber om finjustering",
];

function buildAdvancedPromptBank(): string[] {
  const out: string[] = [];
  for (const objective of ADVANCED_OBJECTIVES) {
    for (const constraint of ADVANCED_CONSTRAINTS) {
      out.push(`Avancerad prompt: ${objective} ${constraint}.`);
      if (out.length === 100) return out;
    }
  }
  return out.slice(0, 100);
}

function buildMiddleActionPromptBank(): string[] {
  const out: string[] = [];
  for (const phase of MIDDLE_PHASES) {
    for (const connector of MIDDLE_CONNECTORS) {
      out.push(`Mellanläge: ${phase} ${connector}.`);
      if (out.length === 100) return out;
    }
  }
  return out.slice(0, 100);
}

export const ADVANCED_PROMPT_BANK_100 = buildAdvancedPromptBank();
export const MIDDLE_ACTION_PROMPT_BANK_100 = buildMiddleActionPromptBank();

