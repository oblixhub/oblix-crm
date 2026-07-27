import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const normalizeHandle = (value: string) =>
  `@${value.trim().replace(/^@+/, "").toLowerCase()}`;

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response({ error: "Método não permitido." }, 405);
  }

  try {
    const { slug, username, password } = await request.json();
    if (![slug, username, password].every((value) => typeof value === "string")) {
      return response({ error: "Informe usuário e senha para continuar." }, 400);
    }

    const normalizedUsername = normalizeHandle(username);
    if (normalizedUsername !== normalizeHandle(password)) {
      return response({ error: "Confira o usuário e a senha informados." }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: lead, error } = await admin
      .from("leads")
      .select("handle, full_name, preview_site_url, preview_version")
      .eq("preview_slug", slug.trim().toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!lead || !lead.preview_site_url || normalizeHandle(lead.handle) !== normalizedUsername) {
      return response({ error: "Não encontramos um preview para estes dados." }, 401);
    }

    return response({
      success: true,
      handle: lead.handle,
      fullName: lead.full_name,
      siteUrl: lead.preview_site_url,
      version: lead.preview_version ?? 1,
    });
  } catch (error) {
    console.error(error);
    return response({ error: "Não foi possível abrir este preview." }, 500);
  }
});
