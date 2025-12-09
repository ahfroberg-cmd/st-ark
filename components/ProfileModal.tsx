// components/ProfileModal.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { Profile } from "@/lib/types";
import CalendarDatePicker from "@/components/CalendarDatePicker";

type Props = { open: boolean; onClose: () => void };

/** Platt specialitetslista (sorteras i UI) */
const SPECIALTIES: string[] = [
  "Akutsjukvård","Allergologi","Allmänmedicin","Anestesi och intensivvård","Arbets- och miljömedicin","Arbetsmedicin",
  "Barn- och ungdomsallergologi","Barn- och ungdomshematologi och onkologi","Barn- och ungdoms-kardiologi",
  "Barn- och ungdomskirurgi","Barn- och ungdomsmedicin","Barn- och ungdomsneurologi med habilitering",
  "Barn- och ungdomspsykiatri","Endokrinologi och diabetologi","Geriatrik","Gynekologisk onkologi","Handkirurgi",
  "Hematologi","Hud- och könssjukdomar","Hörsel- och balansrubbningar","Infektionssjukdomar","Internmedicin",
  "Kardiologi","Kärlkirurgi","Klinisk farmakologi","Klinisk fysiologi","Klinisk genetik",
  "Klinisk immunologi och transfusionsmedicin","Klinisk kemi","Klinisk mikrobiologi","Klinisk neurofysiologi",
  "Klinisk patologi","Kirurgi","Lungsjukdomar","Medicinsk gastroenterologi och hepatologi","Neonatologi",
  "Neurokirurgi","Neurologi","Neuroradiologi","Njurmedicin","Nuklearmedicin","Obstetrik och gynekologi","Onkologi",
  "Ortopedi","Palliativ medicin","Plastikkirurgi","Psykiatri","Radiologi","Rehabiliteringsmedicin","Reumatologi",
  "Rättsmedicin","Rättspsykiatri","Röst- och talrubbningar","Skolhälsovård (medicinska insatser i elevhälsan)",
  "Smärtlindring","Socialmedicin","Thoraxkirurgi","Urologi","Vårdhygien","Äldrepsykiatri","Ögonsjukdomar",
  "Öron-, näs- och halssjukdomar",
];

