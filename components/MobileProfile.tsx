// components/MobileProfile.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { Profile } from "@/lib/types";
import CalendarDatePicker from "@/components/CalendarDatePicker";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Platt specialitetslista (sorteras i UI) */
const SPECIALTIES: string[] = [
  "Akutsjukvård", "Allergologi", "Allmänmedicin", "Anestesi och intensivvård", "Arbets- och miljömedicin", "Arbetsmedicin",
  "Barn- och ungdomsallergologi", "Barn- och ungdomshematologi och onkologi", "Barn- och ungdoms-kardiologi",
  "Barn- och ungdomskirurgi", "Barn- och ungdomsmedicin", "Barn- och ungdomsneurologi med habilitering",
  "Barn- och ungdomspsykiatri", "Endokrinologi och diabetologi", "Geriatrik", "Gynekologisk onkologi", "Handkirurgi",
  "Hematologi", "Hud- och könssjukdomar", "Hörsel- och balansrubbningar", "Infektionssjukdomar", "Internmedicin",
  "Kardiologi", "Kärlkirurgi", "Klinisk farmakologi", "Klinisk fysiologi", "Klinisk genetik",
  "Klinisk immunologi och transfusionsmedicin", "Klinisk kemi", "Klinisk mikrobiologi", "Klinisk neurofysiologi",
  "Klinisk patologi", "Kirurgi", "Lungsjukdomar", "Medicinsk gastroenterologi och hepatologi", "Neonatologi",
  "Neurokirurgi", "Neurologi", "Neuroradiologi", "Njurmedicin", "Nuklearmedicin", "Obstetrik och gynekologi", "Onkologi",
  "Ortopedi", "Palliativ medicin", "Plastikkirurgi", "Psykiatri", "Radiologi", "Rehabiliteringsmedicin", "Reumatologi",
  "Rättsmedicin", "Rättspsykiatri", "Röst- och talrubbningar", "Skolhälsovård (medicinska insatser i elevhälsan)",
  "Smärtlindring", "Socialmedicin", "Thoraxkirurgi", "Urologi", "Vårdhygien", "Äldrepsykiatri", "Ögonsjukdomar",
  "Öron-, näs- och halssjukdomar",
];

/** Fokus-säker textinput */
function Input({
  value,
  onChange,
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
  const [local, setLocal] = useState<string>(String(value ?? ""));

  useEffect(() => {
    const next = String(value ?? "");
    if (next !== local) setLocal(next);
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
        commit(v);
      }}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete="off"
      spellCheck={false}
      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
    />
  );
}

