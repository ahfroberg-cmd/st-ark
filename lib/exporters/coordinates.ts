// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

export const coords2021Bil8 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },
  delmal: { x: 76, y: 508 },
  tjstgStalle: { x: 76, y: 450 },
  period: { x: 375, y: 450 },
  beskrivning: { x: 76, y: 418 },
  ortDatum: { x: 105, y: 260 },
  namnfortydligande: { x: 76, y: 143 },
  handledarSpec: { x: 76, y: 105 },
  handledarTjanstestalle: { x: 76, y: 68 },
  bilagaNr: { x: 505, y: 42 },
} as const;

/* ---------- 2021 – Klinisk tjänstgöring (Bilaga 9) ---------- */
export const coords2021Bil9 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },
  delmal: { x: 76, y: 508 },
  tjstgStalle: { x: 76, y: 450 },
  period: { x: 375, y: 450 },
  beskrivning: { x: 76, y: 418 },
  ortDatum: { x: 105, y: 260 },
  namnfortydligande: { x: 76, y: 143 },
  handledarSpec: { x: 76, y: 105 },
  handledarTjanstestalle: { x: 76, y: 68 },
  bilagaNr: { x: 505, y: 42 },
} as const;

/* ---------- 2021 – Kurs (Bilaga 10) ---------- */
export const coords2021Bil10 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },
  delmal: { x: 76, y: 508 },

  // Kursens ämne – vi använder title via values.tjstgStalle (se fill2021Generic)
  tjstgStalle: { x: 76, y: 452 },


  // Beskrivning av kursen
  beskrivning: { x: 76, y: 418 },

  // Kryssrutor – markeras beroende på signer.type
  // (justera x/y efter behov när du testar mot mallen)
  kursledareX: { x: 172, y: 225 },
  handledareX: { x: 80, y: 225 },

  ortDatum: { x: 105, y: 260 },

  // Signaturraden
  namnfortydligande: { x: 76, y: 143 },
  handledarSpec: { x: 76, y: 105 },
  handledarPersonnummer: { x: 355, y: 143 }, // nytt fält (justera vid behov)
  handledarTjanstestalle: { x: 76, y: 68 },

  bilagaNr: { x: 505, y: 42 },
} as const;



/* ---------- 2021 – Förbättringsarbete (Bilaga 11) ---------- */
export const coords2021Bil11 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },
  delmal: { x: 76, y: 508 },
  tjstgStalle: { x: 76, y: 452 }, //=Titel
  beskrivning: { x: 76, y: 418 },
  ortDatum: { x: 105, y: 260 },
  namnfortydligande: { x: 76, y: 143 },
  handledarSpec: { x: 76, y: 105 },
  handledarTjanstestalle: { x: 76, y: 68 },
  bilagaNr: { x: 505, y: 42 },
} as const;

/* =========================================
   2015 – Koordinater (egna per blankett)
========================================= */

export const coords2015Placering = {
  efternamn: { x: 80, y: 637 },
  fornamn: { x: 305, y: 637 },
  personnummer: { x: 80, y: 608 },
  specialitet: { x: 80, y: 566 },
  delmal: { x: 80, y: 538 },
  plats: { x: 80, y: 495 },
  period: { x: 330, y: 495 },
  beskrivning: { x: 80, y: 455 },
  ortDatum: { x: 120, y: 210 },
  handledare: { x: 305, y: 67 },
  handledarSpec: { x: 80, y: 124 },
  handledarTjanstestalle: { x: 80, y: 96 },
  bilagaNr: { x: 505, y: 42 },
} as const;

export const coords2015Auskultation = { ...coords2015Placering } as const;
export const coords2015Skriftligt   = { ...coords2015Placering } as const;
export const coords2015Kvalitet     = { ...coords2015Placering } as const;
export const coords2015Kurs = {
  efternamn: { x: 80, y: 637 },
  fornamn: { x: 305, y: 637 },
  personnummer: { x: 80, y: 608 },
  specialitet: { x: 80, y: 566 },
  delmal: { x: 80, y: 538 },
  amne: { x: 80, y: 495 },          
  period: { x: 330, y: 495 },      
  kursledare1: { x: 80, y: 468 },
  beskrivning: { x: 80, y: 425 },

  // Kryssrutor för “Intygas av”
  kursledareX: { x: 78, y: 134 },  
  handledareX: { x: 166,  y: 134 },  

  // Kursledarsektionen (används när kursledare signerar)
  kursledare2: { x: 305, y: 52 },  
  kursledarSpec: { x: 80, y: 107 }, 
  kursledarTjanstestalle: { x: 80, y: 79 }, 

  // Handledarsektionen (används när handledare signerar)
  handledare: { x: 305, y: 52 },
  handledarSpec: { x: 80, y: 107 },
  handledarTjanstestalle: { x: 80, y: 79 },

  ortDatum: { x: 120, y: 210 },
  bilagaNr: { x: 505, y: 42 },
} as const;
