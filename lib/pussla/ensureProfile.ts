"use client";

export async function ensureProfile(params: {
  current: any;
  forceRefresh?: boolean;
  isValidISO: (iso: string) => boolean;
  getSessionUser: () => Promise<any>;
  fetchProfileById: (userId: string) => Promise<{ data: any; error: any }>;
  mapProfile: (row: any) => any;
}): Promise<any | null> {
  const {
    current,
    forceRefresh = false,
    isValidISO,
    getSessionUser,
    fetchProfileById,
    mapProfile,
  } = params;

  if (!forceRefresh && current) {
    const bt = String(current?.btStartDate || "").trim();
    const st = String(current?.stStartDate || "").trim();
    const hasTimelineAnchor =
      (bt && (isValidISO(bt) || /^\d{4}-\d{2}-\d{2}T/.test(bt))) ||
      (st && (isValidISO(st) || /^\d{4}-\d{2}-\d{2}T/.test(st)));
    if (hasTimelineAnchor) return current;
  }

  try {
    const user = await getSessionUser();
    if (!user?.id) return current || null;
    const { data, error } = await fetchProfileById(user.id);
    if (error || !data) return current || null;
    return mapProfile(data as any);
  } catch {
    return current || null;
  }
}