function Labeled({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-900">{children}</label>;
}

function Select({
  value,
  onChange,
  children,
  disabled,
  className = "",
}: {
  value: any;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 ${className}`}
    >
      {children}
    </select>
  );
}

export default function MobileProfile({ open, onClose }: Props) {
  const empty: any = {
    id: "default",
    name: "", personalNumber: "", address: "", postalCode: "", city: "", email: "",
    mobile: "", phoneHome: "", phoneWork: "",
    homeClinic: "",
    supervisor: "", supervisorWorkplace: "",
    studyDirector: "", studyDirectorWorkplace: "",
    manager: "", verksamhetschef: "",
    specialty: "", goalsVersion: "2021", stStartDate: "",
    stTotalMonths: 66,
    medDegreeCountry: "", medDegreeDate: "",
    licenseCountry: "", licenseDate: "",
    hasForeignLicense: false,
    foreignLicenses: [] as { country: string; date: string }[],
    hasPriorSpecialist: false,
    priorSpecialties: [] as { speciality: string; country: string; date: string }[],
    btStartDate: "",
    locked: false,
  };

  const [orig, setOrig] = useState<Profile | any>(empty);
  const [form, setForm] = useState<any>(empty);
  const [tab, setTab] = useState<"person" | "st">("person");
  const [supervisorHasOtherSite, setSupervisorHasOtherSite] = useState(false);
  const [studyDirectorHasOtherSite, setStudyDirectorHasOtherSite] = useState(false);
  const [saving, setSaving] = useState(false);
  const lockedCore = !!orig.locked;

  const specialtiesSorted = useMemo(
    () => [...SPECIALTIES].sort((a, b) => a.localeCompare(b, "sv")),
    []
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(orig),
    [form, orig]
  );

  // ESC stänger
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dirty && !confirm("Du har osparade ändringar. Vill du stänga utan att spara?")) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dirty, onClose]);

  async function handleSave() {
    if (!form.name?.trim() || !form.specialty?.trim()) {
      alert("Fyll i minst Namn och Specialitet.");
      return;
    }
    if (form.goalsVersion === "2021") {
      if (!form.btStartDate) {
        alert("Fyll i startdatum för BT/ST.");
        return;
      }
    } else {
      if (!form.stStartDate) {
        alert("Fyll i startdatum för ST.");
        return;
      }
    }

    setSaving(true);
    try {
      const parts = (form.name ?? "").trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ") ?? "";
      const toSave = { ...form, firstName, lastName, locked: true };

      await db.profile.put(toSave);
      setOrig(toSave);
      onClose();
    } catch (e) {
      console.error("Kunde inte spara profil:", e);
      alert("Kunde inte spara profil.");
    } finally {
      setSaving(false);
    }
  }

  function requestClose() {
    if (dirty && !confirm("Du har osparade ändringar. Vill du stänga utan att spara?")) return;
    onClose();
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-5 py-4">
          <h1 className="text-xl font-extrabold text-sky-900">Profil</h1>
          <button
            onClick={requestClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px shrink-0"
          >
            ✕
          </button>
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
            className={`rounded-t-lg px-3 py-2 text-xs font-semibold focus:outline-none ${
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
        <main className="flex-1 overflow-y-auto px-5 py-5">
        {tab === "person" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Labeled>Namn</Labeled>
              <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            </div>
            <div className="space-y-2">
              <Labeled>Personnummer</Labeled>
              <Input value={form.personalNumber} onChange={(v) => setForm({ ...form, personalNumber: v })} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Labeled>Utdelningsadress</Labeled>
              <Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Labeled>Postnummer</Labeled>
                <Input value={form.postalCode} onChange={(v) => setForm({ ...form, postalCode: v })} inputMode="numeric" />
              </div>
              <div className="col-span-2 space-y-2">
                <Labeled>Postort</Labeled>
                <Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              </div>
            </div>
            <div className="space-y-2">
              <Labeled>E-postadress</Labeled>
              <Input value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            </div>
            <div className="space-y-2">
              <Labeled>Mobiltelefon</Labeled>
              <Input value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} inputMode="tel" />
            </div>
            <div className="space-y-2">
              <Labeled>Telefon (bostad)</Labeled>
              <Input value={form.phoneHome} onChange={(v) => setForm({ ...form, phoneHome: v })} inputMode="tel" />
            </div>
            <div className="space-y-2">
              <Labeled>Telefon (arbete)</Labeled>
              <Input value={form.phoneWork} onChange={(v) => setForm({ ...form, phoneWork: v })} inputMode="tel" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              <strong>Lagring:</strong> Allt sparas endast lokalt i din webbläsare. Ingen server används.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Specialitet + Målversion - LÅSTA */}
            <div className="space-y-2">
              <Labeled>Specialitet</Labeled>
              <Select
                value={form.specialty}
                onChange={(v) => setForm({ ...form, specialty: v })}
                disabled={lockedCore}
                className={lockedCore ? "bg-slate-100 cursor-not-allowed" : ""}
              >
                <option value="">— Välj —</option>
                {specialtiesSorted.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Labeled>Målversion</Labeled>
              <Select
                value={form.goalsVersion}
                onChange={(v) => {
                  const gv = v as any;
                  setForm({
                    ...form,
                    goalsVersion: gv,
                    stTotalMonths: gv === "2021" ? 66 : 60,
                  });
                }}
                disabled={lockedCore}
                className={lockedCore ? "bg-slate-100 cursor-not-allowed" : ""}
              >
                <option value="2015">SOSFS 2015:8</option>
                <option value="2021">HSLF-FS 2021:8</option>
              </Select>
            </div>

            {/* BT/ST-startdatum + ST-längd (endast 2021) */}
            {form.goalsVersion === "2021" && (
              <>
                <div className="space-y-2">
                  <Labeled>Startdatum för BT/ST</Labeled>
                  <CalendarDatePicker
                    value={form.btStartDate || ""}
                    onChange={(v: string) => setForm({ ...form, btStartDate: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Labeled>ST-längd i månader (inklusive BT)</Labeled>
                  <Select
                    value={String(form.stTotalMonths ?? 66)}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        stTotalMonths: Number(v),
                      })
                    }
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
                  </Select>
                </div>
              </>
            )}

            {/* Startdatum ST (endast 2015) */}
            {form.goalsVersion === "2015" && (
              <>
                <div className="space-y-2">
                  <Labeled>Startdatum för ST</Labeled>
                  <CalendarDatePicker
                    value={form.stStartDate || ""}
                    onChange={(v: string) => setForm({ ...form, stStartDate: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Labeled>ST-längd i månader</Labeled>
                  <Select
                    value={String(form.stTotalMonths ?? 60)}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        stTotalMonths: Number(v),
                      })
                    }
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
                  </Select>
                </div>
              </>
            )}

            {/* Hemklinik */}
            <div className="space-y-2">
              <Labeled>Hemklinik</Labeled>
              <Input value={form.homeClinic} onChange={(v) => setForm({ ...form, homeClinic: v })} />
            </div>

            {/* Huvudhandledare */}
            <div className="space-y-2">
              <Labeled>Huvudhandledare</Labeled>
              <Input value={form.supervisor} onChange={(v) => setForm({ ...form, supervisor: v })} />
              <label className="mt-2 inline-flex items-center gap-2 text-xs select-none text-slate-900">
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
                <span className="text-slate-900">Har annat tjänsteställe</span>
              </label>
              {supervisorHasOtherSite && (
                <div className="mt-2">
                  <Input value={form.supervisorWorkplace} onChange={(v) => setForm({ ...form, supervisorWorkplace: v })} placeholder="Tjänsteställe" />
                </div>
              )}
            </div>

            {/* Studierektor */}
            <div className="space-y-2">
              <Labeled>Studierektor</Labeled>
              <Input value={form.studyDirector} onChange={(v) => setForm({ ...form, studyDirector: v })} />
              <label className="mt-2 inline-flex items-center gap-2 text-xs select-none text-slate-900">
                <input
                  type="checkbox"
                  checked={studyDirectorHasOtherSite}
                  onChange={(e) => setStudyDirectorHasOtherSite(e.currentTarget.checked)}
                />
                <span className="text-slate-900">Har annat tjänsteställe</span>
              </label>
              {studyDirectorHasOtherSite && (
                <div className="mt-2">
                  <Input value={form.studyDirectorWorkplace} onChange={(v) => setForm({ ...form, studyDirectorWorkplace: v })} placeholder="Tjänsteställe" />
                </div>
              )}
            </div>

            {/* Chef + Verksamhetschef */}
            <div className="space-y-2">
              <Labeled>Chef</Labeled>
              <Input value={form.manager} onChange={(v) => setForm({ ...form, manager: v })} />
            </div>
            <div className="space-y-2">
              <Labeled>Verksamhetschef</Labeled>
              <Input value={form.verksamhetschef} onChange={(v) => setForm({ ...form, verksamhetschef: v })} />
            </div>

            {/* Land + Datum för läkarexamen */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Labeled>Land för läkarexamen</Labeled>
                <Input value={form.medDegreeCountry} onChange={(v) => setForm({ ...form, medDegreeCountry: v })} />
              </div>
              <div>
                <Labeled>Datum för läkarexamen</Labeled>
                <CalendarDatePicker value={form.medDegreeDate || ""} onChange={(v: string) => setForm({ ...form, medDegreeDate: v })} />
              </div>
            </div>

            {/* Land + Datum för legitimation */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Labeled>Land för legitimation</Labeled>
                <Input value={form.licenseCountry} onChange={(v) => setForm({ ...form, licenseCountry: v })} />
              </div>
              <div>
                <Labeled>Datum för legitimation</Labeled>
                <CalendarDatePicker value={form.licenseDate || ""} onChange={(v: string) => setForm({ ...form, licenseDate: v })} />
              </div>
            </div>

            {/* Legitimation i annat land */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="inline-flex items-center gap-2 text-xs select-none text-slate-900">
                <input
                  type="checkbox"
                  checked={!!form.hasForeignLicense}
                  onChange={(e) => {
                    const on = e.currentTarget.checked;
                    setForm({
                      ...form,
                      hasForeignLicense: on,
                      foreignLicenses: on
                        ? ((form.foreignLicenses && form.foreignLicenses.length) ? form.foreignLicenses.slice(0, 2) : [{ country: "", date: "" }])
                        : [],
                    });
                  }}
                />
                <span className="font-medium text-slate-900">Har legitimation från annat land</span>
              </label>

              {form.hasForeignLicense && (
                <div className="mt-2 space-y-2">
                  {(form.foreignLicenses || []).slice(0, 2).map((row: { country: string; date: string }, idx: number) => (
                    <div key={idx} className="grid grid-cols-1 gap-2">
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
                      className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      + Lägg till land
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bevis om specialistkompetens sedan tidigare */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="inline-flex items-center gap-2 text-xs select-none">
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
                <span className="font-medium text-slate-900">Har sedan tidigare bevis om specialistkompetens</span>
              </label>

              {form.hasPriorSpecialist && (
                <div className="mt-2 space-y-2">
                  {(form.priorSpecialties || []).slice(0, 3).map((row: { speciality: string; country: string; date: string }, idx: number) => (
                    <div key={idx} className="grid grid-cols-1 gap-2">
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
                      className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      + Lägg till specialitet
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Återställ allt */}
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-red-900">Återställ allt</h3>
              <p className="mb-3 text-xs text-red-700">
                Detta raderar all lokal data (profil, placeringar, kurser, tidslinje m.m.). Se till att du har sparat en JSON-export innan du fortsätter.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 active:translate-y-px"
              >
                Återställ allt
              </button>
            </div>
          </div>
        )}
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={handleSave}
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Sparar..." : "Spara"}
          </button>
        </footer>
      </div>
    </div>
  );
}

