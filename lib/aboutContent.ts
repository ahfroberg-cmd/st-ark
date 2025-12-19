//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

export const aboutContent = {
  instruction: {
    text: "Instruktionsvideo kommer inom kort.",
    gettingStarted: {
      title: "Kom igång",
      description: "För att börja planera din ST-tjänstgöring, klicka i något av spåren i tidslinjen:",
      tracks: [
        {
          name: "Placeringar (bredare spår)",
          description: "Det övre, bredare spåret i varje årsrad används för att lägga till kliniska tjänstgöringar, auskultationer, arbeten och ledighet. Klicka var som helst i detta spår för att börja lägga till en aktivitet.",
        },
        {
          name: "Kurser (smalare spår)",
          description: "Det nedre, smalare spåret i varje årsrad används för att lägga till kurser. Klicka var som helst i detta spår för att börja lägga till en kurs.",
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
      "ST-ARK har skapats som ett öppet verktyg för dokumentation och planering av läkarnas specialiseringstjänstgöring. Kodbasen är fritt tillgänglig för insyn, nedladdning och vidareutveckling, vilket gör det möjligt att anpassa efter lokala behov och bidra till förbättring av programmet.",
      "Upphovsman är Andreas Fröberg, specialist i psykiatri och verksam som sektionschef på Psykiatri Psykos, Sahlgrenska Universitetssjukhuset. Utan programmeringserfarenhet och på kort tid har appen tagits fram med hjälp av språkmodellen ChatGPT 5.1 och den AI-drivna kodeditorn Cursor. Projektet illustrerar hur den snabba teknikutvecklingen gör det möjligt att bygga relativt avancerade digitala tjänster på kort tid, även med begränsade resurser och låg grad av teknisk kunskap.",
      "Arbetet med applikationen pekar också på en större förändring i omvärlden. När allt fler kan utveckla egna digitala produkter med liten insats kommer användare, medarbetare och samarbetspartner att jämföra offentliga tjänster med en tekniknivå som tidigare bara fanns hos större organisationer. Detta innebär att förväntningarna på offentlig sektor förändras.",
      "För att behålla legitimitet och relevans behöver offentliga verksamheter tydligt visa vad som är kärnan i det offentliga uppdraget. Värden som rättssäkerhet, likvärdighet, kontinuitet, öppenhet och skydd av känsliga uppgifter måste också avspeglas i digitala tjänster som upplevs moderna och användbara.",
      "Projektet visar att offentlig sektor har goda möjligheter att själva utveckla digitala lösningar som är nära verksamhetens behov. Att skapa system inifrån organisationen kan ge högre flexibilitet, kortare ledtider och bättre kontroll. Då digitala system inte har någon marginalkostnad ger det också möjlighet att dela med sig till närliggande verksamheter, såsom över kommun- och regiongränserna.",
      "Det finns inget kommersiellt intresse i applikationen.",
      "Applikationen fungerar därför både som ett praktiskt verktyg och som ett exempel på vilken kapacitet som redan finns att tillgå och möjligheter att utveckla egna verktyg in-house, liksom hur denna kapacitet formar omvärldens förväntningar på framtida digitala tjänster inom offentlig sektor.",
    ],
    commercialInterestIndex: 5, // Index för stycket om kommersiellt intresse (för styling)
  },
  
  download: {
    intro: "Ladda ned projektet för lokal installation och vidareutveckling. Även för någon som varken kan programmera eller har större datorvana är det tack vare AI-baserade språkmodeller enkelt att själv använda och vidareutveckla appen.",
    steps: {
      title: "Så här gör du om du inte har datorvana:",
      items: [
        "Ladda ned projektet som en komprimerad fil här.",
        "Öppna någon större AI-baserad språkmodell, till exempel ChatGPT, Claude, Gemini eller Mistral.",
        "Kopiera in zip-filen i chatrutan och skriv in följande text:",
      ],
      exampleText: "Denna zip-fil är ett open source-projekt. Jag vill göra ändringar i appen utan att kunna programmera. Ge mig mycket enkla steg för hur jag kan ändra text, lägga till nya fält eller justera funktioner. Föreslå gärna användning av en enkel kodeditor med inbyggd AI och skriv exakt vad jag ska göra och vilken kod som ska ersättas med vad.",
    },
    githubZipUrl: "https://github.com/ahfroberg-cmd/st-ark/archive/refs/heads/main.zip",
  },
  
  privacy: {
    paragraphs: [
      "Applikationen lagrar inga personuppgifter på externa servrar. All information hanteras lokalt i användarens webbläsare eller i filer som användaren själv sparar och förvaltar.",
      "Vid användning av funktioner för dokumenttolkning skickas uppladdade dokument till en extern OCR-tjänst (ocr.space) för textigenkänning. Denna överföring sker på användarens initiativ och enbart för att möjliggöra den efterfrågade funktionen. Applikationen sparar inte de dokument eller uppgifter som behandlas av OCR-tjänsten.",
      "Användaren ansvarar själv för vilken information som laddas upp, hur resultatet används samt för lagring och informationssäkerhet i sin egen miljö.",
    ],
  },
  
  license: {
    intro: "Projektet omfattas av Apache License 2.0. Det innebär bland annat:",
    points: [
      "Du får kopiera, ändra och distribuera projektet.",
      "Du får använda koden i egna applikationer, även kommersiella.",
      "Du måste inkludera licenstexten när du sprider vidare din version.",
      "Du får inte framställa det som att den ursprungliga utvecklaren ansvarar för din vidareutveckling eller drift.",
    ],
    licenseUrl: "https://github.com/ahfroberg-cmd/st-ark/blob/main/LICENSE",
  },
};
