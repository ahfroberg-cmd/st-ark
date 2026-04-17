export async function fetchNormalizedIupSettings(input: {
  supabaseClient: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data?: any }> };
      };
    };
  };
  userId: string;
  columns: string;
  normalizeIupSettings: (existing: any) => any;
}): Promise<any> {
  const { supabaseClient, userId, columns, normalizeIupSettings } = input;
  const { data: existing } = await supabaseClient
    .from("iup_settings")
    .select(columns)
    .eq("user_id", userId)
    .maybeSingle();
  return normalizeIupSettings(existing);
}

export async function saveNormalizedIupSettings(input: {
  upsertIupSettingsOnUserId: (payload: any) => Promise<any>;
  buildIupSettingsUpsertPayload: (args: {
    userId: string;
    base: any;
    meetings: any[];
    assessments: any[];
  }) => Record<string, unknown>;
  userId: string;
  base: any;
  meetings: any[];
  assessments: any[];
}): Promise<void> {
  const {
    upsertIupSettingsOnUserId,
    buildIupSettingsUpsertPayload,
    userId,
    base,
    meetings,
    assessments,
  } = input;
  await upsertIupSettingsOnUserId(
    buildIupSettingsUpsertPayload({
      userId,
      base,
      meetings,
      assessments,
    }) as any
  );
}
