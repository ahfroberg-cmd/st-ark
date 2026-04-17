/**
 * Fördefinierade kliniknamn per sjukhus (ST-ARK superadmin → registrera klinik).
 * Matchar exakt `region` + `hospitalName` mot raden i `hospitals` efter synk med SWEDISH_HOSPITALS_SEED.
 * Listorna är typiska svenska verksamhetsnamn — komplettera vid behov; fullständighet mot varje sjukhus
 * kan inte garanteras utan manuell underhåll eller extern källa.
 */

export type HospitalClinicSeed = {
  region: string;
  hospitalName: string;
  clinics: string[];
};

/** Vanlig uppsättning vid medelstort/regionalt sjukhus. */
const BASE: string[] = [
  "Akutmottagningen",
  "Medicinkliniken",
  "Kirurgkliniken",
  "Ortopedkliniken",
  "Kvinnokliniken",
  "Barn- och ungdomskliniken",
  "Anestesi- och intensivvårdskliniken",
  "Bild- och funktionsmedicin",
  "Psykiatriska kliniken",
  "Rehabiliteringsmedicin",
];

/** Utökad för universitetssjukhus / större enheter. */
const UNIVERSITY_EXTRA: string[] = [
  "Hjärtkliniken",
  "Thoraxkliniken",
  "Neurologiska kliniken",
  "Infektionskliniken",
  "Njurmedicinska kliniken",
  "Urologiska kliniken",
  "Öron-, näs- och halssjukvård",
  "Ögonkliniken",
  "Onkologiska kliniken",
  "Endokrinkliniken",
  "Gastroenterologisk mottagning",
  "Strokeenheten",
];

const basePlus = (...extra: string[]) => [...BASE, ...extra].sort((a, b) => a.localeCompare(b, "sv"));
const uni = () => basePlus(...UNIVERSITY_EXTRA);

/**
 * Sahlgrenska Universitetssjukhuset — verksamhetsområden enligt offentlig lista
 * ”Avdelningar och mottagningar → Efter verksamhetsområde” (sahlgrenska.se), feb 2025.
 * Plus Drottning Silvias barnsjukhus (samlad barnsjukvård, samma källa).
 * Ej varje enskild mottagning — de finns i hundratals på webbplatsen.
 */
const SAHLGRENSKA_VERKSAMHETSOMRADEN: string[] = [
  "Akutmedicin och geriatrik",
  "Ambulans och specialiserad sjukvård i hemmet",
  "Anestesi, Operation och Intensivvård",
  "AnOpIva neonatal barn",
  "Arbetsterapi och fysioterapi",
  "Barncancercentrum",
  "Barnhjärtcentrum",
  "Beroende och akutpsykiatri",
  "Bröstcentrum",
  "Drottning Silvias barnsjukhus",
  "Gynekologi och Reproduktionsmedicin",
  "Handkirurgi",
  "Hud- och könssjukvård",
  "Hybrid och intervention",
  "Hälsoprofessioner och radiologi barn",
  "Infektion",
  "Kirurgi Sahlgrenska",
  "Kirurgi barn",
  "Klinisk fysiologi",
  "Klinisk genetik och genomik",
  "Klinisk immunologi och transfusionsmedicin",
  "Klinisk kemi",
  "Klinisk mikrobiologi",
  "Klinisk patologi",
  "Medicin barn",
  "Medicin, geriatrik och akutsjukvård",
  "Medicinsk teknik och fysik",
  "Neuropsykiatri",
  "Neurosjukvård",
  "Neurologi och psykiatri barn",
  "Njurmedicin",
  "Obstetrik",
  "Onkologi",
  "Ortopedi",
  "Ortopedteknik och sterilteknik",
  "Plastikkirurgi",
  "Psykiatri Affektiva",
  "Psykiatri Psykos",
  "Radiologi",
  "Reumatologi",
  "Rättspsykiatri",
  "Specialistmedicin",
  "Thorax och kardiologi",
  "Transplantationscentrum",
  "Urologi",
  "Ögonsjukvård",
  "Öron- Näs- och Halssjukvård",
].sort((a, b) => a.localeCompare(b, "sv"));

