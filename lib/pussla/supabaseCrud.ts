type SupabaseLike = {
  from: (table: string) => {
    upsert: (payload: Record<string, any>) => any;
    insert: (payload: Record<string, any>) => any;
  };
};

type SaveEntityOptions = {
  supabase: SupabaseLike;
  table: string;
  linkedId?: string | null;
  payload: Record<string, any>;
};

export async function saveEntityRow(options: SaveEntityOptions): Promise<{
  id: string;
  data: any;
  created: boolean;
}> {
  const { supabase, table, linkedId, payload } = options;
  if (linkedId) {
    const { data, error } = await supabase
      .from(table)
      .upsert({ id: linkedId, ...payload })
      .select("*")
      .single();
    if (error) throw error;
    return { id: linkedId, data, created: false };
  }

  const genId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const { data, error } = await supabase
    .from(table)
    .insert({ id: genId, ...payload })
    .select("*")
    .single();
  if (error) throw error;
  return { id: genId, data, created: true };
}
