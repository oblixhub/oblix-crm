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
import { buildPreviewPublicSlug } from "../_shared/preview-public-slug.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 8;
const PREVIEW_TOKEN_SECRET = (() => {
  const configured = Deno.env.get("PREVIEW_TOKEN_SECRET")?.trim();
  if (configured) {
    return configured;
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
})();
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

const getNamedKey = (name: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS") => {
  const raw = Deno.env.get(name);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed.default === "string" ? parsed.default : "";
  } catch {
    return "";
  }
};

const getPublishableKey = () =>
  getNamedKey("SUPABASE_PUBLISHABLE_KEYS") ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "";

const getSecretKey = () =>
  getNamedKey("SUPABASE_SECRET_KEYS") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";

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

const previewStoragePrefixFromUrl = (rawUrl: unknown) => {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl);
    const marker = "/preview-content/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const parts = parsed.pathname
      .slice(markerIndex + marker.length)
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
    if (
      parts.length < 3 ||
      !parts[0].includes(".") ||
      !/^v\d+$/i.test(parts[2])
    ) {
      return null;
    }
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  } catch {
    return null;
  }
};

const removePaths = async (
  admin: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[],
) => {
  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    if (!chunk.length) continue;
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) throw error;
  }
};

const listFiles = async (
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
) => {
  const paths: string[] = [];
  const visit = async (folder: string): Promise<void> => {
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    for (const item of data) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      if (item.metadata) {
        paths.push(path);
      } else {
        await visit(path);
      }
    }
  };
  await visit(prefix);
  return paths;
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
    const supabaseAnonKey = getPublishableKey();
    const supabaseSecretKey = getSecretKey();
    if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
      return response(
        { error: "Configuração do Supabase indisponível para publicação." },
        500,
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const token = authorization.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return response({ error: "Sessão inválida. Faça login novamente." }, 401);
    }

    const { data: publisherProfile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (profileError || publisherProfile?.role !== "owner") {
      return response(
        { error: "Somente os sócios podem publicar ou substituir previews." },
        403,
      );
    }

    if (!sourcePath.startsWith(`${leadId}/source/`)) {
      return response({ error: "Arquivo não pertence ao lead selecionado." }, 400);
    }

    const admin = createClient(
      supabaseUrl,
      supabaseSecretKey,
    );

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .select(
        "id, handle, preview_version, preview_slug, preview_site_url, preview_source_path",
      )
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

    const {
      entries,
      entrypoint,
      removedOuterFolder,
      rewrittenFiles = 0,
    } = parsed;
    const version = (lead.preview_version ?? 0) + 1;
    const previewSlug = lead.preview_slug || toSlug(normalizeHandle(lead.handle));
    const previewPublicSlug = buildPreviewPublicSlug(previewSlug, lead.id);

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

    const uploadedPaths: string[] = [];
    try {
      for (let index = 0; index < entries.length; index += UPLOAD_CONCURRENCY) {
        const batch = entries.slice(index, index + UPLOAD_CONCURRENCY);
        await Promise.all(
          batch.map(async (entry) => {
            const filePath = `${previewPathBase}/${encodePathForStorage(entry.path)}`;
            const upload = await admin.storage
              .from("preview-sites")
              .upload(filePath, new Blob([entry.bytes]), {
                contentType: contentTypeFor(entry.path),
                upsert: false,
                cacheControl:
                  entry.path === entrypoint.path ? "no-cache" : "31536000",
              });
            if (upload.error) throw upload.error;
            uploadedPaths.push(filePath);
          }),
        );
      }

      const manifestPath = `${previewPathBase}/.oblix-preview-manifest.json`;
      const manifestUpload = await admin.storage
        .from("preview-sites")
        .upload(manifestPath, new Blob([JSON.stringify(manifest)]), {
          contentType: "application/json; charset=utf-8",
          upsert: false,
        });
      if (manifestUpload.error) throw manifestUpload.error;
      uploadedPaths.push(manifestPath);
    } catch (uploadError) {
      await removePaths(admin, "preview-sites", uploadedPaths).catch(() => {});
      console.error("[publish-preview] upload failed", {
        leadId,
        version,
        error: uploadError instanceof Error ? uploadError.message : String(uploadError),
      });
      return response({ error: "Falha ao salvar arquivos do preview." }, 500);
    }

    const previewUrl = `${previewPortalOrigin(request)}/preview/${encodeURIComponent(
      previewPublicSlug,
    )}`;
    const previewSiteUrl = buildPreviewSiteUrl(
      request,
      previewToken,
      previewSlug,
      version,
    );

    const updateQuery = admin
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

    const versionGuardedQuery =
      lead.preview_version === null
        ? updateQuery.is("preview_version", null)
        : updateQuery.eq("preview_version", lead.preview_version);

    const { data: updatedLead, error: updateError } = await versionGuardedQuery
      .select("id")
      .maybeSingle();

    if (updateError || !updatedLead) {
      await removePaths(admin, "preview-sites", uploadedPaths).catch(() => {});
      if (updateError) throw updateError;
      return response(
        {
          error:
            "Este lead foi atualizado por outra pessoa. Recarregue e publique o ZIP novamente.",
        },
        409,
      );
    }

    const previousPreviewPrefix = previewStoragePrefixFromUrl(
      lead.preview_site_url,
    );
    const cleanupTasks: Promise<unknown>[] = [];
    if (
      typeof lead.preview_source_path === "string" &&
      lead.preview_source_path &&
      lead.preview_source_path !== sourcePath
    ) {
      cleanupTasks.push(
        (async () => {
          const { error } = await admin.storage
            .from("preview-zips")
            .remove([lead.preview_source_path]);
          if (error) throw error;
        })(),
      );
    }
    if (
      previousPreviewPrefix &&
      previousPreviewPrefix !== previewPathBase
    ) {
      cleanupTasks.push(
        listFiles(admin, "preview-sites", previousPreviewPrefix).then((paths) =>
          removePaths(admin, "preview-sites", paths),
        ),
      );
    }
    if (cleanupTasks.length) {
      const cleanupResults = await Promise.allSettled(cleanupTasks);
      if (cleanupResults.some((result) => result.status === "rejected")) {
        console.warn("[publish-preview] old preview cleanup incomplete", {
          leadId,
          version,
        });
      }
    }

    return response({
      success: true,
      previewUrl,
      previewSlug,
      previewPublicSlug,
      siteUrl: previewSiteUrl,
      version,
      entrypoint: entrypoint.path,
      relativePaths: !hasAbsoluteReferences(new TextDecoder().decode(entrypoint.bytes)),
      hasIndex: true,
      rewrittenFiles,
      candidates: null,
    });
  } catch (error) {
    console.error(error);
    return response({ error: "Não foi possível publicar o preview. Tente novamente." }, 500);
  }
});
