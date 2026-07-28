import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildPreviewPublicSlug,
  parsePreviewPublicSlug,
} from "../_shared/preview-public-slug.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
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
    const body = await request.json();
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!/^[a-z0-9-]{3,100}$/.test(slug)) {
      return response({ error: "Este endereço de preview não é válido." }, 400);
    }
    const parsedSlug = parsePreviewPublicSlug(slug);
    if (!parsedSlug) {
      return response({ error: "Este endereço de preview não é válido." }, 404);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: lead, error } = await admin
      .from("leads")
      .select(
        "id, handle, full_name, preview_site_url, preview_version, preview_requires_login, preview_slug",
      )
      .eq("preview_slug", parsedSlug.previewSlug)
      .maybeSingle();
    if (error) throw error;
    if (
      !lead?.preview_site_url ||
      !lead.preview_slug ||
      buildPreviewPublicSlug(lead.preview_slug, lead.id) !== slug
    ) {
      return response({ error: "Não encontramos este preview." }, 404);
    }

    const requiresLogin = Boolean(lead.preview_requires_login);
    if (requiresLogin) {
      const username = typeof body.username === "string" ? body.username : "";
      const password = typeof body.password === "string" ? body.password : "";
      const normalizedUsername = normalizeHandle(username);
      if (
        !username ||
        !password ||
        normalizedUsername !== normalizeHandle(password) ||
        normalizeHandle(lead.handle) !== normalizedUsername
      ) {
        return response(
          {
            error: "Confira o usuário e a senha informados.",
            requiresLogin: true,
          },
          401,
        );
      }
    }

    return response({
      success: true,
      handle: lead.handle,
      fullName: lead.full_name,
      siteUrl: lead.preview_site_url,
      version: lead.preview_version ?? 1,
      requiresLogin,
    });
  } catch (error) {
    console.error(
      "[client-preview-login]",
      error instanceof Error ? error.message : String(error),
    );
    return response({ error: "Não foi possível abrir este preview." }, 500);
  }
});
