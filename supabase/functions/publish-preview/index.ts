import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { unzipSync } from "npm:fflate@0.8.2";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  contentTypeFor,
  encodePathForStorage,
  parseZipEntries,
  buildPreviewManifest,
} from "./engine.js";
import { createPreviewToken, buildPreviewTokenConfig } from "./token.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const PREVIEW_TOKEN_SECRET =
  Deno.env.get("PREVIEW_TOKEN_SECRET") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const PREVIEW_TOKEN_TTL_SECONDS = Number.parseInt(
  Deno.env.get("PREVIEW_TOKEN_TTL_SECONDS") ?? "1209600",
  10,
);

const normalizeHandle = (value: string) => `@${value.trim().replace(/^@+/, "").toLowerCase()}`;

const toSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const hasAbsoluteReferences = (rawText: string) =>
  /(?:src|href|action|fetch|url)\s*=\s*['"]\/(?!\/)/i.test(rawText);

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const previewPortalOrigin = (request: Request) => {
  const configured = Deno.env.get("PREVIEW_PORTAL_ORIGIN")?.replace(/\/$/, "");
  if (configured) return configured;

  const publicApp = Deno.env.get("VITE_PUBLIC_APP_URL")?.replace(/\/$/, "");
  if (publicApp) return publicApp;

  const requestOrigin = (() => {
    try {
      return new URL(request.url).origin.replace(/\/$/, "");
    } catch {
      return "";
    }
  })();

  return requestOrigin;
};

const previewContentOrigin = (request: Request) => {
  const configured = Deno.env.get("PREVIEW_CONTENT_ORIGIN")?.replace(/\/$/, "");
  if (configured) return configured;

  const publicApp = Deno.env.get("PUBLIC_APP_URL")?.replace(/\/$/, "");
  if (publicApp) return publicApp;

  const requestOrigin = (() => {
    try {
      return new URL(request.url).origin.replace(/\/$/, "");
    } catch {
      return "";
    }
  })();

  return requestOrigin;
};

const buildPreviewSiteUrl = (
  request: Request,
  token: string,
  slug: string,
  version: number,
) => {
  const tokenPart = encodeURIComponent(token);
  const slugPart = encodeURIComponent(slug);
  return `${previewContentOrigin(request)}/preview-content/${tokenPart}/${slugPart}/v${version}/`;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return response({ error: "Método não permitido." }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return response({ error: "Sessão necessária para publicar o preview." }, 401);
    }

    const { leadId, sourcePath } = await request.json();
    if (typeof leadId !== "string" || typeof sourcePath !== "string") {
      return response({ error: "Dados do preview inválidos." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const token = authorization.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return response({ error: "Sessão inválida. Faça login novamente." }, 401);
    }

    if (!sourcePath.startsWith(`${leadId}/source/`)) {
      return response({ error: "Arquivo não pertence ao lead selecionado." }, 400);
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .select("id, handle, preview_version, preview_slug")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) return response({ error: "Lead não encontrado." }, 404);

    const { data: zipFile, error: zipError } = await admin
      .storage
      .from("preview-zips")
      .download(sourcePath);

    if (zipError) throw zipError;
    if (!zipFile) {
      return response({ error: "Arquivo ZIP não encontrado." }, 404);
    }

    if (zipFile.size > MAX_ZIP_BYTES) {
      return response({ error: "O ZIP pode ter no máximo 20 MB." }, 400);
    }

    let extracted: Record<string, Uint8Array>;
    try {
      extracted = unzipSync(new Uint8Array(await zipFile.arrayBuffer()));
    } catch {
      return response(
        {
          error:
            "Não foi possível abrir este ZIP. Exporte novamente pelo Claude Design.",
        },
        400,
      );
    }

    const parsed = parseZipEntries({ zipEntries: extracted });
    if (parsed.error) {
      return response(
        { error: parsed.error, candidates: parsed.candidates ?? null },
        400,
      );
    }

    const { entries, entrypoint, removedOuterFolder } = parsed;
    const version = (lead.preview_version ?? 0) + 1;
    const previewSlug = lead.preview_slug || toSlug(normalizeHandle(lead.handle));

    if (!previewSlug) {
      return response(
        { error: "Não foi possível criar o endereço do preview." },
        400,
      );
    }

    if (!PREVIEW_TOKEN_SECRET) {
      return response(
        { error: "Configuração de segurança do preview indisponível." },
        500,
      );
    }

    const tokenConfig = buildPreviewTokenConfig({
      ttlSeconds: PREVIEW_TOKEN_TTL_SECONDS,
    });
    const previewToken = await createPreviewToken({
      slug: previewSlug,
      version: `v${version}`,
      leadId: lead.id,
      expiresAt: tokenConfig.expiresAt,
      secret: PREVIEW_TOKEN_SECRET,
    });

    const previewPathBase = `${previewToken}/${previewSlug}/v${version}`;
    const manifest = buildPreviewManifest({
      previewSlug,
      version,
      leadId: lead.id,
      entrypoint,
      entries,
      removedOuterFolder,
    });

    const uploads: Promise<unknown>[] = [];
    for (const entry of entries) {
      const filePath = `${previewPathBase}/${encodePathForStorage(entry.path)}`;
      uploads.push(
        admin.storage
          .from("preview-sites")
          .upload(filePath, new Blob([entry.bytes]), {
            contentType: contentTypeFor(entry.path),
            upsert: false,
            cacheControl: entry.path === entrypoint.path ? "no-cache" : "31536000",
          })
          .then((upload) => {
            if (upload.error) {
              throw upload.error;
            }
          }),
      );
    }

    uploads.push(
      admin.storage
        .from("preview-sites")
        .upload(
          `${previewPathBase}/.oblix-preview-manifest.json`,
          new Blob([JSON.stringify(manifest)]),
          {
            contentType: "application/json; charset=utf-8",
            upsert: false,
          },
        )
        .then((result) => {
          if (result.error) throw result.error;
        }),
    );

    try {
      await Promise.all(uploads);
    } catch (uploadError) {
      console.error(uploadError);
      return response({ error: "Falha ao salvar arquivos do preview." }, 500);
    }

    const previewUrl = `${previewPortalOrigin(request)}/preview/${encodeURIComponent(
      previewSlug,
    )}`;
    const previewSiteUrl = buildPreviewSiteUrl(
      request,
      previewToken,
      previewSlug,
      version,
    );

    const { error: updateError } = await admin
      .from("leads")
      .update({
        stage: "Preview",
        next_action: "Enviar acesso ao cliente",
        preview_url: previewUrl,
        preview_site_url: previewSiteUrl,
        preview_source_path: sourcePath,
        preview_slug: previewSlug,
        preview_file_name:
          sourcePath.split("/").pop()?.replace(/^\d+-/, "") ?? "site.zip",
        preview_version: version,
        preview_published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (updateError) throw updateError;

    return response({
      success: true,
      previewUrl,
      previewSlug,
      siteUrl: previewSiteUrl,
      version,
      entrypoint: entrypoint.path,
      relativePaths: !hasAbsoluteReferences(new TextDecoder().decode(entrypoint.bytes)),
      hasIndex: true,
      candidates: null,
    });
  } catch (error) {
    console.error(error);
    return response({ error: "Não foi possível publicar o preview. Tente novamente." }, 500);
  }
});
