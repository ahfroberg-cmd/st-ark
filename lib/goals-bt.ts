// lib/goals-bt.ts
// BT-delmål för HSLF-FS 2021:8 – komprimerad, återanvändbar struktur

export type BtMilestone = {
  id: string;      // t.ex. "BT1"
  code: string;    // samma som id (för kompatibilitet)
  title: string;   // rubrik
  bullets: string[]; // kompetenskrav i punktlista
};

// Hjälpfunktion: trimma och ta bort radbrytningar från PDF-kopierad text
function lines(...arr: string[]): string[] {
  return arr.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export const btMilestones: BtMilestone[] = [
  {
    id: "BT1",
    code: "BT1",
    title: "Akuta och icke akuta sjukdomstillstånd",
    bullets: lines(
      "kunna diagnostisera akuta sjukdomstillstånd",
      "kunna identifiera tecken på kritiska eller allvarliga sjukdomstillstånd och initiera fortsatt handläggning",
      "kunna inleda behandling av akuta sjukdomstillstånd, inklusive livshotande tillstånd, och planera fortsatt handläggning",
      "kunna diagnostisera vanliga icke akuta sjukdomstillstånd",
      "kunna planera, behandla och följa upp vanliga icke akuta sjukdomstillstånd och andra hälsoproblem",
      "kunna beakta patientens övriga hälsotillstånd (inkl. multisjuklighet) och livssituation i handläggningen av akuta och icke akuta tillstånd"
    ),
  },
  {
    id: "BT2",
    code: "BT2",
    title: "Psykiatriska sjukdomstillstånd och övrig psykisk ohälsa",
    bullets: lines(
      "kunna diagnostisera akuta psykiatriska sjukdomstillstånd",
      "kunna inleda handläggning av akuta psykiatriska sjukdomstillstånd",
      "kunna diagnostisera vanliga icke akuta psykiatriska sjukdomstillstånd",
      "kunna inleda behandling av vanliga icke akuta psykiatriska sjukdomstillstånd",
      "kunna beakta övriga hälsotillstånd (inkl. multisjuklighet) och livssituation i handläggningen",
      "kunna bedöma suicidrisk och initiera vidare handläggning",
      "kunna identifiera tecken på förvirringstillstånd och vidta adekvata åtgärder",
      "kunna identifiera tecken på beroendetillstånd och vidta adekvata åtgärder",
      "kunna bedöma behov av psykiatrisk tvångsvård och kunna utfärda vårdintyg",
      "kunna identifiera psykisk ohälsa utan psykiatrisk sjukdom och vidta adekvata åtgärder"
    ),
  },
  {
    id: "BT3",
    code: "BT3",
    title: "Lagar och andra författningar inom hälso- och sjukvården",
    bullets: lines("uppvisa kunskap om lagar och andra författningar som gäller inom hälso- och sjukvården och för dess personal"),
  },
  {
    id: "BT4",
    code: "BT4",
    title: "Hälso- och sjukvårdens styrning och organisation",
    bullets: lines(
      "uppvisa kunskap om hälso- och sjukvårdens organisation och administration (region och kommun)",
      "uppvisa kunskap om andra aktörer av betydelse, t.ex. socialtjänsten, Försäkringskassan och skolan"
    ),
  },
  {
    id: "BT5",
    code: "BT5",
    title: "Strukturerad vårddokumentation",
    bullets: lines(
      "uppvisa kunskap om syftet med strukturerad vårddokumentation",
      "kunna dokumentera på ett sätt som bidrar till god och säker vård"
    ),
  },
  {
    id: "BT6",
    code: "BT6",
    title: "Systematiskt kvalitetsarbete",
    bullets: lines("uppvisa kunskap om vad systematiskt kvalitetsarbete innebär"),
  },
  {
    id: "BT7",
    code: "BT7",
    title: "Vetenskapligt förhållningssätt",
    bullets: lines(
      "kunna kritiskt granska och värdera medicinsk information",
      "kunna tillämpa ett vetenskapligt förhållningssätt i det dagliga arbetet"
    ),
  },
  {
    id: "BT8",
    code: "BT8",
    title: "Etik i det dagliga arbetet",
    bullets: lines("kunna identifiera och hantera värdekonflikter i det dagliga arbetet"),
  },
  {
    id: "BT9",
    code: "BT9",
    title: "Bemötande",
    bullets: lines(
      "kunna bemöta människor som individer och med respekt oberoende av t.ex. kön, könsöverskridande identitet/uttryck, etnicitet, religion/trosuppfattning, funktionsnedsättning, sexuell läggning och ålder",
      "kunna bemöta patienter och närstående med empati och lyhördhet",
      "kunna anpassa bemötandet utifrån individuella förutsättningar och behov (t.ex. barns mognadsnivå, kognitiv förmåga)"
    ),
  },
  {
    id: "BT10",
    code: "BT10",
    title: "Samarbeta och leda arbetet kring patienten",
    bullets: lines(
      "kunna samarbeta inom och mellan yrkesgrupper",
      "kunna leda det multiprofessionella arbetet kring en enskild patient",
      "kunna främja patienters och närståendes delaktighet i vård och behandling",
      "kunna samverka med aktörer inom och utanför hälso- och sjukvården kring en enskild patient (t.ex. annan vårdenhet, kommunal hälso- och sjukvård, socialtjänst, Försäkringskassan, skola)"
    ),
  },
  {
    id: "BT11",
    code: "BT11",
    title: "Presentera, förklara och instruera",
    bullets: lines(
      "kunna presentera och förklara medicinsk information tydligt och tillgängligt, muntligt och skriftligt",
      "kunna ge medarbetare och studenter instruktioner om verksamhetsspecifika tekniker och tillvägagångssätt"
    ),
  },
  {
    id: "BT12",
    code: "BT12",
    title: "Barn och ungdomar",
    bullets: lines(
      "kunna anpassa vård och omhändertagande utifrån barns och ungdomars särskilda förutsättningar och behov",
      "uppvisa kunskap om barns rättigheter i hälso- och sjukvården",
      "kunna identifiera tecken på att barn far illa eller riskerar att fara illa och vidta adekvata åtgärder"
    ),
  },
  {
    id: "BT13",
    code: "BT13",
    title: "Vårdhygien och smittskydd i det dagliga arbetet",
    bullets: lines("kunna ta ansvar för att vårdrelaterade infektioner och smittspridning förebyggs i det dagliga arbetet"),
  },
  {
    id: "BT14",
    code: "BT14",
    title: "Hälsofrämjande insatser",
    bullets: lines("kunna identifiera behov av hälsofrämjande insatser och initiera fortsatt handläggning"),
  },
  {
    id: "BT15",
    code: "BT15",
    title: "Läkemedelsbehandling",
    bullets: lines(
      "kunna anpassa läkemedelsbehandling efter ålder, kön, vikt, njur-/leverfunktion och andra faktorer (t.ex. övrig medicinering, samsjuklighet, graviditet och amning)",
      "kunna bedöma risker för interaktioner och biverkningar",
      "uppvisa kunskap om principer för rationell antibiotikabehandling",
      "uppvisa kunskap om läkemedels inverkan på miljön"
    ),
  },
  {
    id: "BT16",
    code: "BT16",
    title: "Försäkringsmedicinska intyg",
    bullets: lines("kunna utfärda försäkringsmedicinska intyg"),
  },
  {
    id: "BT17",
    code: "BT17",
    title: "Behov av palliativ vård",
    bullets: lines("kunna identifiera behov av palliativ vård och vidta adekvata åtgärder"),
  },
  {
    id: "BT18",
    code: "BT18",
    title: "Dödsbevis och dödsorsaksintyg",
    bullets: lines("kunna utfärda dödsbevis", "kunna utfärda dödsorsaksintyg"),
  },
];
