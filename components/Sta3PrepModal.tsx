// components/Sta3PrepModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { exportSta3Certificate } from "@/lib/exporters";
import { db } from "@/lib/db";

export type Sta3Item = {
  id: string;
  title: string;
  period?: string; // t.ex. "2024-01-01 – 2024-06-30" eller kursdatum
};

type Props = {
  open: boolean;
  onClose: () => void;

  // Listor till övre sektionen (kan komma från PusslaDinST)
  placements: Sta3Item[]; // Klinisk tjänstgöring med godkänt delmål STa3
  courses: Sta3Item[];    // Kurser med godkänt delmål STa3

  // Fält från modalen
  otherText: string;                 // Övriga aktiviteter
  onOtherTextChange: (v: string) => void;
  howVerifiedText: string;           // Hur det kontrollerats...
  onHowVerifiedTextChange: (v: string) => void;

  // Data för själva intyget (från raden som öppnade modalen + profil)
  profile: {
    name?: string;
    firstName?: string;
    lastName?: string;
    personalNumber?: string;
    speciality?: string;
    specialty?: string;
    homeClinic?: string;
  };
  researchTitle?: string;            // Titel på Vetenskapligt arbete (från raden)
  supervisorName?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
};

export default function Sta3PrepModal({
  open,
  onClose,

  // listor från PusslaDinST (fallback om auto-uppsamling inte ger något)
  placements,
  courses,

  // modal-fält
  otherText,
  onOtherTextChange,
  howVerifiedText,
  onHowVerifiedTextChange,

  // exporter-data
  profile,
  researchTitle,
  supervisorName,
  supervisorSpeciality,
  supervisorSite,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);


  // Auto-upplockade listor från DB (prioriteras före props om de innehåller något)
  const [autoPlacements, setAutoPlacements] = useState<Sta3Item[]>([]);
  const [autoCourses, setAutoCourses] = useState<Sta3Item[]>([]);

  // === STa3-detektion: samma princip som i PusslaDinST ===

  // Token: normalisera och kolla om det är just A3/STA3 (utan mellanslag, streck osv)
  const isSta3Token = (val: unknown): boolean => {
    const s = String(val ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return s === "STA3" || s === "A3";
  };

  // Har objektet STa3 i vanliga delmålsfält?
  const hasSta3InObj = (obj: any): boolean => {
    if (!obj || typeof obj !== "object") return false;

    // Typiska fält där delmål/delkoder brukar ligga
    const fields = [
      obj?.milestones,
      obj?.stMilestones,
      obj?.goals,
      obj?.goalIds,
      obj?.milestoneIds,
      obj?.codes,
    ];

    for (const arr of fields) {
      if (!arr) continue;
      for (const v of arr as any[]) {
        if (isSta3Token(v)) return true;
      }
    }

    // Enstaka strängar direkt på objektet
    const singles = [obj?.milestone, obj?.goal, obj?.code];
    for (const v of singles) {
      if (isSta3Token(v)) return true;
    }

    return false;
  };

  // När modalen öppnas: plocka upp STa3-kopplingar från DB
  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        const [achsRaw, placsRaw, crsRaw] = await Promise.all([
          (db as any).achievements?.toArray?.() ?? [],
          (db as any).placements?.toArray?.() ?? [],
          (db as any).courses?.toArray?.() ?? [],
        ]);

        const achs = achsRaw as any[];
        const placs = placsRaw as any[];
        const crs = crsRaw as any[];

        const placementIds = new Set<string>();
        const courseIds = new Set<string>();

        // 1) Läs från achievements (där delmål för placering/kurs ofta sparas)
        for (const ach of achs) {
          const cands = [ach.milestoneId, ach.goalId, ach.code, ach.milestone];
          if (cands.some(isSta3Token)) {
            if (ach.placementId) placementIds.add(String(ach.placementId));
            if (ach.courseId) courseIds.add(String(ach.courseId));
          }
        }

        // 2) Komplettera via själva placerings-/kursobjekten (om STa3 står där)
        for (const p of placs) {
          if (hasSta3InObj(p)) placementIds.add(String(p.id));
        }
        for (const c of crs) {
          if (hasSta3InObj(c)) courseIds.add(String(c.id));
        }

        // 3) Bygg listor som Sta3PrepModal visar

        const pickedPlacements: Sta3Item[] = placs
          .filter((p: any) => placementIds.has(String(p.id)))
          .map((p: any) => ({
            id: String(p.id),
            title: p.clinic || p.title || "Klinisk tjänstgöring",
            period: `${p.startDate || ""}${
              p.endDate ? ` – ${p.endDate}` : ""
            }${p.attendance ? ` · ${p.attendance}%` : ""}`.trim(),
          }));

        const pickedCourses: Sta3Item[] = crs
          .filter((c: any) => courseIds.has(String(c.id)))
          .map((c: any) => ({
            id: String(c.id),
            title: c.title || c.provider || "Kurs",
            period: [c.city, c.certificateDate || c.endDate || c.startDate]
              .filter(Boolean)
              .join(" · "),
          }));

        setAutoPlacements(pickedPlacements);
        setAutoCourses(pickedCourses);
      } catch (err) {
        console.error("STa3 auto-plockning misslyckades:", err);
        setAutoPlacements([]);
        setAutoCourses([]);
      }
    })();
  }, [open]);

  // ===== Dirty-logik för textfälten =====

  const [dirty, setDirty] = useState(false);
  const [savedOther, setSavedOther] = useState(otherText);
  const [savedHow, setSavedHow] = useState(howVerifiedText);

  useEffect(() => {
    if (open) {
      setSavedOther(otherText);
      setSavedHow(howVerifiedText);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    if (dirty) {
      const ok = confirm(
        "Du har osparade ändringar. Vill du stänga utan att spara?"
      );
      if (!ok) return;
    }
    onClose();
  };

  const handleOtherChange = (v: string) => {
    onOtherTextChange(v);
    setDirty(v !== savedOther || howVerifiedText !== savedHow);
  };

  const handleHowChange = (v: string) => {
    onHowVerifiedTextChange(v);
    setDirty(otherText !== savedOther || v !== savedHow);
  };

  const handleSave = () => {
    setSavedOther(otherText);
    setSavedHow(howVerifiedText);
    setDirty(false);
  };

  // Keyboard shortcut: Cmd/Ctrl+Enter för att spara, ESC för att stänga
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dirty, handleSave, handleClose, otherText, howVerifiedText, savedOther, savedHow]);

  if (!open) return null;

  // Välj automatiskt uppfångade aktiviteter om de finns, annars de som kom från PusslaDinST
  const listPlacements = autoPlacements.length ? autoPlacements : placements;
  const listCourses = autoCourses.length ? autoCourses : courses;

  const handleScrim: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      onClick={handleScrim}
      role="dialog"
      aria-modal="true"
      aria-label="Förbered intyg för STa3"
    >
      <div className="w-full max-w-[1000px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-lg font-extrabold text-slate-900">
            Förbered intyg för delmål STa3 - Medicinsk vetenskap
          </h2>
          <div className="flex items-center gap-2">
            <button
              disabled={!dirty}
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              title="Spara ändringar i denna modal"
              data-info="Sparar alla ändringar i STa3-intyget till databasen. Knappen är endast aktiv när det finns osparade ändringar."
            >
              Spara
            </button>
            <button
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              data-info="Stäng"
            >
              Stäng
            </button>
          </div>

        </div>


        {/* Body */}
        <div className="max-h-[75vh] overflow-auto p-4">
          {/* Övre sektion */}
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
            {/* HUVUDRUBRIK */}
            <div className="mb-3 text-base font-semibold text-slate-900">
              Utbildningsaktiviteter som genomförts för att uppnå delmålet
            </div>

            {/* Två kolumner: Vänster = Vetenskapligt + Klinisk, Höger = Kurser */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Vänster kolumn */}
              <div className="flex flex-col gap-4">
                {/* Vetenskapligt arbete */}
                <div>
                  <div className="mb-1 text-sm font-semibold text-slate-800">
                    Vetenskapligt arbete
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900">
                    {researchTitle || "—"}
                  </div>
                </div>

                {/* Klinisk tjänstgöring */}
                <div>
                  <div className="mb-1 text-sm font-semibold text-slate-800">
                    Klinisk tjänstgöring med godkänt delmål STa3
                  </div>
                  <div className="rounded-xl border border-slate-200">
                    {listPlacements.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-500">
                        Inget registrerat
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {listPlacements.map((p) => (
                          <li key={p.id} className="px-3 py-2">
                            <div className="text-sm font-medium text-slate-900">
                              {p.title || "—"}
                            </div>
                            {p.period && (
                              <div className="text-xs text-slate-600">
                                {p.period}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Höger kolumn: Kurser */}
              <div>
                <div className="mb-1 text-sm font-semibold text-slate-800">
                  Kurser med godkänt delmål STa3
                </div>
                <div className="rounded-xl border border-slate-200">
                  {listCourses.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      Inget registrerat
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {listCourses.map((c) => (
                        <li key={c.id} className="px-3 py-2">
                          <div className="text-sm font-medium text-slate-900">
                            {c.title || "—"}
                          </div>
                          {c.period && (
                            <div className="text-xs text-slate-600">
                              {c.period}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Övriga aktiviteter – spänner över båda kolumnerna */}
            <div className="mt-4">
              <label className="mb-1 block text-sm text-slate-700">
                Övriga aktiviteter
              </label>
              <textarea
                value={otherText}
                onChange={(e) => handleOtherChange(e.target.value)}
                className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
              />
            </div>
          </div>

          {/* Nedre sektion */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="mb-1 text-base font-semibold text-slate-900">
              Hur det kontrollerats att sökanden uppnått delmålet
            </div>
            <div className="mb-2 text-xs text-slate-600">
              Exempel: bedömningar av kliniskt omhändertagande eller
              kursexaminationer
            </div>
            <textarea
              value={howVerifiedText}
              onChange={(e) => handleHowChange(e.target.value)}
              className="min-h-[140px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
            />
          </div>
        </div>

                {/* Footer – endast förhandsgranskning nere till höger */}
        <footer className="border-t bg-white">
          <div className="flex items-center justify-end gap-2 px-4 py-3">
            {/* Stäng-knappen i footern borttagen – endast förhandsvisning här */}
            <button
              type="button"
              onClick={async () => {
                if (!profile) return;


                try {
                  setDownloading(true);

                  // Bygg rader för aktiviteter (som i befintlig download-logik)
                  const rawLines: string[] = [];

                  if (researchTitle) {
                    rawLines.push(`Vetenskapligt arbete: ${researchTitle}`);
                  }

                  if (listPlacements?.length) {
                    listPlacements.forEach((p) => {
                      rawLines.push(
                        `Klinisk tjänstgöring: ${p.title}${
                          p.period ? ` (${p.period})` : ""
                        }`
                      );
                    });
                  }

                  if (listCourses?.length) {
                    listCourses.forEach((c) => {
                      rawLines.push(
                        `Kurs: ${c.title}${c.period ? ` (${c.period})` : ""}`
                      );
                    });
                  }

                  if (otherText && otherText.trim()) {
                    rawLines.push("");
                    rawLines.push(otherText.trim());
                  }

                  // Samlad lista av icke-tomma rader (utan numrering, bara radbrytning)
                  const activitiesBlock = rawLines
                    .filter((line) => line.trim().length > 0)
                    .join("\n");

                  const howBlock = (howVerifiedText ?? "").trim();

                  if (!activitiesBlock && !howBlock) {
                    alert(
                      "Lägg till minst en rad under aktiviteter eller hur det kontrollerats innan du skapar intyget."
                    );
                    return;
                  }

                  const blob = await exportSta3Certificate(
                    {
                      profile,
                      supervisor: {
                        name: supervisorName ?? "",
                        // Använd samma stavning som i Sta3PrepModal (supervisorSpeciality)
                        speciality: supervisorSpeciality ?? "",
                        site: supervisorSite ?? profile.homeClinic ?? "",
                      },
                      activitiesText: activitiesBlock,
                      howVerifiedText: howBlock,
                    },
                    {
                      output: "blob",
                      filename: "intyg-sta3-2021.pdf",
                    }
                  );

                  if (blob instanceof Blob) {
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                    }
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(url);
                    setPreviewOpen(true);
                  } else {
                    alert(
                      "Det gick inte att skapa en förhandsgranskning av intyget."
                    );
                  }
                } catch (err) {
                  console.error("exportSta3Certificate error", err);
                  alert(
                    "Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen."
                  );
                } finally {
                  setDownloading(false);
                }
              }}
              disabled={downloading}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px disabled:opacity-60 disabled:pointer-events-none"
              data-info="Skapar och öppnar en förhandsvisning av STa3-intyget som PDF. Du kan sedan skriva ut eller spara intyget."
            >
              {downloading ? "Skapar förhandsgranskning…" : "Intyg delmål STa3"}
            </button>


          </div>
        </footer>

        {/* Förhandsvisning av genererad PDF */}
        <CertificatePreview
          open={previewOpen}
          url={previewUrl}
          onClose={() => {
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(null);
            setPreviewOpen(false);
          }}
        />
      </div>
    </div>
  );
}

type CertificatePreviewProps = {
  open: boolean;
  url: string | null;
  onClose: () => void;
};

function CertificatePreview({ open, url, onClose }: CertificatePreviewProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[85vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold">Förhandsvisning av intyg</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          {url ? (
            <iframe src={url} className="w-full h-full" title="Förhandsgranskning PDF" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-slate-500">
              Genererar …
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <a
            href={url ?? "#"}
            download="intyg-sta3-2021.pdf"
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
            onClick={(e) => {
              if (!url) e.preventDefault();
            }}
            data-info="Laddar ner STa3-intyget som en PDF-fil som du kan spara på din dator eller skriva ut."
          >
            Ladda ned PDF
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
            title="Stäng förhandsvisningen"
            data-info="Stänger förhandsvisningen av STa3-intyget och återgår till redigeringsvyn."
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}


