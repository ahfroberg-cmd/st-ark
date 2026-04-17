// ============================ app/profile/page.tsx ============================
"use client";

import { Suspense, useEffect, useMemo, useState, useCallback, useRef } from "react";

// ============================ Imports ============================
import { useRouter, useSearchParams } from "next/navigation";
import type { Profile } from "@/lib/types";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import { logAudit } from "@/lib/audit";
import { getSessionUser, supabase } from "@/lib/supabase";
import {
  fetchFirstClinicMembershipWithClinicForUser,
  fetchProfileForEditor,
  fetchProfileNameById,
  fetchSupervisorIdForStAtClinic,
  listClinicMembershipsByClinicId,
  listProfilesByIds,
  upsertProfilePayload,
} from "@/lib/repositories/starkRepository";
import LogoutConfirmDialog from "@/components/LogoutConfirmDialog";

/** Platt lista över specialiteter – sorteras i UI med svensk locale */
const SPECIALTIES: string[] = [
  "Akutsjukvård",
  "Allergologi",
  "Allmänmedicin",
  "Anestesi och intensivvård",
  "Arbets- och miljömedicin",
  "Arbetsmedicin",
  "Barn- och ungdomsallergologi",
  "Barn- och ungdomshematologi och onkologi",
  "Barn- och ungdoms-kardiologi",
  "Barn- och ungdomskirurgi",
  "Barn- och ungdomsmedicin",
  "Barn- och ungdomsneurologi med habilitering",
  "Barn- och ungdomspsykiatri",
  "Endokrinologi och diabetologi",
  "Geriatrik",
  "Gynekologisk onkologi",
  "Handkirurgi",
  "Hematologi",
  "Hud- och könssjukdomar",
  "Hörsel- och balansrubbningar",
  "Infektionssjukdomar",
  "Internmedicin",
  "Kardiologi",
  "Kärlkirurgi",
  "Klinisk farmakologi",
  "Klinisk fysiologi",
  "Klinisk genetik",
  "Klinisk immunologi och transfusionsmedicin",
  "Klinisk kemi",
  "Klinisk mikrobiologi",
  "Klinisk neurofysiologi",
  "Klinisk patologi",
  "Kirurgi",
  "Lungsjukdomar",
  "Medicinsk gastroenterologi och hepatologi",
  "Neonatologi",
  "Neurokirurgi",
  "Neurologi",
  "Neuroradiologi",
  "Njurmedicin",
  "Nuklearmedicin",
  "Obstetrik och gynekologi",
  "Onkologi",
  "Ortopedi",
  "Palliativ medicin",
  "Plastikkirurgi",
  "Psykiatri",
  "Radiologi",
  "Rehabiliteringsmedicin",
  "Reumatologi",
  "Rättsmedicin",
  "Rättspsykiatri",
  "Röst- och talrubbningar",
  "Skolhälsovård (medicinska insatser i elevhälsan)",
  "Smärtlindring",
  "Socialmedicin",
  "Thoraxkirurgi",
  "Urologi",
  "Vårdhygien",
  "Äldrepsykiatri",
  "Ögonsjukdomar",
  "Öron-, näs- och halssjukdomar",
];

