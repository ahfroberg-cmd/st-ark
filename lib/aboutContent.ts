// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

export const aboutContent = {
  instruction: {
    text: "ST-ARK är ett verktyg för att planera och dokumentera din specialiseringstjänstgöring. Systemet stödjer både ST-läkare och studierektorer med olika funktioner anpassade för respektive roll.",
    gettingStarted: {
      title: "Kom igång",
      description: "För ST-läkare: Börja planera din ST-tjänstgöring genom att klicka i något av spåren i tidslinjen:",
      tracks: [
        {
          name: "Kliniska tjänstgöringar (bredare spår)",
          description: "Det övre, bredare spåret i varje årsrad används för att lägga till kliniska tjänstgöringar, auskultationer, arbeten och ledighet. Klicka var som helst i detta spår för att börja lägga till en aktivitet.",
        },
        {
          name: "Utbildningsaktiviteter (smalare spår)",
          description: "Det nedre, smalare spåret i varje årsrad används för att lägga till kurser och andra utbildningsaktiviteter. Klicka var som helst i detta spår för att börja lägga till en kurs.",
        },
      ],
    },
    studierektorFeatures: {
      title: "För studierektorer",
      description: "Studierektorer har tillgång till ett dashboard med utökade funktioner:",
      features: [
        {
          name: "ST-läkare",
          description: "Översikt över alla ST-läkare i kliniken med information om fas (BT/ST), progress, pågående och kommande placeringar samt senaste uppdatering. Klicka på en ST-läkare för att se detaljerad tidslinje och milestoneöversikt.",
        },
        {
          name: "Kommunikation",
          description: "Skicka meddelanden och föreslå aktiviteter till ST-läkare. För progressionsbedömningar identifieras automatiskt aktuell placering baserat på valt datum.",
        },
        {
          name: "Utbildningsaktiviteter",
          description: "Skapa mallar för kliniska tjänstgöringar, kurser och andra utbildningsaktiviteter med förslag på delmål och beskrivningar. METIS-kurser kan prefillas med standarddelmål för både 2015 och 2021 års målbeskrivningar.",
        },
        {
          name: "Övergripande tidslinje",
          description: "Visualisera alla ST-läkares tidslinjer samtidigt med två vyer: Översikt (månad för månad) och Slutdatum (beräknade slutdatum för alla ST-läkare).",
        },
      ],
    },
    shortcuts: {
      title: "Kortkommandon",
      sections: [
        {
          name: "Allmänt",
          items: [
            "ESC - Stäng öppet fönster eller avbryt",
          ],
        },
        {
          name: "Varningsrutor (osparade ändringar)",
          items: [
            "ESC - Avbryt och behåll ändringar",
            "Cmd/Ctrl + Enter - Spara och stäng",
            "Delete eller Cmd/Ctrl + Backspace - Stäng utan att spara",
          ],
        },
        {
          name: "Bekräftelsedialoger (ta bort)",
          items: [
            "ESC - Avbryt",
            "Enter - Bekräfta och ta bort",
          ],
        },
        {
          name: "I formulär och modaler",
          items: [
            "Cmd/Ctrl + Enter - Spara ändringar (när det finns osparade ändringar)",
            "ESC - Stäng fönster (visar varning om det finns osparade ändringar)",
          ],
        },
      ],
    },
  },
  
  about: {
    paragraphs: [
      "ST-ARK har skapats som ett verktyg för dokumentation och planering av läkarnas specialiseringstjänstgöring. Under betaperioden tillhandahålls applikationen för utvärdering och källkoden distribueras inte öppet.",
      "Upphovsman är Andreas Fröberg, specialist i psykiatri och verksam som sektionschef på Psykiatri Psykos, Sahlgrenska Universitetssjukhuset. Utan programmeringserfarenhet och på kort tid har appen tagits fram med hjälp av språkmodellen ChatGPT 5.1 och den AI-drivna kodeditorn Cursor. Projektet illustrerar hur den snabba teknikutvecklingen gör det möjligt att bygga relativt avancerade digitala tjänster på kort tid, även med begränsade resurser och låg grad av teknisk kunskap.",
      "Arbetet med applikationen pekar också på en större förändring i omvärlden. När allt fler kan utveckla egna digitala produkter med liten insats kommer användare, medarbetare och samarbetspartner att jämföra offentliga tjänster med en tekniknivå som tidigare bara fanns hos större organisationer. Detta innebär att förväntningarna på offentlig sektor förändras.",
      "För att behålla legitimitet och relevans behöver offentliga verksamheter tydligt visa vad som är kärnan i det offentliga uppdraget. Värden som rättssäkerhet, likvärdighet, kontinuitet, öppenhet och skydd av känsliga uppgifter måste också avspeglas i digitala tjänster som upplevs moderna och användbara.",
      "Projektet visar att offentlig sektor har goda möjligheter att själva utveckla digitala lösningar som är nära verksamhetens behov. Att skapa system inifrån organisationen kan ge högre flexibilitet, kortare ledtider och bättre kontroll. Då digitala system inte har någon marginalkostnad ger det också möjlighet att dela med sig till närliggande verksamheter, såsom över kommun- och regiongränserna.",
      "Det finns inget kommersiellt intresse i applikationen.",
      "Applikationen fungerar därför både som ett praktiskt verktyg och som ett exempel på vilken kapacitet som redan finns att tillgå och möjligheter att utveckla egna verktyg in-house, liksom hur denna kapacitet formar omvärldens förväntningar på framtida digitala tjänster inom offentlig sektor.",
    ],
    commercialInterestIndex: 5, // Index för stycket om kommersiellt intresse (för styling)
  },

  privacy: {
    paragraphs: [
      "Applikationen lagrar personuppgifter och utbildningsdata i en säker databas (Supabase). All data krypteras vid överföring och lagring. Endast användaren själv och eventuella studierektorer med behörighet kan komma åt användarens data.",
      "Vid användning av funktioner för dokumenttolkning skickas uppladdade dokument till en extern OCR-tjänst (ocr.space) för textigenkänning. Denna överföring sker på användarens initiativ och enbart för att möjliggöra den efterfrågade funktionen. Applikationen sparar inte de dokument eller uppgifter som behandlas av OCR-tjänsten.",
      "Användaren kan när som helst exportera sin data som JSON-filer och har full kontroll över vilken information som delas med studierektorer och andra användare i systemet.",
    ],
  },
  
  license: {
    intro: "ST-ARK tillhandahålls under en proprietär licens under betaperioden. Det innebär bland annat:",
    points: [
      "Användning är tillåten endast för utvärdering inom betatestet.",
      "Källkod och material får inte spridas vidare utan skriftligt tillstånd.",
      "Det är inte tillåtet att använda, modifiera eller distribuera koden i egna projekt utan separat avtal.",
      "Licensvillkor och eventuella undantag lämnas på begäran.",
    ],
    licenseUrl: "",
  },
};
