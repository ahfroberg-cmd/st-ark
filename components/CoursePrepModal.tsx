// components/CoursePrepModal.tsx
"use client";

import React from "react";
import { exportCertificate } from "@/lib/exporters";
import { db } from "@/lib/db";


type SignerType = "KURSLEDARE" | "HANDLEDARE";

type ProfileLike = {
  goalsVersion: "2015" | "2021";

  homeClinic?: string;

  // Namn/personnummer/specialitet för sökande
  name?: string;
  firstName?: string;
  lastName?: string;
  personalNumber?: string;
  speciality?: string;
  specialty?: string;

  // Huvudhandledare från Profil
  supervisor?: string;
  supervisorWorkplace?: string;
  supervisorSpecialty?: string;
  supervisorSpeciality?: string;
};




type CourseLike = {
  id: string;
  title: string;
  site?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
  notes?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  profile: ProfileLike;
  course: CourseLike | null;
  milestones?: string[]; // delmåls-koder som ska in i intyget
};

export default function CoursePrepModal({
  open,
  onClose,
  profile,
  course,
  milestones,
}: Props) {
  // Vem undertecknar?
  const [signerType, setSignerType] = React.useState<SignerType>("KURSLEDARE");

  // Handledare
  const [hName, setHName] = React.useState("");
  const [hSite, setHSite] = React.useState("");
  const [hSpec, setHSpec] = React.useState("");
  const [hPn, setHPn] = React.useState("");
  const [hSource, setHSource] = React.useState<"PROFILE" | "CUSTOM">("PROFILE");

    // Kursledare
  const [kName, setKName] = React.useState("");
  const [kSite, setKSite] = React.useState("");
  const [kSpec, setKSpec] = React.useState(""); // NYTT: Kursledares specialitet

  // Profilbaserade huvudhandledar-uppgifter (för 2015-läge)
  const profileSupervisorName = String(
    (profile as any)?.supervisor ?? ""
  );
  const profileSupervisorSite = String(
    (profile as any)?.homeClinic ||
      (profile as any)?.supervisorWorkplace ||
      ""
  );

  const profileSupervisorSpec = String(
    (profile as any)?.supervisorSpecialty ??
      (profile as any)?.supervisorSpeciality ??
      (profile as any)?.specialty ??
      (profile as any)?.speciality ??
      ""
  );

  // UI-state
  const [downloading, setDownloading] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  // Förhandsvisning (PDF) – samma mönster som i PrepareBtModal
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Snapshot av "sparat" läge för dirty-jämförelse
  const snapshotRef = React.useRef({
    signerType: "KURSLEDARE" as SignerType,
    hSource: "PROFILE" as "PROFILE" | "CUSTOM",
    hName: "",
    hSite: "",
    hSpec: "",
    hPn: "",
    kName: "",
    kSite: "",
    kSpec: "",
  });

  // När modalen öppnas – läs sparade värden från DB + defaults från Profil och nollställ dirty
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!open || !course) return;

      try {
        const [saved] = await Promise.all([
          (db as any).courses?.get?.(course.id),
        ]);

        if (cancelled) return;

        const p: any = (profile as any) || {};

        // Default: handledare från profilens huvudhandledare (om ifylld)
        const profileHName = String(p.supervisor || "");
        const profileHSite = String(p.homeClinic || p.supervisorWorkplace || "");

        const profileHSpec = String(
          p.supervisorSpecialty ??
            p.supervisorSpeciality ??
            p.specialty ??
            p.speciality ??
            ""
        );


        // Default: kursledare från ev. sparade fält
        const savedKName = String((saved as any)?.courseLeaderName || "");
        const savedKSite = String((saved as any)?.courseLeaderSite || "");
        const savedKSpec = String((saved as any)?.courseLeaderSpeciality || "");

        // Källa för handledare: sparad → annars heuristik (har man redan ett eget namn sparat → CUSTOM, annars PROFILE)
        const savedSource = (saved as any)?.supervisorSource;
        let initialHSource: "PROFILE" | "CUSTOM" =
          savedSource === "PROFILE" || savedSource === "CUSTOM"
            ? savedSource
            : (saved as any)?.supervisorName
            ? "CUSTOM"
            : "PROFILE";

        const useProfileForSupervisor = initialHSource === "PROFILE";

        const initialHName = String(
          useProfileForSupervisor
            ? profileHName
            : (saved as any)?.supervisorName ?? profileHName
        );
        const initialHSite = String(
          useProfileForSupervisor
            ? profileHSite
            : (saved as any)?.supervisorSite ?? profileHSite
        );
        const initialHSpec = String(
          useProfileForSupervisor
            ? profileHSpec
            : (saved as any)?.supervisorSpeciality ?? profileHSpec
        );
        const initialHPn = String(
          (saved as any)?.supervisorPersonalNumber || ""
        );

        // Kursledare: först ev. sparat värde från DB, annars från kursens detaljruta
        const courseKName = String((course as any)?.courseLeaderName || "");
        const courseKSite = String((course as any)?.courseLeaderSite || "");
        const courseKSpec = String(
          (course as any)?.courseLeaderSpeciality || ""
        );

        const initialKName = savedKName || courseKName;
        const initialKSite = savedKSite || courseKSite;
        const initialKSpec = savedKSpec || courseKSpec;

        setHSource(initialHSource);
        setHName(initialHName);
        setHSite(initialHSite);
        setHSpec(initialHSpec);
        setHPn(initialHPn);


        setKName(initialKName);
        setKSite(initialKSite);
        setKSpec(initialKSpec);

        const initialSignerType: SignerType =
          ((saved as any)?.signerType as SignerType) || "KURSLEDARE";

        setSignerType(initialSignerType);

        snapshotRef.current = {
          signerType: initialSignerType,
          hSource: initialHSource,
          hName: initialHName,
          hSite: initialHSite,
          hSpec: initialHSpec,
          hPn: initialHPn,
          kName: initialKName,
          kSite: initialKSite,
          kSpec: initialKSpec,
        };
        setDirty(false);
      } catch (e) {
        console.error(e);
        // Vid fel – nollställ till profilens default
        const p: any = (profile as any) || {};
        const profileHName = String(p.supervisor || "");
        const profileHSite = String(p.homeClinic || p.supervisorWorkplace || "");

        const profileHSpec = String(
          p.supervisorSpecialty ??
            p.supervisorSpeciality ??
            p.specialty ??
            p.speciality ??
            ""
        );

        setHSource("PROFILE");
        setHName(profileHName);
        setHSite(profileHSite);
        setHSpec(profileHSpec);
        setHPn("");

        setKName("");
        setKSite("");
        setKSpec("");

        snapshotRef.current = {
          signerType: "KURSLEDARE",
          hSource: "PROFILE",
          hName: profileHName,
          hSite: profileHSite,
          hSpec: profileHSpec,
          hPn: "",
          kName: "",
          kSite: "",
          kSpec: "",
        };
        setDirty(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);









  // Markera dirty när något ändras – jämför bara mot fält som faktiskt sparas i DB.
  // Vi skickar in nästa värden från onChange så att det räcker med ett tecken.
  const markDirty = React.useCallback(
    (overrides?: {
      hSource?: "PROFILE" | "CUSTOM";
      hName?: string;
      hSite?: string;
      hSpec?: string;
      hPn?: string;
      kName?: string;
      kSite?: string;
      kSpec?: string;
    }) => {
      const s = snapshotRef.current;

      const nextHSource = overrides?.hSource ?? hSource;
      const nextHName = overrides?.hName ?? hName;
      const nextHSite = overrides?.hSite ?? hSite;
      const nextHSpec = overrides?.hSpec ?? hSpec;
      const nextHPn = overrides?.hPn ?? hPn;
      const nextKName = overrides?.kName ?? kName;
      const nextKSite = overrides?.kSite ?? kSite;
      const nextKSpec = overrides?.kSpec ?? kSpec;

      const changed =
        s.hSource !== nextHSource ||
        s.hName !== nextHName ||
        s.hSite !== nextHSite ||
        s.hSpec !== nextHSpec ||
        s.hPn !== nextHPn ||
        s.kName !== nextKName ||
        s.kSite !== nextKSite ||
        s.kSpec !== nextKSpec;

      setDirty(changed);
    },
    [hSource, hName, hSite, hSpec, hPn, kName, kSite, kSpec]
  );


  // Spara = skriv till DB (skapa eller uppdatera rad) + uppdatera snapshot → dirty=false
const handleSave = async () => {
  try {
    if (!course) return;
    const site = (kSite ?? "").trim();
    const spec = (kSpec ?? "").trim();

    const id = (course as any).id;

    // Hämta eventuell befintlig rad så vi inte tappar andra fält (t.ex. certificateDate)
    const existing = (await db.courses.get(id)) as any;

    const updated = {
      ...(existing || {}),
      id,

      // Bevara/initialisera certificateDate om det behövs
      certificateDate:
        (existing && existing.certificateDate) ??
        (course as any)?.certificateDate ??
        "",

      // Handledare
      supervisorName: hName,
      supervisorSite: hSite,
      supervisorSpeciality: hSpec,
      supervisorPersonalNumber: hPn,

      // Kursledare
      courseLeaderName: kName,
      courseLeaderSite: site,
      courseLeaderSpeciality: spec,
    };

    // put = insert eller update beroende på om raden finns
    await db.courses.put(updated);

    snapshotRef.current = {
      signerType,
      hSource,
      hName,
      hSite,
      hSpec,
      hPn,
      kName,
      kSite: site,
      kSpec: spec,
    };
    setDirty(false);
  } catch (e) {
    console.error(e);
    alert("Kunde inte spara kursledarens uppgifter.");
  }
};





    // Öppna generisk PDF-blob i förhandsvisningsmodulen
  function openPreviewFromBlob(blob: Blob) {
    try {
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      alert("Kunde inte skapa förhandsvisningen.");
    }
  }

  // Enkel förhandsvisnings-modal (PDF) – samma UI som i PrepareBtModal
  function CertificatePreview({
    open,
    url,
    onClose,
  }: {
    open: boolean;
    url: string | null;
    onClose: () => void;
  }) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl h-[85vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Förhandsvisning av intyg</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            {url ? (
              <iframe src={url} className="w-full h-full" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-500">
                Genererar …
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
            <a
              href={url ?? "#"}
              download
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
              onClick={(e) => {
                if (!url) e.preventDefault();
              }}
            >
              Ladda ned PDF
            </a>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
              title="Stäng förhandsvisningen"
            >
              Stäng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stäng med varning om osparat
  const handleClose = () => {

    if (dirty) {
      const ok = confirm("Du har osparade ändringar. Vill du stänga utan att spara?");
      if (!ok) return;
    }
    onClose();
  };

  if (!open || !course) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Förbered intyg för nedladdning"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-[900px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-lg font-extrabold text-slate-900">
            Förbered kursintyg
          </h2>
          <div className="flex items-center gap-2">
            <button
              disabled={!dirty}
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              title="Spara ändringar i denna modal"
            >
              Spara
            </button>
            <button
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              title="Stäng – varnar om osparade ändringar"
            >
              Stäng
            </button>
          </div>
        </header>


                {/* Body */}
        <div className="max-h-[75vh] overflow-auto p-4">
          {/* Vem undertecknar — används för både 2015 och 2021 */}
          {(profile.goalsVersion === "2015" || profile.goalsVersion === "2021") && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-slate-800">
                Vem undertecknar?
              </h3>

                                        {/* Välj typ av underskrivare */}
              <div className="flex flex-wrap gap-3 pr-6 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    className="h-4 w-4.5"
                    checked={signerType === "HANDLEDARE"}
                    onChange={() => {
                      setSignerType("HANDLEDARE");
                      // signerType sparas inte i DB, påverkar inte dirty
                    }}
                  />
                  <span>Handledare</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    className="h-4 w-4.5"
                    checked={signerType === "KURSLEDARE"}
                    onChange={() => {
                      setSignerType("KURSLEDARE");
                      // signerType sparas inte i DB, påverkar inte dirty
                    }}
                  />
                  <span>Kursledare</span>
                </label>
              </div>


                     {signerType === "HANDLEDARE" ? (
          <div className="space-y-3">
            {profile.goalsVersion === "2015" && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-700">
                  Välj handledare
                </span>
                <select
                  value={hSource}
                  onChange={(e) => {
                    const next =
                      e.target.value === "PROFILE" ? "PROFILE" : "CUSTOM";
                    if (next === "PROFILE") {
                      // Använd huvudhandledare från profil
                      setHSource(next);
                      setHName(profileSupervisorName);
                      setHSite(profileSupervisorSite);
                      setHSpec(profileSupervisorSpec);
                      markDirty({
                        hSource: next,
                        hName: profileSupervisorName,
                        hSite: profileSupervisorSite,
                        hSpec: profileSupervisorSpec,
                      });
                    } else {
                      // Annan handledare – töm fälten
                      setHSource(next);
                      setHName("");
                      setHSite("");
                      setHSpec("");
                      markDirty({
                        hSource: next,
                        hName: "",
                        hSite: "",
                        hSpec: "",
                      });
                    }
                  }}
                  className="h-[32px] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                >
                  <option value="PROFILE">Huvudhandledare</option>
                  <option value="CUSTOM">Annan handledare</option>
                </select>
              </div>
            )}

            {(profile.goalsVersion !== "2015" || hSource === "CUSTOM") && (

              <>
                {/* Handledare */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    Handledare
                  </label>
                  <input
                    type="text"
                    value={hName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setHName(v);
                      markDirty({ hName: v });
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  />
                </div>

                {/* Handledares tjänsteställe */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    Handledares tjänsteställe
                  </label>
                  <input
                    type="text"
                    value={hSite}
                    onChange={(e) => {
                      const v = e.target.value;
                      setHSite(v);
                      markDirty({ hSite: v });
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  />
                </div>

                {/* Handledares specialitet */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">
                    Handledares specialitet
                  </label>
                  <input
                    type="text"
                    value={hSpec}
                    onChange={(e) => {
                      const v = e.target.value;
                      setHSpec(v);
                      markDirty({ hSpec: v });
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  />
                </div>

                
              </>
            )}
          </div>
        ) : (


                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {/* Kursledare – namn (hämtas från kursen, går att justera) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Kursledares namn
                    </label>
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      value={kName ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setKName(v);
                        markDirty({ kName: v });
                      }}
                    />

                  </div>

                  {/* Kursledare – tjänsteställe */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Kursledares tjänsteställe
                    </label>
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      value={kSite ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setKSite(v);
                        markDirty({ kSite: v });
                      }}
                    />

                  </div>

                  {/* Kursledare – specialitet */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Kursledares specialitet
                    </label>
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      value={kSpec ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setKSpec(v);
                        markDirty({ kSpec: v });
                      }}
                    />

                  </div>
                </div>
              )}



            </div>
          )}

        </div>

                {/* Footer – endast förhandsgranskning nere till höger */}
        <footer className="border-t bg-white">
          <div className="flex items-center justify-end px-4 py-3">
            {/* Ladda ned intyg / förhandsgranska */}
            <button
              onClick={async () => {
                try {
                  setDownloading(true);
                  if (!profile || !course) return;

                  // Skapa signer-objekt som exporten använder för att:
                  // - rita X vid kursledare/handledare
                  // - fylla namn/tjänsteställe (+ ev. spec för handledare)
                  const signer =
                    signerType === "HANDLEDARE"
                      ? profile.goalsVersion === "2015" && hSource === "PROFILE"
                        ? {
                            // 2015 + Huvudhandledare → ta alltid uppgifter från Profil
                            type: "HANDLEDARE" as const,
                            name: profileSupervisorName,
                            site: profileSupervisorSite,
                            speciality: profileSupervisorSpec,
                            personalNumber: hPn,
                          }
                        : {
                            // Övriga fall → använd fälten i modalen
                            type: "HANDLEDARE" as const,
                            name: hName,
                            site: hSite,
                            speciality: hSpec,
                            personalNumber: hPn,
                          }
                      : {
                          type: "KURSLEDARE" as const,
                        };

                  // Hämta riktig profil från DB (alltid den som ska in i intyget)
                  const storedProfile = (await db.profile.get("default")) as any;

                  // Derivera namn om något saknas
                  const rawName = String(storedProfile?.name || "");
                  const parts = rawName.trim().split(/\s+/).filter(Boolean);

                  const derivedLastName =
                    storedProfile?.lastName ||
                    (parts.length > 0 ? parts[parts.length - 1] : "");

                  const derivedFirstName =
                    storedProfile?.firstName ||
                    (parts.length > 1 ? parts.slice(0, -1).join(" ") : "");

                  const derivedSpecialty =
                    storedProfile?.specialty ||
                    storedProfile?.speciality ||
                    "";

                  const personalNumber =
                    storedProfile?.personalNumber || "";

                  // Profil som exportCertificate använder (den enda korrekta källan)
                  const fullProfile = {
                    ...storedProfile,
                    firstName: derivedFirstName,
                    lastName: derivedLastName,
                    specialty: derivedSpecialty,
                    personalNumber,
                  };

                  // Applicant (Sökande-rutan överst i bilaga 10)
                  const applicant = {
                    firstName: derivedFirstName,
                    lastName: derivedLastName,
                    personalNumber,
                    specialty: derivedSpecialty,
                  };

                  const blob = (await exportCertificate(
                    {
                      goalsVersion: profile.goalsVersion,
                      activityType: "KURS",
                      profile: fullProfile,
                                            activity: {
                        ...course,
                        // Ämne (titel) – används i Bilaga 10 (fält "Ämne")
                        title:
                          (course as any)?.title ||
                          (course as any)?.name ||
                          (course as any)?.courseTitle ||
                          "",

                        // Kursledarens namn tas från popupen (med fallback till ev. lagrat värde)
                        courseLeaderName:
                          kName || (course as any)?.courseLeaderName || "",

                        // 2015/2021: tjänsteställe + specialitet matas via popupen när Kursledare är vald
                        courseLeaderSite: kSite,
                        courseLeaderSpeciality: kSpec || "",

                        signer,
                        applicant,
                      } as any,

                      milestones: milestones ?? [],
                    },
                    { output: "blob", filename: "kursintyg-preview.pdf" }
                  )) as Blob;

                  openPreviewFromBlob(blob);
                } catch (e) {
                  console.error(e);
                  alert("Det gick inte att skapa kursintyget.");
                } finally {
                  setDownloading(false);
                }
              }}
              disabled={downloading}
              className={`inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold transition active:translate-y-px ${
                downloading
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-100"
              }`}
              title={downloading ? "Skapar intyget..." : "Förhandsgranska intyg"}
            >
              {downloading ? "Skapar..." : "Kursintyg"}
            </button>

          </div>
        </footer>

      </div>

      <CertificatePreview
        open={previewOpen}
        url={previewUrl}
        onClose={() => {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
          setPreviewOpen(false);
        }}
      />
    </div>
  );
}


