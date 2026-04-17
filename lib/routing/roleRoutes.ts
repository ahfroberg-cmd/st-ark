export const DEFAULT_ROLE_ROUTE = "/planera-st";

const ROLE_ROUTE_MAP: Record<string, string> = {
  superadmin: "/admin",
  studierektor: "/studierektor",
  huvudhandledare: "/handledare",
  st_lakare: "/planera-st",
};

export function getDefaultRouteForRole(role: string | null | undefined): string {
  const normalized = String(role || "").trim().toLowerCase();
  return ROLE_ROUTE_MAP[normalized] || DEFAULT_ROLE_ROUTE;
}
