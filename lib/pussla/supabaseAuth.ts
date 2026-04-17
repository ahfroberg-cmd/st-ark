export async function resolveSupabaseUserId(supabaseClient: {
  auth: { getUser: () => Promise<{ data?: { user?: { id?: string } | null } }> };
}): Promise<string | null> {
  const result = await supabaseClient.auth.getUser();
  return result?.data?.user?.id || null;
}