/** Fokus-säker textinput (buffrar lokalt, commit direkt vid input) */
function Input({
  value,
  onChange, // commit direkt (på input)
  type = "text",
  placeholder,
  inputMode,
}: {
  value: any;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [local, setLocal] = useState<string>(value ?? "");

  // Prop -> lokal endast när prop ändras utifrån (t.ex. vid laddning)
  useEffect(() => {
    const next = String(value ?? "");
    if (next !== local) setLocal(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = useCallback(
    (val?: string) => {
      const v = val ?? local;
      if (String(value ?? "") !== v) onChange(v);
    },
    [local, value, onChange]
  );

  return (
    <input
      type={type as any}
      value={local}
      onInput={(e) => {
        const v = (e.target as HTMLInputElement).value;
        setLocal(v);
        commit(v); // uppdatera form direkt -> dirty tänds direkt
      }}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete="off"
      spellCheck={false}
      className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
    />
  );
}






function Labeled({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm text-slate-700">{children}</label>;
}

export default function ProfileModal({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const empty: any = {
    id: "default",
    // Person
    name: "", personalNumber: "", address: "", postalCode: "", city: "", email: "",
    mobile: "", phoneHome: "", phoneWork: "",
    // ST
    homeClinic: "",
    supervisor: "", supervisorWorkplace: "",
    studyDirector: "", studyDirectorWorkplace: "",
    manager: "", verksamhetschef: "",
    specialty: "", goalsVersion: "2021", stStartDate: "",
    stTotalMonths: 66,
    medDegreeCountry: "", medDegreeDate: "",
    // Singulär legitimation (land + datum) – speglar profilsidan
    licenseCountry: "", licenseDate: "",
    // Nya centrala datapunkter (flyttade hit från Prepare*):
    hasForeignLicense: false,

    foreignLicenses: [] as { country: string; date: string }[],     // max 3 rader via UI
    hasPriorSpecialist: false,
    priorSpecialties: [] as { speciality: string; country: string; date: string }[], // max 3 rader via UI
    // BT (2021)
    btMode: "fristående", // "fristående" | "integrerad"
    btStartDate: "",
    locked: false,
  };

  const [orig, setOrig] = useState<Profile | any>(empty);
  const [form, setForm] = useState<any>(empty);
  const [tab, setTab] = useState<"person" | "st">("person");
  const [supervisorHasOtherSite, setSupervisorHasOtherSite] = useState(false);
  const [studyDirectorHasOtherSite, setStudyDirectorHasOtherSite] = useState(false);

  // Ladda profil när modalen öppnas
  useEffect(() => {
    if (!open) return;
    (async () => {
      const p = (await db.profile.get("default")) as any;
      const base = p ? { ...empty, ...p } : empty;
      setOrig(base);
      setForm(base);
      setSupervisorHasOtherSite(Boolean(base.supervisorWorkplace));
      setStudyDirectorHasOtherSite(Boolean(base.studyDirectorWorkplace));
    })();
  }, [open]); // eslint-disable-line

    // Dirty-detektering – direkt via form vs orig
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(orig),
    [form, orig]
  );




  // Sorterade specialiteter
  const specialtiesSorted = useMemo(
    () => [...SPECIALTIES].sort((a, b) => a.localeCompare(b, "sv")),
    []
  );

  // Stäng med varning om osparat
  const requestClose = useCallback(() => {
    if (dirty && !confirm("Du har osparade ändringar. Vill du stänga utan att spara?")) return;
    onClose();
  }, [dirty, onClose]);

  // ESC stäng
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  // Klick utanför för att stänga
  function onOverlay(e: React.MouseEvent) {
    if (e.target === overlayRef.current) requestClose();
  }

  async function handleSave() {
    // Basvalidering
    if (!form.name?.trim() || !form.specialty?.trim()) {
      alert("Fyll i minst Namn och Specialitet.");
      return;
    }
    if (!form.stStartDate) {
      alert("Fyll i startdatum för ST.");
      return;
    }

    const parts = (form.name ?? "").trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") ?? "";
    const toSave = { ...form, firstName, lastName, locked: true };

    await db.profile.put(toSave);
    setOrig(toSave);
    onClose(); // stäng efter spara

  }


  async function handleReset() {
    if (
      !confirm(
        "Detta raderar all lokal data (profil, placeringar, kurser, tidslinje m.m.). Har du sparat en JSON-export?"
      )
    ) {
      return;
    }

    // 1) Radera hela IndexedDB-databasen
    try {
      await db.delete();
    } catch {
      // ignorera ev. fel vid radering av DB
    }

    // 2) Töm all localStorage (inklusive tidslinje-drafts m.m.)
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {
      // ignorera ev. fel vid radering av localStorage
    }

    // 3) Ladda om till startsidan i helt rent läge
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }

    // --- UI-delar: använd JSX-block istället för inbäddade funktionskomponenter
  const personuppgifterView = (
    <div className="grid grid-cols-1 gap-3">
      <div>
        <Labeled>Namn</Labeled>
        <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      </div>
      <div>
        <Labeled>Personnummer</Labeled>
        <Input value={form.personalNumber} onChange={(v) => setForm({ ...form, personalNumber: v })} inputMode="numeric" />
      </div>
      <div>
        <Labeled>Utdelningsadress</Labeled>
        <Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Labeled>Postnummer</Labeled>
          <Input value={form.postalCode} onChange={(v) => setForm({ ...form, postalCode: v })} inputMode="numeric" />
        </div>
        <div className="col-span-2">
          <Labeled>Postort</Labeled>
          <Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        </div>
      </div>
      <div>
        <Labeled>E-postadress</Labeled>
        <Input value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Labeled>Mobiltelefon</Labeled>
          <Input value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} inputMode="tel" />
        </div>
        <div>
          <Labeled>Telefon (bostad)</Labeled>
          <Input value={form.phoneHome} onChange={(v) => setForm({ ...form, phoneHome: v })} inputMode="tel" />
        </div>
        <div>
          <Labeled>Telefon (arbete)</Labeled>
          <Input value={form.phoneWork} onChange={(v) => setForm({ ...form, phoneWork: v })} inputMode="tel" />
        </div>
      </div>

      {/* Lagringsinfo */}
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        <strong>Lagring:</strong> Allt sparas endast lokalt i din webbläsare. Ingen server används.
        För att flytta eller säkerhetskopiera: Exportera/Importera som JSON-fil.
      </p>
    </div>
  );

  const lockedCore = !!orig.locked;

  const stView = (
    <div className="grid grid-cols-1 gap-3">


      {/* Rad 1: Specialitet (vänster) + Målversion (höger) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Labeled>Specialitet</Labeled>
          <select
            value={form.specialty}
            onChange={(e) => {
              if (lockedCore) return;
              setForm({ ...form, specialty: (e.target as HTMLSelectElement).value });
            }}
            disabled={lockedCore}
            title={
              lockedCore
                ? "För att ändra specialitet krävs att du återställer allt längst ned. Detta raderar all lokal data."
                : undefined
            }
            className="h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <option value="">— Välj —</option>
            {specialtiesSorted.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

        </div>

        <div>
          <Labeled>Målversion</Labeled>
          <select
            value={form.goalsVersion}
            onChange={(e) => {
              if (lockedCore) return;
              const gv = (e.target as HTMLSelectElement).value as any;
              setForm({
                ...form,
                goalsVersion: gv,
                stTotalMonths: gv === "2021" ? 66 : 60,
              });
            }}
            disabled={lockedCore}
            title={
              lockedCore
                ? "För att ändra målversion krävs att du återställer allt längst ned. Detta raderar all lokal data."
                : undefined
            }
            className="h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <option value="2015">SOSFS 2015:8</option>
            <option value="2021">HSLF-FS 2021:8</option>
          </select>

        </div>
      </div>

      {/* Rad 2: BT-fält – endast 2021 */}
      {form.goalsVersion === "2021" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Labeled>Startdatum för BT</Labeled>
            <CalendarDatePicker
              value={form.btStartDate || ""}
              onChange={(v: string) => setForm({ ...form, btStartDate: v })}
            />
          </div>
          <div>
            <Labeled>BT-läge</Labeled>
            <select
              value={form.btMode}
              onChange={(e) =>
                setForm({ ...form, btMode: (e.target as HTMLSelectElement).value })
              }
              className="h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              <option value="fristående">Fristående</option>
              <option value="integrerad">Integrerad i ST</option>
            </select>
          </div>
        </div>
      )}

      {/* Rad 3: Startdatum ST + ST-längd */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Labeled>Startdatum för ST</Labeled>
          <CalendarDatePicker
            value={form.stStartDate || ""}
            onChange={(v: string) => setForm({ ...form, stStartDate: v })}
          />
        </div>

        <div>
          <Labeled>
            {form.goalsVersion === "2021"
              ? "ST-längd i månader (inklusive BT)"
              : "ST-längd i månader"}
          </Labeled>
          <select
            value={String(form.stTotalMonths ?? (form.goalsVersion === "2021" ? 66 : 60))}
            onChange={(e) =>
              setForm({
                ...form,
                stTotalMonths: Number((e.target as HTMLSelectElement).value),
              })
            }
            className="h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
            title="Planerad total tid i månader"
          >
            {Array.from({ length: 240 }, (_, i) => i + 1).map((m) => {
              const isSix = m % 6 === 0;
              const label = (() => {
                if (!isSix) return `${m}`;
                if (m % 12 === 0) return `${m} (${m / 12} år)`;
                return `${m} (${Math.floor(m / 12)},5 år)`;
              })();
              return (
                <option key={m} value={m}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>


      {/* Hemklinik */}
      <div>
        <Labeled>Hemklinik</Labeled>
        <Input value={form.homeClinic} onChange={(v) => setForm({ ...form, homeClinic: v })} />
      </div>

      {/* Huvudhandledare och Studierektor – bredvid varandra */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Labeled>Huvudhandledare</Labeled>
          <Input value={form.supervisor} onChange={(v) => setForm({ ...form, supervisor: v })} />
          <label className="mt-2 inline-flex items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              checked={supervisorHasOtherSite}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setSupervisorHasOtherSite(checked);
                if (!checked) {
                  setForm((prev: any) => ({ ...prev, supervisorWorkplace: "" }));
                }
              }}
            />
            Har annat tjänsteställe
          </label>
          {supervisorHasOtherSite && (
            <div className="mt-3">
              <Input value={form.supervisorWorkplace} onChange={(v) => setForm({ ...form, supervisorWorkplace: v })} placeholder="Tjänsteställe" />
            </div>
          )}
        </div>

        <div>
          <Labeled>Studierektor</Labeled>
          <Input value={form.studyDirector} onChange={(v) => setForm({ ...form, studyDirector: v })} />
          <label className="mt-2 inline-flex items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              checked={studyDirectorHasOtherSite}
              onChange={(e) => setStudyDirectorHasOtherSite(e.currentTarget.checked)}
            />
            Har annat tjänsteställe
          </label>
          {studyDirectorHasOtherSite && (
            <div className="mt-3">
              <Input value={form.studyDirectorWorkplace} onChange={(v) => setForm({ ...form, studyDirectorWorkplace: v })} placeholder="Tjänsteställe" />
            </div>
          )}
        </div>
      </div>

      {/* Chef + Verksamhetschef */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Labeled>Chef</Labeled>
          <Input value={form.manager} onChange={(v) => setForm({ ...form, manager: v })} />
        </div>
        <div>
          <Labeled>Verksamhetschef</Labeled>
          <Input value={form.verksamhetschef} onChange={(v) => setForm({ ...form, verksamhetschef: v })} />
        </div>
      </div>

      {/* Land + datum läkarexamen */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Labeled>Land för läkarexamen</Labeled>
          <Input value={form.medDegreeCountry} onChange={(v) => setForm({ ...form, medDegreeCountry: v })} />
        </div>
        <div>
          <Labeled>Datum för läkarexamen</Labeled>
          <CalendarDatePicker value={form.medDegreeDate || ""} onChange={(v: string) => setForm({ ...form, medDegreeDate: v })} />
        </div>
      </div>

      {/* Land + Datum för legitimation (precis under läkarexamen) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Labeled>Land för legitimation</Labeled>
          <Input value={form.licenseCountry} onChange={(v) => setForm({ ...form, licenseCountry: v })} />
        </div>
        <div>
          <Labeled>Datum för legitimation</Labeled>
          <CalendarDatePicker value={form.licenseDate || ""} onChange={(v: string) => setForm({ ...form, licenseDate: v })} />
        </div>
      </div>


      {/* ====== Längst ned: Legitimation i annat land ====== */}
      <div className="rounded-lg border border-slate-200 p-3">
        <label className="inline-flex items-center gap-2 text-[13px] select-none">
          <input
            type="checkbox"
            checked={!!form.hasForeignLicense}
            onChange={(e) => {
              const on = e.currentTarget.checked;
              setForm({
                ...form,
                hasForeignLicense: on,
                foreignLicenses: on ? (form.foreignLicenses && form.foreignLicenses.length ? form.foreignLicenses.slice(0, 3) : [{ country: "", date: "" }]) : [],
              });
            }}
          />
          <span className="font">Har legitimation från annat land</span>
        </label>

        {form.hasForeignLicense && (
          <div className="mt-2 space-y-2">
            {(form.foreignLicenses || []).slice(0, 2).map((row: { country: string; date: string }, idx: number) => (

              <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px]">
                <div>
                  <Labeled>Land</Labeled>
                  <Input
                    value={row?.country || ""}
                    onChange={(v) => {
                      const next = [...(form.foreignLicenses || [])];
                      next[idx] = { ...(row || { country: "", date: "" }), country: v };
                      setForm({ ...form, foreignLicenses: next });
                    }}
                  />
                </div>

                {/* Datumkolumn med ev. minusknapp innanför samma 220px-bredd */}
                <div className={idx === 0 ? "self-end w-[220px]" : "self-end w-[220px] grid grid-cols-[1fr_40px] items-end gap-2"}>
                  <div>
                    <Labeled>Datum</Labeled>
                    <CalendarDatePicker
                      value={row?.date || ""}
                      onChange={(v: string) => {
                        const next = [...(form.foreignLicenses || [])];
                        next[idx] = { ...(row || { country: "", date: "" }), date: v };
                        setForm({ ...form, foreignLicenses: next });
                      }}
                    />
                  </div>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = (form.foreignLicenses || []).filter((_: any, i: number) => i !== idx);
                        setForm({ ...form, foreignLicenses: next });
                      }}
                      className="h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
                      title="Ta bort"
                    >
                      –
                    </button>
                  )}
                </div>
              </div>
            ))}


            {(form.foreignLicenses || []).length < 2 && (
              <button
                type="button"
                onClick={() => {
                  const next = [...(form.foreignLicenses || [])];
                  if (next.length >= 2) return;
                  next.push({ country: "", date: "" });
                  setForm({ ...form, foreignLicenses: next });
                }}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                + Lägg till land
              </button>
            )}

          </div>
        )}
      </div>

      {/* ====== Längst ned: Bevis om specialistkompetens sedan tidigare ====== */}
      <div className="rounded-lg border border-slate-200 p-3">
        <label className="inline-flex items-center gap-2 text-[13px] select-none">
          <input
            type="checkbox"
            checked={!!form.hasPriorSpecialist}
            onChange={(e) => {
              const on = e.currentTarget.checked;
              setForm({
                ...form,
                hasPriorSpecialist: on,
                priorSpecialties: on
                  ? ((form.priorSpecialties && form.priorSpecialties.length) ? form.priorSpecialties.slice(0, 3) : [{ speciality: "", country: "", date: "" }])
                  : [],
              });
            }}
          />
          <span className="font">Har sedan tidigare bevis om specialistkompetens</span>
        </label>

        {form.hasPriorSpecialist && (
          <div className="mt-2 space-y-2">
            {(form.priorSpecialties || []).slice(0, 3).map((row: { speciality: string; country: string; date: string }, idx: number) => (
              <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_220px]">
                <div>
                  <Labeled>Specialitet</Labeled>
                  <Input
                    value={row?.speciality || ""}
                    onChange={(v) => {
                      const next = [...(form.priorSpecialties || [])];
                      next[idx] = { ...(row || { speciality: "", country: "", date: "" }), speciality: v };
                      setForm({ ...form, priorSpecialties: next });
                    }}
                  />
                </div>
                <div>
                  <Labeled>Land</Labeled>
                  <Input
                    value={row?.country || ""}
                    onChange={(v) => {
                      const next = [...(form.priorSpecialties || [])];
                      next[idx] = { ...(row || { speciality: "", country: "", date: "" }), country: v };
                      setForm({ ...form, priorSpecialties: next });
                    }}
                  />
                </div>

                {/* Datumkolumn med ev. minusknapp innanför samma 220px-bredd */}
                <div className={idx === 0 ? "self-end w-[220px]" : "self-end w-[220px] grid grid-cols-[1fr_40px] items-end gap-2"}>
                  <div>
                    <Labeled>Datum</Labeled>
                    <CalendarDatePicker
                      value={row?.date || ""}
                      onChange={(v: string) => {
                        const next = [...(form.priorSpecialties || [])];
                        next[idx] = { ...(row || { speciality: "", country: "", date: "" }), date: v };
                        setForm({ ...form, priorSpecialties: next });
                      }}
                    />
                  </div>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = (form.priorSpecialties || []).filter((_: any, i: number) => i !== idx);
                        setForm({ ...form, priorSpecialties: next });
                      }}
                      className="h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
                      title="Ta bort"
                    >
                      –
                    </button>
                  )}
                </div>
              </div>
            ))}


            {(form.priorSpecialties || []).length < 3 && (
              <button
                type="button"
                onClick={() => {
                  const next = [...(form.priorSpecialties || [])];
                  next.push({ speciality: "", country: "", date: "" });
                  setForm({ ...form, priorSpecialties: next });
                }}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                + Lägg till specialitet
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );



  if (!open) return null;

  return (
    <div ref={overlayRef} onMouseDown={onOverlay} className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4">
      <div onMouseDown={(e) => e.stopPropagation()} className="relative w-full max-w-[960px] rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-lg font-extrabold">Profil</h2>
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
              onClick={requestClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              title="Stäng – varnar om osparade ändringar"
            >
              Stäng
            </button>
          </div>
        </header>

        {/* Tabs */}
        <nav className="flex gap-1 border-b bg-slate-50 px-2 pt-2">
          {[
            { id: "person", label: "Personuppgifter" },
            { id: "st", label: "Uppgifter om ST" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as "person" | "st")}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                tab === (t.id as "person" | "st")
                  ? "bg-white text-slate-900 border-x border-t border-slate-200 -mb-px"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>


        {/* Innehåll */}
        <div className="max-h-[75dvh] overflow-auto p-5">
          {tab === "person" ? personuppgifterView : stView}

        </div>

        {/* Footer med Återställ */}
        <div className="flex justify-end border-t border-slate-200 px-5 py-3">
          <button
            onClick={handleReset}
            className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100"
          >
            Återställ allt
          </button>
        </div>
      </div>
    </div>
  );
}
