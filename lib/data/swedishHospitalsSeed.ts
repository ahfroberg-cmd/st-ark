/**
 * Standardsjukhus för import till tabellen `hospitals` (superadmin → Sjukhus).
 * Källa: offentlig översikt per region (ej komplett lista över varje vårdcentral).
 * Nya sjukhus läggs till i appen eller via seed-synk.
 */
export type SwedishHospitalSeed = { region: string; name: string };

export const SWEDISH_HOSPITALS_SEED: SwedishHospitalSeed[] = [
  { region: "Region Stockholm", name: "Karolinska Universitetssjukhuset Solna" },
  { region: "Region Stockholm", name: "Karolinska Universitetssjukhuset Huddinge" },
  { region: "Region Stockholm", name: "Södersjukhuset" },
  { region: "Region Stockholm", name: "Danderyds sjukhus" },
  { region: "Region Stockholm", name: "S:t Görans sjukhus" },
  { region: "Region Stockholm", name: "Ersta sjukhus" },
  { region: "Region Stockholm", name: "Sabbatsbergs sjukhus" },
  { region: "Region Stockholm", name: "Norrtälje sjukhus" },
  { region: "Region Stockholm", name: "Södertälje sjukhus" },

  { region: "Region Västra Götaland", name: "Sahlgrenska Universitetssjukhuset" },
  { region: "Region Västra Götaland", name: "Alingsås lasarett" },
  { region: "Region Västra Götaland", name: "Borås sjukhus" },
  { region: "Region Västra Götaland", name: "Lidköpings sjukhus" },
  { region: "Region Västra Götaland", name: "Mariestads sjukhus" },
  { region: "Region Västra Götaland", name: "Skövde sjukhus" },
  { region: "Region Västra Götaland", name: "Skene sjukhus" },
  { region: "Region Västra Götaland", name: "Trollhättans sjukhus" },
  { region: "Region Västra Götaland", name: "Uddevalla sjukhus" },
  { region: "Region Västra Götaland", name: "Kungälvs sjukhus" },
  { region: "Region Västra Götaland", name: "Lysekils sjukhus" },
  { region: "Region Västra Götaland", name: "Varbergs sjukhus" },
  { region: "Region Västra Götaland", name: "Vänersborgs sjukhus" },
  { region: "Region Västra Götaland", name: "Frölunda specialistsjukhus" },
  { region: "Region Västra Götaland", name: "Högsbo sjukhus" },

  { region: "Region Skåne", name: "Skånes universitetssjukhus Lund" },
  { region: "Region Skåne", name: "Skånes universitetssjukhus Malmö" },
  { region: "Region Skåne", name: "Helsingborgs lasarett" },
  { region: "Region Skåne", name: "Kristianstad sjukhus" },
  { region: "Region Skåne", name: "Ystads lasarett" },
  { region: "Region Skåne", name: "Trelleborgs lasarett" },
  { region: "Region Skåne", name: "Ängelholms sjukhus" },
  { region: "Region Skåne", name: "Landskrona lasarett" },

  { region: "Region Uppsala", name: "Akademiska sjukhuset" },
  { region: "Region Uppsala", name: "Enköpings sjukhus" },

  { region: "Region Östergötland", name: "Universitetssjukhuset i Linköping" },
  { region: "Region Östergötland", name: "Vrinnevisjukhuset" },
  { region: "Region Östergötland", name: "Motala lasarett" },
  { region: "Region Östergötland", name: "Norrköpings sjukhus" },

  { region: "Region Jönköpings län", name: "Ryhovs sjukhus" },
  { region: "Region Jönköpings län", name: "Höglandssjukhuset Eksjö" },
  { region: "Region Jönköpings län", name: "Värnamo sjukhus" },

  { region: "Region Örebro län", name: "Universitetssjukhuset Örebro" },
  { region: "Region Örebro län", name: "Karlskoga lasarett" },
  { region: "Region Örebro län", name: "Lindesbergs lasarett" },

  { region: "Region Västmanland", name: "Västmanlands sjukhus Västerås" },
  { region: "Region Västmanland", name: "Köpings sjukhus" },
  { region: "Region Västmanland", name: "Fagersta lasarett" },

  { region: "Region Sörmland", name: "Mälarsjukhuset Eskilstuna" },
  { region: "Region Sörmland", name: "Kullbergska sjukhuset Katrineholm" },
  { region: "Region Sörmland", name: "Nyköpings lasarett" },

  { region: "Region Gotland", name: "Visby lasarett" },

  { region: "Region Kalmar län", name: "Kalmar sjukhus" },
  { region: "Region Kalmar län", name: "Oskarshamns sjukhus" },
  { region: "Region Kalmar län", name: "Västerviks sjukhus" },

  { region: "Region Kronoberg", name: "Centrallasarettet Växjö" },
  { region: "Region Kronoberg", name: "Ljungby lasarett" },

  { region: "Region Blekinge", name: "Blekingesjukhuset Karlskrona" },
  { region: "Region Blekinge", name: "Karlshamns sjukhus" },

  { region: "Region Halland", name: "Hallands sjukhus Halmstad" },
  { region: "Region Halland", name: "Hallands sjukhus Varberg" },
  { region: "Region Halland", name: "Hallands sjukhus Falkenberg" },
  { region: "Region Halland", name: "Hallands sjukhus Kungsbacka" },

  { region: "Region Dalarna", name: "Falu lasarett" },
  { region: "Region Dalarna", name: "Mora lasarett" },
  { region: "Region Dalarna", name: "Ludvika lasarett" },

  { region: "Region Gävleborg", name: "Gävle sjukhus" },
  { region: "Region Gävleborg", name: "Hudiksvalls sjukhus" },
  { region: "Region Gävleborg", name: "Bollnäs sjukhus" },

  { region: "Region Värmland", name: "Centrallasarettet Karlstad" },
  { region: "Region Värmland", name: "Torsby sjukhus" },
  { region: "Region Värmland", name: "Arvika sjukhus" },

  { region: "Region Västernorrland", name: "Sundsvalls sjukhus" },
  { region: "Region Västernorrland", name: "Örnsköldsviks sjukhus" },
  { region: "Region Västernorrland", name: "Sollefteå sjukhus" },

  { region: "Region Jämtland Härjedalen", name: "Östersunds sjukhus" },
  { region: "Region Jämtland Härjedalen", name: "Härjedals sjukhus Sveg" },

  { region: "Region Västerbotten", name: "Norrlands universitetssjukhus Umeå" },
  { region: "Region Västerbotten", name: "Skellefteå sjukhus" },
  { region: "Region Västerbotten", name: "Lycksele sjukhus" },

  { region: "Region Norrbotten", name: "Sunderby sjukhus" },
  { region: "Region Norrbotten", name: "Kiruna sjukhus" },
  { region: "Region Norrbotten", name: "Gällivare sjukhus" },
  { region: "Region Norrbotten", name: "Piteå älvdals sjukhus" },
];
