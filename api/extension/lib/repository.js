import { createClient } from "@supabase/supabase-js";

function requireServerConfiguration(env) {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const error = new Error("server_configuration_missing");
    error.code = "SERVER_CONFIGURATION_MISSING";
    throw error;
  }

  return { url, key };
}

export function createLeadRepository(env = process.env) {
  const { url, key } = requireServerConfiguration(env);
  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "oblix-extension-api/1.0" },
    },
  });

  return {
    async findByUsername(username) {
      const normalized = String(username ?? "")
        .replace(/^@/, "")
        .trim()
        .toLowerCase();

      const { data, error } = await supabase
        .from("leads")
        .select("id, handle")
        .or(`handle.eq.@${normalized},handle.eq.${normalized},handle.ilike.%${normalized}%`)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    async countRecentCaptures(operatorName, sinceIso) {
      const { count, error } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "chrome_extension")
        .eq("captured_by", operatorName)
        .gte("captured_at", sinceIso);

      if (
        error &&
        error.code === "PGRST204" &&
        /captured_by|captured_at/i.test(error.message ?? "")
      ) {
        return 0;
      }

      if (error) throw error;
      return count ?? 0;
    },

    async getExtensionBatchId() {
      const candidateNames = ["Extensao Chrome", "Lote 2", "Lote 1"];

      for (const name of candidateNames) {
        const { data, error } = await supabase
          .from("lead_batches")
          .select("id")
          .eq("name", name)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.id) {
          return data.id;
        }
      }

      const fallback = await supabase
        .from("lead_batches")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallback.error) throw fallback.error;
      if (!fallback.data?.id) {
        const missing = new Error(
          "No lead batch found. Create at least one lot in public.lead_batches.",
        );
        missing.code = "NO_EXTENSION_BATCH";
        throw missing;
      }

      return fallback.data.id;
    },

    async createLead(payload) {
      const { data, error } = await supabase
        .from("leads")
        .insert(payload)
        .select("id, handle")
        .single();

      if (error) throw error;
      return data;
    },
  };
}