export const SWEDISH_HOSPITAL_CLINICS_SEED: HospitalClinicSeed[] = [
  { region: "Region Stockholm", hospitalName: "Karolinska Universitetssjukhuset Solna", clinics: uni() },
  { region: "Region Stockholm", hospitalName: "Karolinska Universitetssjukhuset Huddinge", clinics: uni() },
  { region: "Region Stockholm", hospitalName: "Södersjukhuset", clinics: uni() },
  { region: "Region Stockholm", hospitalName: "Danderyds sjukhus", clinics: uni() },
  { region: "Region Stockholm", hospitalName: "S:t Görans sjukhus", clinics: uni() },
  { region: "Region Stockholm", hospitalName: "Ersta sjukhus", clinics: basePlus() },
  { region: "Region Stockholm", hospitalName: "Sabbatsbergs sjukhus", clinics: basePlus("Ögonkliniken", "ÖNH-kliniken") },
  { region: "Region Stockholm", hospitalName: "Norrtälje sjukhus", clinics: basePlus() },
  { region: "Region Stockholm", hospitalName: "Södertälje sjukhus", clinics: basePlus() },

  { region: "Region Västra Götaland", hospitalName: "Sahlgrenska Universitetssjukhuset", clinics: SAHLGRENSKA_VERKSAMHETSOMRADEN },
  { region: "Region Västra Götaland", hospitalName: "Alingsås lasarett", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Borås sjukhus", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Västra Götaland", hospitalName: "Lidköpings sjukhus", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Mariestads sjukhus", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Skövde sjukhus", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Västra Götaland", hospitalName: "Skene sjukhus", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Trollhättans sjukhus", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Uddevalla sjukhus", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Kungälvs sjukhus", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Lysekils sjukhus", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Varbergs sjukhus", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Vänersborgs sjukhus", clinics: basePlus() },
  { region: "Region Västra Götaland", hospitalName: "Frölunda specialistsjukhus", clinics: basePlus("Specialistmottagning") },
  { region: "Region Västra Götaland", hospitalName: "Högsbo sjukhus", clinics: basePlus() },

  { region: "Region Skåne", hospitalName: "Skånes universitetssjukhus Lund", clinics: uni() },
  { region: "Region Skåne", hospitalName: "Skånes universitetssjukhus Malmö", clinics: uni() },
  { region: "Region Skåne", hospitalName: "Helsingborgs lasarett", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Skåne", hospitalName: "Kristianstad sjukhus", clinics: basePlus() },
  { region: "Region Skåne", hospitalName: "Ystads lasarett", clinics: basePlus() },
  { region: "Region Skåne", hospitalName: "Trelleborgs lasarett", clinics: basePlus() },
  { region: "Region Skåne", hospitalName: "Ängelholms sjukhus", clinics: basePlus() },
  { region: "Region Skåne", hospitalName: "Landskrona lasarett", clinics: basePlus() },

  { region: "Region Uppsala", hospitalName: "Akademiska sjukhuset", clinics: uni() },
  { region: "Region Uppsala", hospitalName: "Enköpings sjukhus", clinics: basePlus() },

  { region: "Region Östergötland", hospitalName: "Universitetssjukhuset i Linköping", clinics: uni() },
  { region: "Region Östergötland", hospitalName: "Vrinnevisjukhuset", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Östergötland", hospitalName: "Motala lasarett", clinics: basePlus() },
  { region: "Region Östergötland", hospitalName: "Norrköpings sjukhus", clinics: basePlus(...UNIVERSITY_EXTRA) },

  { region: "Region Jönköpings län", hospitalName: "Ryhovs sjukhus", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Jönköpings län", hospitalName: "Höglandssjukhuset Eksjö", clinics: basePlus() },
  { region: "Region Jönköpings län", hospitalName: "Värnamo sjukhus", clinics: basePlus() },

  { region: "Region Örebro län", hospitalName: "Universitetssjukhuset Örebro", clinics: uni() },
  { region: "Region Örebro län", hospitalName: "Karlskoga lasarett", clinics: basePlus() },
  { region: "Region Örebro län", hospitalName: "Lindesbergs lasarett", clinics: basePlus() },

  { region: "Region Västmanland", hospitalName: "Västmanlands sjukhus Västerås", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Västmanland", hospitalName: "Köpings sjukhus", clinics: basePlus() },
  { region: "Region Västmanland", hospitalName: "Fagersta lasarett", clinics: basePlus() },

  { region: "Region Sörmland", hospitalName: "Mälarsjukhuset Eskilstuna", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Sörmland", hospitalName: "Kullbergska sjukhuset Katrineholm", clinics: basePlus() },
  { region: "Region Sörmland", hospitalName: "Nyköpings lasarett", clinics: basePlus() },

  { region: "Region Gotland", hospitalName: "Visby lasarett", clinics: basePlus() },

  { region: "Region Kalmar län", hospitalName: "Kalmar sjukhus", clinics: basePlus() },
  { region: "Region Kalmar län", hospitalName: "Oskarshamns sjukhus", clinics: basePlus() },
  { region: "Region Kalmar län", hospitalName: "Västerviks sjukhus", clinics: basePlus() },

  { region: "Region Kronoberg", hospitalName: "Centrallasarettet Växjö", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Kronoberg", hospitalName: "Ljungby lasarett", clinics: basePlus() },

  { region: "Region Blekinge", hospitalName: "Blekingesjukhuset Karlskrona", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Blekinge", hospitalName: "Karlshamns sjukhus", clinics: basePlus() },

  { region: "Region Halland", hospitalName: "Hallands sjukhus Halmstad", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Halland", hospitalName: "Hallands sjukhus Varberg", clinics: basePlus() },
  { region: "Region Halland", hospitalName: "Hallands sjukhus Falkenberg", clinics: basePlus() },
  { region: "Region Halland", hospitalName: "Hallands sjukhus Kungsbacka", clinics: basePlus() },

  { region: "Region Dalarna", hospitalName: "Falu lasarett", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Dalarna", hospitalName: "Mora lasarett", clinics: basePlus() },
  { region: "Region Dalarna", hospitalName: "Ludvika lasarett", clinics: basePlus() },

  { region: "Region Gävleborg", hospitalName: "Gävle sjukhus", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Gävleborg", hospitalName: "Hudiksvalls sjukhus", clinics: basePlus() },
  { region: "Region Gävleborg", hospitalName: "Bollnäs sjukhus", clinics: basePlus() },

  { region: "Region Värmland", hospitalName: "Centrallasarettet Karlstad", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Värmland", hospitalName: "Torsby sjukhus", clinics: basePlus() },
  { region: "Region Värmland", hospitalName: "Arvika sjukhus", clinics: basePlus() },

  { region: "Region Västernorrland", hospitalName: "Sundsvalls sjukhus", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Västernorrland", hospitalName: "Örnsköldsviks sjukhus", clinics: basePlus() },
  { region: "Region Västernorrland", hospitalName: "Sollefteå sjukhus", clinics: basePlus() },

  { region: "Region Jämtland Härjedalen", hospitalName: "Östersunds sjukhus", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Jämtland Härjedalen", hospitalName: "Härjedals sjukhus Sveg", clinics: basePlus() },

  { region: "Region Västerbotten", hospitalName: "Norrlands universitetssjukhus Umeå", clinics: uni() },
  { region: "Region Västerbotten", hospitalName: "Skellefteå sjukhus", clinics: basePlus() },
  { region: "Region Västerbotten", hospitalName: "Lycksele sjukhus", clinics: basePlus() },

  { region: "Region Norrbotten", hospitalName: "Sunderby sjukhus", clinics: basePlus(...UNIVERSITY_EXTRA) },
  { region: "Region Norrbotten", hospitalName: "Kiruna sjukhus", clinics: basePlus() },
  { region: "Region Norrbotten", hospitalName: "Gällivare sjukhus", clinics: basePlus() },
  { region: "Region Norrbotten", hospitalName: "Piteå älvdals sjukhus", clinics: basePlus() },
];

export function clinicsForHospitalSeed(region: string, hospitalName: string): string[] {
  const row = SWEDISH_HOSPITAL_CLINICS_SEED.find(
    (s) => s.region === region && s.hospitalName === hospitalName
  );
  return row ? [...row.clinics] : [];
}