function Labeled({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm text-slate-700">{children}</label>;
}

function ReadonlyInput({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Labeled>{label}</Labeled>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}

/** Fokus-säker textinput (buffrar lokalt, commit direkt vid input) */
function Input({
  value,
  onChange, // commit direkt (på input)
  type = "text",
  placeholder,
  inputMode,
  disabled = false,
}: {
  value: any;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  disabled?: boolean;
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
        if (disabled) return;
        const v = (e.target as HTMLInputElement).value;
        setLocal(v);
        commit(v); // uppdatera form direkt -> dirty tänds direkt
      }}
      readOnly={disabled}
      disabled={disabled}
      inputMode={inputMode}
      autoComplete="off"
      spellCheck={false}
      className={`h-[40px] w-full rounded-xl border px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 ${
        disabled
          ? "border-slate-200 bg-slate-100 text-slate-600"
          : "border-slate-300 bg-white"
      }`}
    />
  );
}

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const isSetupMode = searchParams.get("setup") === "1";

  const [, setProfile] = useState<Profile | null>(null);
  const resetAttemptedRef = useRef(false);
  const profileHydratedRef = useRef(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [form, setForm] = useState<any>({
    id: "default",
    // Personuppgifter
    name: "",
    personalNumber: "",
    address: "",
    postalCode: "",
    city: "",
    email: "",
    mobile: "",
    phoneHome: "",
    phoneWork: "",
    // ST
    homeClinic: "",
    supervisor: "",
    supervisorWorkplace: "",
    studyDirector: "",
    studyDirectorWorkplace: "",
    manager: "",
    verksamhetschef: "",
    specialty: "",
    goalsVersion: "2021",
    stStartDate: "",
    stTotalMonths: 66,

    medDegreeCountry: "",
    medDegreeDate: "",
    // Nytt: legitimation (land + datum)
    licenseCountry: "",
    licenseDate: "",
    // Flyttade centrala datapunkter (samma som i ProfileModal)

    hasForeignLicense: false,
    foreignLicenses: [] as { country: string; date: string }[],
    hasPriorSpecialist: false,
    priorSpecialties: [] as { speciality: string; country: string; date: string }[],
    isThirdCountrySpecialist: false,
    // BT (2021)
    btMode: "fristående", // "fristående" | "integrerad"
    btStartDate: "",

    locked: false,
  });

  const [supervisorHasOtherSite, setSupervisorHasOtherSite] = useState(false);
  const [studyDirectorHasOtherSite, setStudyDirectorHasOtherSite] = useState(false);

  const [profileTab, setProfileTab] = useState<"profil" | "klinik" | "hemklinik">("profil");
  const [userRole, setUserRole] = useState<string>("st_lakare");
  const [clinicData, setClinicData] = useState<{
    clinicName: string;
    members: { user_id: string; role: string; name: string }[];
    stChief?: string;
    verksamhetschef?: string;
    orgHome?: string;
    assignedSupervisorName?: string;
    studyDirectorNames?: string[];
  } | null>(null);
  const [clinicLoading, setClinicLoading] = useState(false);

  // Ladda hemklinik-data
  useEffect(() => {
    if (!["hemklinik", "klinik"].includes(profileTab) || clinicData) return;
    let cancelled = false;
    (async () => {
      setClinicLoading(true);
      try {
        const user = await getSessionUser();
        if (!user?.id || cancelled) return;

        // Hämta klinik-membership för denna användare
        const { data: myMembership } = await fetchFirstClinicMembershipWithClinicForUser(user.id);

        if (!myMembership || cancelled) {
          setClinicData({ clinicName: '', members: [] });
          return;
        }

        const clinicRow = (myMembership as any).clinics || {};
        const clinicName = clinicRow?.name || '';

        // Hämta alla medlemmar i kliniken
        const { data: memberRows } = await listClinicMembershipsByClinicId(String(myMembership.clinic_id));

        if (!memberRows || cancelled) {
          setClinicData({ clinicName, members: [] });
          return;
        }

        const userIds = Array.from(new Set(memberRows.map(r => r.user_id)));
        const { data: profiles } = await listProfilesByIds(userIds as string[], "id,name");

        const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.name || 'Okänd']));
        const studyDirectorNames = (memberRows || [])
          .filter((r: any) => String(r.role || '') === 'studierektor')
          .map((r: any) => String(nameMap.get(r.user_id) || 'Okänd'))
          .filter(Boolean);

        let assignedSupervisorName = '';
        const { data: assignment } = await fetchSupervisorIdForStAtClinic(
          user.id,
          String(myMembership.clinic_id)
        );
        const assignedSupervisorId = String((assignment as any)?.supervisor_id || '');
        if (assignedSupervisorId) {
          assignedSupervisorName = String(nameMap.get(assignedSupervisorId) || '');
          if (!assignedSupervisorName) {
            const { data: supProf } = await fetchProfileNameById(assignedSupervisorId);
            assignedSupervisorName = String((supProf as any)?.name || '');
          }
        }

        if (!cancelled) {
          setClinicData({
            clinicName,
            stChief: String(clinicRow?.st_chief || ''),
            verksamhetschef: String(clinicRow?.verksamhetschef || ''),
            orgHome: String(clinicRow?.org_home || clinicName || ''),
            assignedSupervisorName,
            studyDirectorNames,
            members: memberRows.map((r) => ({
              user_id: String(r.user_id),
              role: String(r.role),
              name: String(nameMap.get(r.user_id) ?? "Okänd"),
            })),
          });
        }
      } catch (err) {
        console.error('Failed to load clinic data:', err);
        if (!cancelled) setClinicData({ clinicName: '', members: [] });
      } finally {
        if (!cancelled) setClinicLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profileTab, clinicData]);

  useEffect(() => {
    (async () => {
      try {
        const authUserData = await getSessionUser();
        setAuthUser(authUserData ?? null);
        setAuthReady(true);

        if (!authUserData) {
          router.replace("/auth");
          return;
        }

        if (authUserData) {
          const { data: remoteProfile, error: remoteError } = await fetchProfileForEditor(authUserData.id);

          if (remoteError) {
            console.error("Error loading Supabase profile:", remoteError);
          } else if (remoteProfile) {
            const d = remoteProfile as any;
            const mappedRemoteProfile = {
              id: "default",
              name: d.name || "",
              specialty: d.specialty || "",
              goalsVersion: d.goals_version || "2021",
              btStartDate: d.bt_start_date || "",
              btEndDate: d.bt_end_date || "",
              stStartDate: d.st_start_date || "",
              homeClinic: d.home_clinic || "",
              personalNumber: d.personal_number || "",
              address: d.address || "",
              postalCode: d.postal_code || "",
              city: d.city || "",
              email: d.email || "",
              mobile: d.mobile || "",
              phoneHome: d.phone_home || "",
              phoneWork: d.phone_work || "",
              supervisor: d.supervisor || "",
              supervisorWorkplace: d.supervisor_workplace || "",
              studyDirector: d.study_director || "",
              studyDirectorWorkplace: d.study_director_workplace || "",
              manager: d.manager || "",
              verksamhetschef: d.verksamhetschef || "",
              stTotalMonths: d.st_total_months ?? 66,
              medDegreeCountry: d.med_degree_country || "",
              medDegreeDate: d.med_degree_date || "",
              licenseCountry: d.license_country || "",
              licenseDate: d.license_date || "",
              hasForeignLicense: d.has_foreign_license ?? false,
              foreignLicenses: d.foreign_licenses || [],
              hasPriorSpecialist: d.has_prior_specialist ?? false,
              priorSpecialties: d.prior_specialties || [],
              isThirdCountrySpecialist: d.is_third_country_specialist ?? false,
              btMode: d.bt_mode || "fristående",
              locked: d.locked ?? false,
            };
            setUserRole(String(d.role || "st_lakare"));
            setProfile((prev: any) => ({ ...(prev || {}), ...mappedRemoteProfile }));
            setForm((prev: any) => ({ ...prev, ...mappedRemoteProfile }));
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        profileHydratedRef.current = true;
      }
    })();
  }, [isSetupMode, router]);

  useEffect(() => {
    if (!authReady) return;
    if (!profileHydratedRef.current) return;
    const timer = window.setTimeout(async () => {
      let userId = authUser?.id;
      if (!userId) {
        const sessionUser = await getSessionUser();
        userId = sessionUser?.id ?? null;
        if (sessionUser) setAuthUser(sessionUser);
      }
      if (!userId) return;
      const payload = {
        id: userId,
        name: form.name || "",
        specialty: form.specialty || "",
        goals_version: form.goalsVersion || "2021",
        bt_start_date: form.btStartDate || null,
        bt_end_date: form.btEndDate || null,
        st_start_date: form.stStartDate || null,
        home_clinic: form.homeClinic || null,
        personal_number: form.personalNumber || "",
        address: form.address || "",
        postal_code: form.postalCode || "",
        city: form.city || "",
        email: form.email || "",
        mobile: form.mobile || "",
        phone_home: form.phoneHome || "",
        phone_work: form.phoneWork || "",
        supervisor: form.supervisor || "",
        supervisor_workplace: form.supervisorWorkplace || "",
        study_director: form.studyDirector || "",
        study_director_workplace: form.studyDirectorWorkplace || "",
        manager: form.manager || "",
        verksamhetschef: form.verksamhetschef || "",
        st_total_months: form.stTotalMonths ?? 66,
        med_degree_country: form.medDegreeCountry || "",
        med_degree_date: form.medDegreeDate || "",
        license_country: form.licenseCountry || "",
        license_date: form.licenseDate || "",
        has_foreign_license: form.hasForeignLicense ?? false,
        foreign_licenses: form.foreignLicenses || [],
        has_prior_specialist: form.hasPriorSpecialist ?? false,
        prior_specialties: form.priorSpecialties || [],
        is_third_country_specialist: form.isThirdCountrySpecialist ?? false,
        bt_mode: form.btMode || "fristående",
        locked: form.locked ?? false,
        updated_at: new Date().toISOString(),
      };
      const { error } = await upsertProfilePayload(payload);
      if (error) {
        console.error("[profile-autosave] failed:", error);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [form, authReady, authUser]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // (Input och Labeled definieras på toppnivå, utanför komponenten)

  const specialtiesSorted = useMemo(
    () => [...SPECIALTIES].sort((a, b) => a.localeCompare(b, "sv")),
    []
  );

  async function saveProfile() {
    console.log("[saveProfile] Startar sparning...");
    try {
      // Validering
      if (!form.name.trim() || !form.specialty.trim()) {
        console.log("[saveProfile] Validering misslyckades: namn eller specialitet saknas");
        alert("Fyll i minst Namn och Specialitet.");
        return;
      }
      // Validering beroende på målversion
      if (form.goalsVersion === "2021") {
        if (!form.btStartDate) {
          console.log("[saveProfile] Validering misslyckades: btStartDate saknas");
          alert("Fyll i startdatum för BT/ST.");
          return;
        }
      } else {
        // 2015: kräver stStartDate
        if (!form.stStartDate) {
          console.log("[saveProfile] Validering misslyckades: stStartDate saknas");
          alert("Fyll i startdatum för ST.");
          return;
        }
      }

      console.log("[saveProfile] Validering OK, sparar till Supabase...");
      const parts = (form.name ?? "").trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ") ?? "";
      const newProfile = { ...form, firstName, lastName, locked: true } as any;

      let userId = authUser?.id;
      if (!userId) {
        const sessionUser = await getSessionUser();
        userId = sessionUser?.id ?? null;
        if (sessionUser) setAuthUser(sessionUser);
      }
      if (!userId) {
        router.replace("/auth");
        return;
      }

      const payload = {
        id: userId,
        name: newProfile.name || "",
        specialty: newProfile.specialty || "",
        goals_version: newProfile.goalsVersion || "2021",
        bt_start_date: newProfile.btStartDate || null,
        bt_end_date: newProfile.btEndDate || null,
        st_start_date: newProfile.stStartDate || null,
        home_clinic: newProfile.homeClinic || null,
        personal_number: newProfile.personalNumber || "",
        address: newProfile.address || "",
        postal_code: newProfile.postalCode || "",
        city: newProfile.city || "",
        email: newProfile.email || "",
        mobile: newProfile.mobile || "",
        phone_home: newProfile.phoneHome || "",
        phone_work: newProfile.phoneWork || "",
        supervisor: newProfile.supervisor || "",
        supervisor_workplace: newProfile.supervisorWorkplace || "",
        study_director: newProfile.studyDirector || "",
        study_director_workplace: newProfile.studyDirectorWorkplace || "",
        manager: newProfile.manager || "",
        verksamhetschef: newProfile.verksamhetschef || "",
        st_total_months: newProfile.stTotalMonths ?? 66,
        med_degree_country: newProfile.medDegreeCountry || "",
        med_degree_date: newProfile.medDegreeDate || "",
        license_country: newProfile.licenseCountry || "",
        license_date: newProfile.licenseDate || "",
        has_foreign_license: newProfile.hasForeignLicense ?? false,
        foreign_licenses: newProfile.foreignLicenses || [],
        has_prior_specialist: newProfile.hasPriorSpecialist ?? false,
        prior_specialties: newProfile.priorSpecialties || [],
        is_third_country_specialist: newProfile.isThirdCountrySpecialist ?? false,
        bt_mode: newProfile.btMode || "fristående",
        locked: newProfile.locked ?? false,
        updated_at: new Date().toISOString(),
      };

      console.log("[saveProfile] Upsert payload:", payload);
      const { data: upsertData, error: supabaseError } = await upsertProfilePayload(payload);
      console.log("[saveProfile] Upsert result:", { data: upsertData, error: supabaseError });

      if (supabaseError) {
        console.error("[saveProfile] Supabase upsert error:", supabaseError);
        throw supabaseError;
      }

      void logAudit("update", "profile", `Profil sparad: ${form.name} (${form.specialty})`);
      console.log("[saveProfile] Profil sparad, navigerar...", { isSetupMode });
      if (isSetupMode) {
        router.replace("/planera-st");
      } else {
        router.push("/");
      }
      console.log("[saveProfile] Navigation anropad");
    } catch (error) {
      console.error("[saveProfile] Error saving profile:", error);
      alert(`Kunde inte spara profil: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const clinicFieldsLocked = userRole === "st_lakare";

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-6 text-slate-900">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Profil</h1>
        <p className="mt-1 text-slate-600">Fyll i personuppgifter och uppgifter om ST.</p>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setProfileTab("profil")}
            className={
              profileTab === "profil"
                ? "rounded-lg border border-slate-300 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
                : "rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            }
          >
            Profil
          </button>
          <button
            type="button"
            onClick={() => setProfileTab("klinik")}
            className={
              profileTab === "klinik"
                ? "rounded-lg border border-slate-300 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
                : "rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            }
          >
            Klinik
          </button>
          <button
            type="button"
            onClick={() => setProfileTab("hemklinik")}
            className={
              profileTab === "hemklinik"
                ? "rounded-lg border border-slate-300 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
                : "rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            }
          >
            Hemklinik
          </button>
        </div>
      </header>

      {profileTab === "hemklinik" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {clinicLoading ? (
            <p className="text-sm text-slate-500">Laddar...</p>
          ) : !clinicData || clinicData.members.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Du är inte kopplad till någon klinik ännu.</p>
              <p className="text-xs text-slate-400">Din studierektor bjuder in dig via e-post. När du accepterar inbjudan visas din klinik här.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">{clinicData.clinicName || 'Hemklinik'}</h3>

              {/* Studierektor */}
              {(() => {
                const studierektorer = clinicData.members.filter(m => m.role === 'studierektor');
                return studierektorer.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Studierektor</h4>
                    <div className="space-y-1">
                      {studierektorer.map(m => (
                        <div key={m.user_id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                            {(m.name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{m.name}</div>
                            <div className="text-xs text-slate-500">Studierektor</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Huvudhandledare */}
              {(() => {
                const handledare = clinicData.members.filter(m => m.role === 'huvudhandledare');
                return handledare.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Huvudhandledare</h4>
                    <div className="space-y-1">
                      {handledare.map(m => (
                        <div key={m.user_id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                            {(m.name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{m.name}</div>
                            <div className="text-xs text-slate-500">Huvudhandledare</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* ST-kollegor */}
              {(() => {
                const kollegor = clinicData.members.filter(m => m.role === 'st_lakare' && m.user_id !== authUser?.id);
                return (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">ST-kollegor</h4>
                    {kollegor.length > 0 ? (
                      <div className="space-y-1">
                        {kollegor.map(m => (
                          <div key={m.user_id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                              {(m.name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-900">{m.name}</div>
                              <div className="text-xs text-slate-500">ST-läkare</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        Inga andra ST-läkare i kliniken.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </section>
      ) : profileTab === "klinik" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Klinik</h3>
          <p className="text-sm text-slate-500">
            Dessa uppgifter beslutas av studierektor och visas här samlat.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ReadonlyInput label="Hemklinik" value={String(clinicData?.clinicName || form.homeClinic || "")} />
            <ReadonlyInput label="Huvudhandledare" value={String(clinicData?.assignedSupervisorName || form.supervisor || "Ej tilldelad")} />
            <ReadonlyInput
              label="Huvudhandledare – tjänsteställe"
              value={String(form.supervisorWorkplace || clinicData?.clinicName || form.homeClinic || "")}
            />
            <ReadonlyInput label="Studierektor" value={String((clinicData?.studyDirectorNames || []).join(", ") || form.studyDirector || "")} />
            <ReadonlyInput
              label="Studierektor – tjänsteställe"
              value={String(form.studyDirectorWorkplace || clinicData?.clinicName || form.homeClinic || "")}
            />
            <ReadonlyInput label="ST-chef" value={String(clinicData?.stChief || form.manager || "")} />
            <ReadonlyInput label="Verksamhetschef" value={String(clinicData?.verksamhetschef || form.verksamhetschef || "")} />
          </div>
        </section>
      ) : (
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Vänster: Personuppgifter */}
        <article className="md:order-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-extrabold">Personuppgifter</h2>
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
          </div>

        </article>

        {/* Höger: Uppgifter om ST */}
        <article className="md:order-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-extrabold">Uppgifter om ST</h2>
          <div className="grid grid-cols-1 gap-3">
            {/* Rad 1: Specialitet (vänster) + Målversion (höger) */}
<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
  <div>
    <Labeled>Specialitet</Labeled>
    <select
      value={form.specialty}
      onChange={(e) =>
        setForm({ ...form, specialty: (e.target as HTMLSelectElement).value })
      }
      className="h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
    >
      <option value="">— Välj —</option>
      {specialtiesSorted.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  </div>

  <div>
    <Labeled>Målversion</Labeled>
    <select
      value={form.goalsVersion}
      onChange={(e) => {
        const gv = (e.target as HTMLSelectElement).value as any;
        setForm({
          ...form,
          goalsVersion: gv,
          // sätt default för längd när målversion byts
          stTotalMonths: gv === "2021" ? 66 : 60,
        });
      }}
      className="h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
    >
      <option value="2015">SOSFS 2015:8</option>
      <option value="2021">HSLF-FS 2021:8</option>
    </select>
  </div>
</div>

            {/* Rad 2: BT/ST-startdatum + ST-längd (endast 2021) */}
{form.goalsVersion === "2021" && (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    <div>
      <Labeled>Startdatum för BT/ST</Labeled>
      <CalendarDatePicker
        value={form.btStartDate || ""}
        onChange={(v: string) => setForm({ ...form, btStartDate: v })}
      />
    </div>
    <div>
      <Labeled>ST-längd i månader (inklusive BT)</Labeled>
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
            )}

            {/* Rad 3: Startdatum ST (endast 2015) */}
            {form.goalsVersion === "2015" && (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    <div>
      <Labeled>Startdatum för ST</Labeled>
      <CalendarDatePicker
        value={form.stStartDate || ""}
        onChange={(v: string) => setForm({ ...form, stStartDate: v })}
      />
    </div>
    <div>
      <Labeled>ST-längd i månader</Labeled>
      <select
        value={String(form.stTotalMonths ?? 60)}
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
            )}

            {clinicFieldsLocked ? null : (
              <>
                {/* Hemklinik */}
                <div>
                  <Labeled>Hemklinik</Labeled>
                  <Input value={form.homeClinic} onChange={(v) => setForm({ ...form, homeClinic: v })} />
                </div>

                {/* Huvudhandledare & Studierektor bredvid varandra */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Huvudhandledare */}
                  <div>
                    <Labeled>Huvudhandledare</Labeled>
                    <Input value={form.supervisor} onChange={(v) => setForm({ ...form, supervisor: v })} />
                    <label className="mt-2 inline-flex items-center gap-2 text-sm select-none">
                      <input
                        type="checkbox"
                        checked={supervisorHasOtherSite}
                        onChange={(e) => setSupervisorHasOtherSite(e.currentTarget.checked)}
                      />
                      Har annat tjänsteställe
                    </label>
                    {supervisorHasOtherSite && (
                      <div className="mt-3">
                        <Input
                          value={form.supervisorWorkplace}
                          onChange={(v) => setForm({ ...form, supervisorWorkplace: v })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Studierektor */}
                  <div>
                    <Labeled>Studierektor</Labeled>
                    <Input
                      value={form.studyDirector}
                      onChange={(v) => setForm({ ...form, studyDirector: v })}
                    />
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
                        <Input
                          value={form.studyDirectorWorkplace}
                          onChange={(v) => setForm({ ...form, studyDirectorWorkplace: v })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Chef + Verksamhetschef på samma rad */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Labeled>Chef</Labeled>
                    <Input value={form.manager} onChange={(v) => setForm({ ...form, manager: v })} />
                  </div>
                  <div>
                    <Labeled>Verksamhetschef</Labeled>
                    <Input
                      value={form.verksamhetschef}
                      onChange={(v) => setForm({ ...form, verksamhetschef: v })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Land + Datum för läkarexamen på samma rad */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Labeled>Land för läkarexamen</Labeled>
                <Input value={form.medDegreeCountry} onChange={(v) => setForm({ ...form, medDegreeCountry: v })} />
              </div>
              <div>
                <Labeled>Datum för läkarexamen</Labeled>
                <CalendarDatePicker
                  value={form.medDegreeDate || ""}
                  onChange={(v: string) => setForm({ ...form, medDegreeDate: v })}
                  align="right"
                  forceDirection="up"
                />
              </div>
            </div>

            {/* Land + Datum för legitimation (placeras direkt under läkarexamen) */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Labeled>Land för legitimation</Labeled>
                <Input value={form.licenseCountry} onChange={(v) => setForm({ ...form, licenseCountry: v })} />
              </div>
              <div>
                <Labeled>Datum för legitimation</Labeled>
                <CalendarDatePicker
                  value={form.licenseDate || ""}
                  onChange={(v: string) => setForm({ ...form, licenseDate: v })}
                  align="right"
                  forceDirection="up"
                />
              </div>
            </div>

            {/* ===== Längst ned: Legitimation i annat land ===== */}
            <div className="rounded-2xl border border-slate-200 p-3">
              <label className="inline-flex items-center gap-2 text-[13px] select-none">
                <input
                  type="checkbox"
                  checked={!!form.hasForeignLicense}
                  onChange={(e) => {
                    const on = e.currentTarget.checked;
                    setForm({
                      ...form,
                      hasForeignLicense: on,
                      foreignLicenses: on
                        ? ((form.foreignLicenses && form.foreignLicenses.length) ? form.foreignLicenses.slice(0, 3) : [{ country: "", date: "" }])
                        : [],
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

                      {/* Datumkolumn + ev. minusknapp inom samma 220px-bredd */}
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

            {/* ===== Längst ned: Bevis om specialistkompetens sedan tidigare ===== */}
            <div className="rounded-2xl border border-slate-200 p-3">
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
                        ? ((form.priorSpecialties && form.priorSpecialties.length) ? form.priorSpecialties.slice(0, 4) : [{ speciality: "", country: "", date: "" }])
                        : [],
                    });
                  }}
                />
                <span className="font">Har sedan tidigare bevis om specialistkompetens</span>
              </label>

              {form.hasPriorSpecialist && (
                <div className="mt-2 space-y-2">
                  {(form.priorSpecialties || []).slice(0, 4).map((row: { speciality: string; country: string; date: string }, idx: number) => (
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

                      {/* Datumkolumn + ev. minusknapp inom samma 220px-bredd */}
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

                  {(form.priorSpecialties || []).length < 4 && (
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

            {/* ===== Längst ned: Specialistläkare från tredje land ===== */}
            <div className="rounded-2xl border border-slate-200 p-3">
              <label className="inline-flex items-center gap-2 text-[13px] select-none">
                <input
                  type="checkbox"
                  checked={!!form.isThirdCountrySpecialist}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      isThirdCountrySpecialist: e.currentTarget.checked,
                    });
                  }}
                />
                <span className="font">Specialistläkare från tredje land</span>
              </label>
            </div>
          </div>

        </article>
      </section>
      )}

      <footer className="mt-6 flex justify-between gap-2">
        <button 
          onClick={() => setLogoutConfirmOpen(true)}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-50"
        >
          Logga ut
        </button>
        <div className="flex gap-2">
          <button onClick={() => router.push("/")} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50">
            Avbryt
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              saveProfile();
            }} 
            className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white shadow hover:bg-sky-700"
          >
            Spara
          </button>
        </div>
      </footer>

      {/* Utloggningsbekräftelse */}
      <LogoutConfirmDialog
        open={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={async () => {
          setLogoutConfirmOpen(false);
          await supabase.auth.signOut();
          router.push('/auth');
        }}
      />
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageInner />
    </Suspense>
  );
}
