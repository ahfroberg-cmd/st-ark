"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LogoutConfirmDialog from '@/components/LogoutConfirmDialog';
import { StudentDetailModal } from "@/components/studierektor/StudentDetailModal";
import { perfMark, perfMeasure } from '@/lib/perf';
import {
  buildSupervisorStudent,
  type SupervisorStudent,
} from '@/lib/mappers/studentData';
import {
  fetchClinicNameById,
  fetchProfileRoleById,
  getAuthenticatedUserId,
  getClinicIdForCurrentUserRole,
  listClinicMembershipsByClinicId,
  listProfilesByIds,
  listSupervisorAssignedStudentIds,
  listStudentPackByIds,
} from '@/lib/repositories/starkRepository';

export default function HandledarePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [students, setStudents] = useState<SupervisorStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SupervisorStudent | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [clinicMembers, setClinicMembers] = useState<{ user_id: string; role: string; name: string }[]>([]);
  const [clinicName, setClinicName] = useState('');
  const [studentSortBy, setStudentSortBy] = useState<"name" | "goalsVersion" | "ongoingPlacement" | "nextPlacement" | "stEndDate" | "progress" | "phase" | "lastUpdated">("name");
  const [studentSortDir, setStudentSortDir] = useState<"asc" | "desc">("asc");
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        router.replace('/auth');
        return;
      }

      const { data: profile } = await fetchProfileRoleById(userId);

      if (profile?.role !== 'huvudhandledare') {
        router.replace('/planera-st');
        return;
      }

      setAuthorized(true);
      const clinicId = String((await getClinicIdForCurrentUserRole('huvudhandledare')) || '');
      let clinicMemberNameById = new Map<string, string>();

      if (clinicId) {
        const [{ data: clinicRow }, { data: allMemberRows }] = await Promise.all([
          fetchClinicNameById(clinicId),
          listClinicMembershipsByClinicId(clinicId),
        ]);

        setClinicName(String(clinicRow?.name || ''));

        const allUserIds = Array.from(new Set((allMemberRows || []).map((r: any) => String(r.user_id || '')).filter(Boolean)));
        if (allUserIds.length > 0) {
          const { data: memberProfiles } = await listProfilesByIds(allUserIds, 'id,name');
          const profileMap = new Map<string, string>(
            (memberProfiles || []).map((p: any) => [String(p.id), String(p.name || "Okänd")])
          );
          clinicMemberNameById = profileMap;
          setClinicMembers(
            (allMemberRows || []).map((r: any) => ({
              user_id: String(r.user_id || ''),
              role: String(r.role || ''),
              name: String(profileMap.get(String(r.user_id || '')) || 'Okänd'),
            }))
          );
        }
      }

      // Hämta tilldelade ST-läkare (robust: läs tilldelningar + profiler separat)
      const loadStart = perfMark("handledare.loadStudents");
      const { data: assignmentRows, error: assignmentErr } = await listSupervisorAssignedStudentIds(userId);
      if (assignmentErr) throw assignmentErr;

      const stIds = Array.from(
        new Set((assignmentRows || []).map((r: any) => String(r.st_lakare_id || '')).filter(Boolean))
      );
      let profileById = new Map<string, any>();
      let placementsById = new Map<string, any[]>();
      let coursesById = new Map<string, any[]>();
      let achievementsById = new Map<string, any[]>();
      const timelinesById = new Map<string, any[]>();
      const milestonePlansById = new Map<string, any[]>();
      const iupSettingsById = new Map<string, any>();
      if (stIds.length > 0) {
        const [
          stProfilesRes,
          placementsRes,
          coursesRes,
          achievementsRes,
          timelineRes,
          milestonePlansRes,
          iupSettingsRes,
        ] = await listStudentPackByIds(stIds);
        const stProfiles = stProfilesRes.data || [];
        const stProfilesErr = stProfilesRes.error;
        if (stProfilesErr) throw stProfilesErr;
        profileById = new Map((stProfiles || []).map((p: any) => [String(p.id), p]));
        placementsById = new Map<string, any[]>();
        (placementsRes.data || []).forEach((pl: any) => {
          const key = String(pl.user_id || '');
          if (!placementsById.has(key)) placementsById.set(key, []);
          placementsById.get(key)!.push(pl);
        });
        coursesById = new Map<string, any[]>();
        (coursesRes.data || []).forEach((c: any) => {
          const key = String(c.user_id || '');
          if (!coursesById.has(key)) coursesById.set(key, []);
          coursesById.get(key)!.push(c);
        });
        achievementsById = new Map<string, any[]>();
        (achievementsRes.data || []).forEach((a: any) => {
          const key = String(a.user_id || '');
          if (!achievementsById.has(key)) achievementsById.set(key, []);
          achievementsById.get(key)!.push(a);
        });
        (timelineRes.data || []).forEach((t: any) => {
          const key = String(t.user_id || '');
          if (!timelinesById.has(key)) timelinesById.set(key, []);
          timelinesById.get(key)!.push(t);
        });
        (milestonePlansRes.data || []).forEach((mp: any) => {
          const key = String(mp.user_id || '');
          if (!milestonePlansById.has(key)) milestonePlansById.set(key, []);
          milestonePlansById.get(key)!.push(mp);
        });
        (iupSettingsRes.data || []).forEach((row: any) => {
          iupSettingsById.set(String(row.user_id || ''), row);
        });
      }

      const mappedStudents: SupervisorStudent[] = (assignmentRows || [])
        .map((r: any) => {
          const userId = String(r.st_lakare_id || '');
          const p = profileById.get(userId) || {};
          const userTimelines = timelinesById.get(userId) || [];
          const latestVersion = userTimelines[0];
          const fallbackName = String(clinicMemberNameById.get(userId) || '').trim();
          return buildSupervisorStudent({
            profileRow: { ...p, id: userId, name: String((p as any)?.name || fallbackName || 'Okänd ST-läkare') },
            placements: placementsById.get(userId) || [],
            courses: coursesById.get(userId) || [],
            achievements: achievementsById.get(userId) || [],
            milestonePlans: milestonePlansById.get(userId) || [],
            iupSettings: iupSettingsById.get(userId) || null,
            timelineVersionData: latestVersion?.version_data,
          });
        })
        .filter((s: SupervisorStudent) => s.id);

      setStudents(mappedStudents);
      perfMeasure("handledare.loadStudents", loadStart, { count: mappedStudents.length });
      setLoading(false);
    }

    checkAuth();
  }, [router]);

  const formatDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("sv-SE");
  };
  const placementLabel = (p: any) => String(p?.clinic || p?.title || p?.type || "").trim();
  const getOngoingPlacement = (student: SupervisorStudent) => {
    const today = new Date().toISOString().slice(0, 10);
    const list = Array.isArray(student.placements) ? student.placements : [];
    return list.find((p: any) => p?.startDate && p?.endDate && p.startDate <= today && today <= p.endDate) || null;
  };
  const getNextPlacement = (student: SupervisorStudent) => {
    const today = new Date().toISOString().slice(0, 10);
    const list = (Array.isArray(student.placements) ? student.placements : [])
      .filter((p: any) => p?.startDate && p.startDate > today)
      .sort((a: any, b: any) => String(a.startDate).localeCompare(String(b.startDate)));
    return list[0] || null;
  };
  const getStudentPlannedEndISO = (student: SupervisorStudent) => {
    const p: any = student.profile || {};
    return String(p.stEndISO || p.st_end_iso || p.stEndDate || p.st_end_date || '');
  };
  const getStudentPhaseLabel = (student: SupervisorStudent) => {
    const p: any = student.profile || {};
    const bt = String(p.btStartDate || p.bt_start_date || '');
    const st = String(p.stStartDate || p.st_start_date || '');
    const today = new Date().toISOString().slice(0, 10);
    if (bt && bt <= today && (!st || today < st)) return "BT";
    return "ST";
  };
  const calculateProgress = (student: SupervisorStudent) => {
    const today = new Date().toISOString().slice(0, 10);
    const completedPlacements = (student.placements || []).filter((p: any) => p.endDate && p.endDate < today);
    const totalMonths = completedPlacements.reduce((sum: number, p: any) => {
      if (!p.startDate || !p.endDate) return sum;
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      const attendance = (p.attendance || 100) / 100;
      return sum + months * attendance;
    }, 0);
    const targetMonths = student.goalsVersion === "2015" ? 60 : 66;
    return Math.max(0, Math.min(100, Math.round((totalMonths / targetMonths) * 100)));
  };
  const toggleStudentSort = (field: typeof studentSortBy) => {
    if (studentSortBy === field) {
      setStudentSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setStudentSortBy(field);
      setStudentSortDir("asc");
    }
  };
  const sortIndicator = (field: typeof studentSortBy) => {
    if (studentSortBy !== field) return "↕";
    return studentSortDir === "asc" ? "↑" : "↓";
  };
  const sortedStudents = useMemo(() => {
    const arr = [...students];
    const cmp = (a: string, b: string) => a.localeCompare(b, "sv", { sensitivity: "base" });
    arr.sort((a, b) => {
      let av = "";
      let bv = "";
      switch (studentSortBy) {
        case "name":
          av = a.name || "";
          bv = b.name || "";
          break;
        case "goalsVersion":
          av = String(a.goalsVersion || "");
          bv = String(b.goalsVersion || "");
          break;
        case "ongoingPlacement":
          av = placementLabel(getOngoingPlacement(a));
          bv = placementLabel(getOngoingPlacement(b));
          break;
        case "nextPlacement":
          av = placementLabel(getNextPlacement(a));
          bv = placementLabel(getNextPlacement(b));
          break;
        case "stEndDate":
          av = getStudentPlannedEndISO(a);
          bv = getStudentPlannedEndISO(b);
          break;
        case "progress":
          av = String(calculateProgress(a)).padStart(3, "0");
          bv = String(calculateProgress(b)).padStart(3, "0");
          break;
        case "phase":
          av = getStudentPhaseLabel(a);
          bv = getStudentPhaseLabel(b);
          break;
        case "lastUpdated":
          av = String(a.lastUpdated || "");
          bv = String(b.lastUpdated || "");
          break;
      }
      return studentSortDir === "asc" ? cmp(av, bv) : cmp(bv, av);
    });
    return arr;
  }, [students, studentSortBy, studentSortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="mt-4 text-slate-600">Laddar...</p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-black bg-white px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="select-none caret-transparent text-4xl font-extrabold tracking-tight cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:outline-none focus:ring-0"
            >
              <span className="text-sky-700">ST</span>
              <span className="text-emerald-700">ARK</span>
            </button>
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 select-none">
              Huvudhandledare
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(true)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Logga ut
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900 select-none">Mina ST-läkare</h1>
        </div>

        {students.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-500 mb-2">Inga ST-läkare tilldelade ännu.</p>
            <p className="text-sm text-slate-400">
              Kontakta din studierektor för att få ST-läkare tilldelade
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700"><button type="button" onClick={() => toggleStudentSort("name")} className="inline-flex items-center gap-1 hover:text-slate-900">Namn <span className="text-xs text-slate-400">{sortIndicator("name")}</span></button></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700"><button type="button" onClick={() => toggleStudentSort("goalsVersion")} className="inline-flex items-center gap-1 hover:text-slate-900">Målversion <span className="text-xs text-slate-400">{sortIndicator("goalsVersion")}</span></button></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700"><button type="button" onClick={() => toggleStudentSort("ongoingPlacement")} className="inline-flex items-center gap-1 hover:text-slate-900">Pågående placering <span className="text-xs text-slate-400">{sortIndicator("ongoingPlacement")}</span></button></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700"><button type="button" onClick={() => toggleStudentSort("nextPlacement")} className="inline-flex items-center gap-1 hover:text-slate-900">Nästa placering <span className="text-xs text-slate-400">{sortIndicator("nextPlacement")}</span></button></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700"><button type="button" onClick={() => toggleStudentSort("stEndDate")} className="inline-flex items-center gap-1 hover:text-slate-900">ST-slutdatum <span className="text-xs text-slate-400">{sortIndicator("stEndDate")}</span></button></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700"><button type="button" onClick={() => toggleStudentSort("progress")} className="inline-flex items-center gap-1 hover:text-slate-900">Progress <span className="text-xs text-slate-400">{sortIndicator("progress")}</span></button></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700"><button type="button" onClick={() => toggleStudentSort("phase")} className="inline-flex items-center gap-1 hover:text-slate-900">Fas <span className="text-xs text-slate-400">{sortIndicator("phase")}</span></button></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700"><button type="button" onClick={() => toggleStudentSort("lastUpdated")} className="inline-flex items-center gap-1 hover:text-slate-900">Uppdaterad <span className="text-xs text-slate-400">{sortIndicator("lastUpdated")}</span></button></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedStudents.map((student) => {
                  const progress = calculateProgress(student);
                  const ongoing = getOngoingPlacement(student);
                  const nextPl = getNextPlacement(student);
                  const stEndISO = getStudentPlannedEndISO(student);
                  const phase = getStudentPhaseLabel(student);
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => void openStudentDetail(student.id)}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{student.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.goalsVersion}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{ongoing ? placementLabel(ongoing) : "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{nextPl ? placementLabel(nextPl) : "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{stEndISO ? formatDate(stEndISO) : "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-200">
                            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-sm text-slate-600">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{phase}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.lastUpdated ? new Date(student.lastUpdated).toLocaleDateString("sv-SE") : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </main>

      {/* Detaljvy */}
      {studentLoading && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          </div>
        </div>
      )}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          clinicMembers={clinicMembers}
          clinicName={clinicName}
        />
      )}

      <LogoutConfirmDialog
        open={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={async () => {
          setLogoutConfirmOpen(false);
          await supabase.auth.signOut();
          router.push('/auth');
        }}
      />
    </div>
  );

  async function openStudentDetail(userId: string) {
    if (!userId) return;
    const detailStart = perfMark("handledare.openStudentDetail");
    setStudentLoading(true);
    try {
      const [
        profilesRes,
        placementsRes,
        coursesRes,
        achievementsRes,
        timelineRes,
        milestonePlansRes,
        iupSettingsRes,
      ] = await listStudentPackByIds([userId]);

      if (profilesRes.error) throw profilesRes.error;
      if (placementsRes.error) throw placementsRes.error;
      if (coursesRes.error) throw coursesRes.error;
      if (achievementsRes.error) throw achievementsRes.error;
      if (timelineRes.error) throw timelineRes.error;
      if (milestonePlansRes.error) throw milestonePlansRes.error;
      if (iupSettingsRes.error) throw iupSettingsRes.error;

      const p: any = (profilesRes.data || [])[0] || {};
      const assignmentNameFallback = String(
        students.find((s) => s.id === userId)?.name ||
          clinicMembers.find((m) => m.user_id === userId)?.name ||
          ''
      ).trim();
      const latestVersion: any = (timelineRes.data || [])[0];
      const iupSettingsRow =
        (iupSettingsRes.data || []).find((row: any) => String(row.user_id || '') === userId) || null;
      const student: SupervisorStudent = buildSupervisorStudent({
        profileRow: {
          ...p,
          id: String(p.id || userId),
          name: String((p as any)?.name || assignmentNameFallback || 'Okänd ST-läkare'),
        },
        placements: placementsRes.data || [],
        courses: coursesRes.data || [],
        achievements: achievementsRes.data || [],
        milestonePlans: milestonePlansRes.data || [],
        iupSettings: iupSettingsRow,
        timelineVersionData: latestVersion?.version_data,
      });
      setSelectedStudent(student);
      perfMeasure("handledare.openStudentDetail", detailStart);
    } catch (error) {
      console.error("Failed to load student details", error);
      alert("Kunde inte ladda aktiviteter för ST-läkaren.");
    } finally {
      setStudentLoading(false);
    }
  }
}
