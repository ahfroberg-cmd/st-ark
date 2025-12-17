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
"use client";

import React, { useState, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MobileAbout({ open, onClose }: Props) {
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState("");
  const overlayRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleRequestClose = () => {
    setContactForm({ name: "", email: "", message: "" });
    setContactSuccess(false);
    setContactError("");
    onClose();
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);
    setContactError("");
    setContactSuccess(false);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setContactError(data.error || "Ett fel uppstod");
        return;
      }

      // Öppna mailto-länk
      if (data.mailtoLink) {
        window.location.href = data.mailtoLink;
        setContactSuccess(true);
        setContactForm({ name: "", email: "", message: "" });
      }
    } catch (error) {
      console.error("Kontaktformulär fel:", error);
      setContactError("Ett fel uppstod när meddelandet skulle skickas");
    } finally {
      setContactSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-5 py-4">
          <h1 className="text-xl font-extrabold text-sky-900">Om</h1>
          <button
            onClick={handleRequestClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px shrink-0"
          >
            ✕
          </button>
        </header>

        {/* Content - Scrollbar lista med sektioner */}
        <div className="flex-1 overflow-y-auto">
          {/* Instruktion */}
          <section className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Instruktion</h2>
            <p className="text-slate-700">Instruktionsvideo kommer inom kort.</p>
          </section>

          {/* Upphov och syfte */}
          <section className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Upphov och syfte</h2>
            <div className="space-y-3 text-slate-700">
              <p>
                ST-ARK har skapats som ett öppet verktyg för dokumentation och planering av läkarnas specialiseringstjänstgöring. Kodbasen är fritt tillgänglig för insyn och vidareutveckling, vilket gör det möjligt att anpassa efter lokala behov och bidra till förbättring av programmet.
              </p>
              <p>
                Skapare är Andreas Fröberg, specialist i psykiatri och verksam som sektionschef på Psykiatri Psykos, Sahlgrenska Universitetssjukhuset. Utan programmeringserfarenhet och på kort tid har appen tagits fram med hjälp av språkmodellen ChatGPT 5.1 och den AI-drivna editorn Cursor. Projektet vill visa upp hur den snabba teknikutvecklingen gör det möjligt att bygga avancerade digitala tjänster på kort tid, även med begränsade resurser och teknisk kunskap.
              </p>
              <p>
                Arbetet med applikationen pekar också på en större förändring i omvärlden. När allt fler kan utveckla egna digitala produkter med liten insats kommer användare, medarbetare och samarbetspartner att jämföra offentliga tjänster med en tekniknivå som tidigare bara fanns hos större organisationer. Detta innebär att förväntningarna på offentlig sektor förändras.
              </p>
              <p>
                För att behålla legitimitet och relevans behöver offentliga verksamheter tydligt visa vad som är kärnan i det offentliga uppdraget. Värden som rättssäkerhet, likvärdighet, kontinuitet, öppenhet och skydd av känsliga uppgifter måste också avspeglas i digitala tjänster som upplevs moderna och användbara.
              </p>
              <p>
                Projektet visar att offentlig sektor har goda möjligheter att själva utveckla digitala lösningar som är nära verksamhetens behov. Att skapa system inifrån organisationen kan ge högre flexibilitet, kortare ledtider och bättre kontroll. Då digitala system inte har någon marginalkostnad ger det också möjlighet att dela med sig till närliggande verksamheter, såsom över kommun- och regiongränserna.
              </p>
              <p>
                Applikationen fungerar därför både som ett praktiskt verktyg och som ett exempel på vilken kapacitet som redan finns att tillgå och möjligheter att utveckla egna verktyg in-house, liksom hur denna kapacitet formar omvärldens förväntningar på framtida digitala tjänster inom offentlig sektor.
              </p>
              <p className="mt-4 font-semibold text-slate-900">
                Det finns inget kommersiellt intresse i applikationen.
              </p>
            </div>
          </section>

          {/* Kontakt */}
          <section className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Kontakt</h2>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Namn
                </label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  required
                  className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  E-postadress
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  required
                  className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Meddelande
                </label>
                <textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  required
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              {contactError && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {contactError}
                </div>
              )}
              {contactSuccess && (
                <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
                  Meddelandet har skickats! Din e-postklient öppnas nu.
                </div>
              )}
              <button
                type="submit"
                disabled={contactSubmitting}
                className="w-full inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              >
                {contactSubmitting ? "Skickar..." : "Skicka meddelande"}
              </button>
            </form>
          </section>

          {/* Ladda ned projektet */}
          <section className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Ladda ned projektet</h2>
            <div className="space-y-3 text-slate-700">
              <p>
                Ladda ned projektet för lokal installation och vidareutveckling. Även för någon som varken kan programmera eller har större datorvana är det tack vare AI-baserade språkmodeller enkelt att själv använda och vidareutveckla appen.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-2 text-sm font-extrabold text-slate-900">
                  Så här gör du om du inte har datorvana:
                </h3>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Ladda ned projektet som en komprimerad fil här.</li>
                  <li>
                    Öppna någon större AI-baserad språkmodell, till exempel ChatGPT, Claude, Gemini eller Mistral.
                  </li>
                  <li>Kopiera in zip-filen i chatrutan och skriv in följande text:</li>
                </ol>
                <div className="mt-3 rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm">
                  Denna zip-fil är ett open source-projekt. Jag vill göra ändringar i appen utan att kunna programmera. Ge mig mycket enkla steg för hur jag kan ändra text, lägga till nya fält eller justera funktioner. Föreslå gärna användning av en enkel kodeditor med inbyggd AI och skriv exakt vad jag ska göra och vilken kod som ska ersättas med vad.
                </div>
              </div>
              <div className="mt-4">
                <a
                  href="https://github.com/ahfroberg-cmd/st-ark/archive/refs/heads/main.zip"
                  download
                  className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                >
                  Ladda ned projektet (ZIP)
                </a>
              </div>
            </div>
          </section>

          {/* Integritet och dataskydd */}
          <section className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Integritet och dataskydd</h2>
            <div className="space-y-3 text-slate-700">
              <p>
                Applikationen lagrar inga personuppgifter på externa servrar. All information hanteras lokalt i användarens webbläsare eller i filer som användaren själv sparar och förvaltar.
              </p>
              <p>
                Vid användning av funktioner för dokumenttolkning skickas uppladdade dokument till en extern OCR-tjänst (ocr.space) för textigenkänning. Denna överföring sker på användarens initiativ och enbart för att möjliggöra den efterfrågade funktionen. Applikationen sparar inte de dokument eller uppgifter som behandlas av OCR-tjänsten.
              </p>
              <p>
                Användaren ansvarar själv för vilken information som laddas upp, hur resultatet används samt för lagring och informationssäkerhet i sin egen miljö.
              </p>
            </div>
          </section>

          {/* Licensvillkor */}
          <section className="px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Licensvillkor</h2>
            <div className="space-y-3 text-slate-700">
              <p>
                Projektet omfattas av Apache License 2.0. Det innebär bland annat:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Du får kopiera, ändra och distribuera projektet.</li>
                <li>Du får använda koden i egna applikationer, även kommersiella.</li>
                <li>Du måste inkludera licenstexten när du sprider vidare din version.</li>
                <li>
                  Du får inte framställa det som att den ursprungliga utvecklaren ansvarar för din vidareutveckling eller drift.
                </li>
              </ul>
              <p>
                Den fullständiga licenstexten finns i filen{" "}
                <a
                  href="https://github.com/ahfroberg-cmd/st-ark/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:text-sky-700 underline"
                >
                  LICENSE
                </a>{" "}
                i projektets rotkatalog.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
