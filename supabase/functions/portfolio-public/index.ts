import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const getNamedKey = (name: "SUPABASE_SECRET_KEYS") => {
  const raw = Deno.env.get(name);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed.default === "string" ? parsed.default : "";
  } catch {
    return "";
  }
};

const encodeStoragePath = (path: string) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "GET") {
    return response({ error: "Método não permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const secretKey =
      getNamedKey("SUPABASE_SECRET_KEYS") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      "";
    if (!supabaseUrl || !secretKey) {
      return response({ error: "Portfólio indisponível." }, 500);
    }

    const url = new URL(request.url);
    const slug = url.searchParams.get("slug")?.trim().toLowerCase() || null;
    const featuredOnly = url.searchParams.get("featured") === "true";
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);

    const admin = createClient(supabaseUrl, secretKey);
    let query = admin
      .from("portfolio_projects")
      .select(
        "id, title, slug, category, short_description, description, services, public_key, current_version, content_url, cover_desktop_path, cover_mobile_path, live_url, show_live_link, featured, sort_order, published_at",
      )
      .eq("status", "published")
      .gt("current_version", 0)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(limit);

    if (slug) query = query.eq("slug", slug);
    if (featuredOnly) query = query.eq("featured", true);

    const { data, error } = await query;
    if (error) throw error;

    const coverUrl = (path: string | null) =>
      path
        ? `${supabaseUrl.replace(
            /\/+$/,
            "",
          )}/storage/v1/object/public/portfolio-covers/${encodeStoragePath(path)}`
        : null;

    const projects = (data ?? []).map((project) => ({
      id: project.id,
      title: project.title,
      slug: project.slug,
      category: project.category,
      shortDescription: project.short_description,
      description: project.description,
      services: project.services,
      coverDesktopUrl: coverUrl(project.cover_desktop_path),
      coverMobileUrl: coverUrl(project.cover_mobile_path),
      contentUrl: project.content_url,
      liveUrl: project.show_live_link ? project.live_url : null,
      showLiveLink: Boolean(project.show_live_link && project.live_url),
      featured: project.featured,
      sortOrder: project.sort_order,
      publishedAt: project.published_at,
    }));

    if (slug) {
      const project = projects[0] ?? null;
      if (!project) return response({ error: "Projeto não encontrado." }, 404);
      return response({ project });
    }

    return response({ projects });
  } catch (error) {
    console.error("[portfolio-public] query failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return response({ error: "Não foi possível carregar o portfólio." }, 500);
  }
});
