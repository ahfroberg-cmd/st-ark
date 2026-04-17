import { isPrivateVardcentralName } from "@/lib/admin/privateVardcentral";

export type AdminClinicRow = {
  id: string;
  name: string;
  hospital_id?: string | null;
  created_at: string;
  hospitals?: {
    id: string;
    name: string;
    region?: string | null;
    facility_type?: string | null;
  } | null;
};

function facilityTypeOf(h: { facility_type?: string | null } | null | undefined) {
  return h?.facility_type === "vardcentral" ? "vardcentral" : "sjukhus";
}

/** Gruppera kliniker under sjukhusnamn, sortera sjukhus och kliniker alfabetiskt (sv). */
export function groupClinicsByHospital(
  clinics: AdminClinicRow[]
): { hospitalLabel: string; clinics: AdminClinicRow[] }[] {
  const map = new Map<string, AdminClinicRow[]>();
  for (const c of clinics) {
    const label =
      (c.hospitals?.name && String(c.hospitals.name).trim()) || "Ej angivet sjukhus";
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(c);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "sv", { sensitivity: "base" }))
    .map(([hospitalLabel, row]) => ({ hospitalLabel, clinics: row }));
}

/** En post per region som har minst en klinik; uppdelat i vårdcentral vs sjukhus (admin-vy). */
export type ClinicsByRegionBlock = {
  region: string;
  vardcentral: AdminClinicRow[];
  sjukhus: AdminClinicRow[];
};

export function groupClinicsByRegionAndFacility(clinics: AdminClinicRow[]): ClinicsByRegionBlock[] {
  const byRegion = new Map<string, { vc: AdminClinicRow[]; sj: AdminClinicRow[] }>();
  for (const c of clinics) {
    const region = String(c.hospitals?.region || "").trim() || "Övrigt";
    const isVardcentral = c.hospitals?.facility_type === "vardcentral";
    if (!byRegion.has(region)) byRegion.set(region, { vc: [], sj: [] });
    const b = byRegion.get(region)!;
    if (isVardcentral) b.vc.push(c);
    else b.sj.push(c);
  }
  for (const b of byRegion.values()) {
    b.vc.sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));
    b.sj.sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));
  }
  return [...byRegion.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "sv", { sensitivity: "base" }))
    .map(([region, blocks]) => ({
      region,
      vardcentral: blocks.vc,
      sjukhus: blocks.sj,
    }))
    .filter((block) => block.vardcentral.length > 0 || block.sjukhus.length > 0);
}

/** Sjukhus-kliniker grupperade under samma vårdenhet (expandbar lista i admin). */
export type SjukhusClinicGroup = {
  key: string;
  hospitalLabel: string;
  clinics: AdminClinicRow[];
};

export function groupSjukhusClinicsByHospital(clinics: AdminClinicRow[]): SjukhusClinicGroup[] {
  const map = new Map<string, { label: string; rows: AdminClinicRow[] }>();
  for (const c of clinics) {
    const label = String(c.hospitals?.name || "").trim() || "Ej angivet sjukhus";
    const id = String(c.hospital_id || c.hospitals?.id || "").trim();
    const key = id || `name:${label}`;
    if (!map.has(key)) map.set(key, { label, rows: [] });
    map.get(key)!.rows.push(c);
  }
  for (const v of map.values()) {
    v.rows.sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));
  }
  return [...map.entries()]
    .sort((a, b) => a[1].label.localeCompare(b[1].label, "sv", { sensitivity: "base" }))
    .map(([key, v]) => ({ key, hospitalLabel: v.label, clinics: v.rows }));
}

/** Optgroup per region; valfritt filtrerat på sjukhus eller vårdcentral (för registreringsflöde). */
export function hospitalsForSelectGrouped(
  hospitals: { id: string; name: string; region: string; facility_type?: string | null }[],
  opts?: { facilityType?: "sjukhus" | "vardcentral" }
): { label: string; items: { id: string; name: string }[] }[] {
  let list = hospitals;
  if (opts?.facilityType) {
    list = hospitals.filter((h) => facilityTypeOf(h) === opts.facilityType);
  }
  const byRegion = new Map<string, { id: string; name: string }[]>();
  for (const h of list) {
    const r = String(h.region || "Övrigt");
    if (!byRegion.has(r)) byRegion.set(r, []);
    byRegion.get(r)!.push({ id: h.id, name: h.name });
  }
  const splitPrivate = opts?.facilityType === "vardcentral";
  const out: { label: string; items: { id: string; name: string }[] }[] = [];
  for (const region of [...byRegion.keys()].sort((a, b) =>
    a.localeCompare(b, "sv", { sensitivity: "base" })
  )) {
    const raw = byRegion.get(region)!;
    if (!splitPrivate) {
      const items = [...raw].sort((a, b) =>
        a.name.localeCompare(b.name, "sv", { sensitivity: "base" })
      );
      out.push({ label: region, items });
      continue;
    }
    const off = raw.filter((x) => !isPrivateVardcentralName(x.name));
    const priv = raw.filter((x) => isPrivateVardcentralName(x.name));
    off.sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));
    priv.sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));
    if (off.length) out.push({ label: region, items: off });
    if (priv.length) out.push({ label: `${region} (privata vårdval)`, items: priv });
  }
  return out;
}

/** Optgroup med typ i etiketten (HTML tillåter inte nästlade optgroup). */
export function hospitalsForModalSelectGrouped(
  hospitals: { id: string; name: string; region: string; facility_type?: string | null }[]
): { label: string; items: { id: string; name: string }[] }[] {
  const typeLabel = (t: string) => (t === "vardcentral" ? "Vårdcentral" : "Sjukhus");
  const byKey = new Map<string, { id: string; name: string }[]>();
  for (const h of hospitals) {
    const t = facilityTypeOf(h);
    const region = String(h.region || "Övrigt");
    const base = `${typeLabel(t)} · ${region}`;
    const gl =
      t === "vardcentral" && isPrivateVardcentralName(h.name)
        ? `${base} (privata vårdval)`
        : base;
    if (!byKey.has(gl)) byKey.set(gl, []);
    byKey.get(gl)!.push({ id: h.id, name: h.name });
  }
  for (const items of byKey.values()) {
    items.sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));
  }
  return [...byKey.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "sv", { sensitivity: "base" }))
    .map(([label, items]) => ({ label, items }));
}
