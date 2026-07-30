import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { unzipSync } from "npm:fflate@0.8.2";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildPreviewManifest,
  contentTypeFor,
  encodePathForStorage,
  parseZipEntries,
} from "../publish-preview/engine.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 8;

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const getNamedKey = (
  name: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS",
) => {
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

const publicAppOrigin = (request: Request) => {
  const configured = (
    Deno.env.get("PORTFOLIO_CONTENT_ORIGIN") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    Deno.env.get("VITE_PUBLIC_APP_URL")
  )?.replace(/\/+$/, "");
  if (configured) return configured;
  return new URL(request.url).origin.replace(/\/+$/, "");
};

const removePaths = async (
  admin: ReturnType<typeof createClient>,
  paths: string[],
) => {
  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    const { error } = await admin.storage.from("portfolio-sites").remove(chunk);
    if (error) throw error;
  }
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
      return response({ error: "Faça login para publicar o projeto." }, 401);
    }

    const body = (await request.json()) as { projectId?: unknown };
    if (typeof body.projectId !== "string") {
      return response({ error: "Projeto inválido." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = getPublishableKey();
    const secretKey = getSecretKey();
    if (!supabaseUrl || !publishableKey || !secretKey) {
      return response(
        { error: "Configuração de publicação indisponível." },
        500,
      );
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const userToken = authorization.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await userClient.auth.getUser(userToken);
    if (userError || !userData.user) {
      return response({ error: "Sua sessão expirou. Entre novamente." }, 401);
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (profileError || profile?.role !== "owner") {
      return response(
        { error: "Somente os sócios podem publicar no portfólio." },
        403,
      );
    }

    const admin = createClient(supabaseUrl, secretKey);
    const { data: project, error: projectError } = await admin
      .from("portfolio_projects")
      .select(
        "id, lead_id, slug, source_type, source_path, public_key, current_version, publication_authorized",
      )
      .eq("id", body.projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) return response({ error: "Projeto não encontrado." }, 404);
    if (!project.publication_authorized) {
      return response(
        {
          error:
            "Confirme a autorização de publicação antes de colocar o projeto no ar.",
        },
        400,
      );
    }
    if (!project.source_path) {
      return response({ error: "Envie ou selecione um arquivo ZIP." }, 400);
    }

    const sourceBucket =
      project.source_type === "lead_preview"
        ? "preview-zips"
        : "portfolio-zips";
    const expectedPrefix =
      project.source_type === "lead_preview"
        ? `${project.lead_id}/source/`
        : `${project.id}/source/`;
    if (!project.source_path.startsWith(expectedPrefix)) {
      return response(
        { error: "O arquivo ZIP não pertence a este projeto." },
        400,
      );
    }

    const { data: zipFile, error: zipError } = await admin.storage
      .from(sourceBucket)
      .download(project.source_path);
    if (zipError) throw zipError;
    if (!zipFile) return response({ error: "ZIP não encontrado." }, 404);
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
    const version = Number(project.current_version ?? 0) + 1;
    const storagePrefix = `${project.public_key}/v${version}`;
    const manifest = buildPreviewManifest({
      previewSlug: project.slug,
      version,
      leadId: project.id,
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
            const filePath = `${storagePrefix}/${encodePathForStorage(
              entry.path,
            )}`;
            const { error } = await admin.storage
              .from("portfolio-sites")
              .upload(filePath, new Blob([entry.bytes]), {
                contentType: contentTypeFor(entry.path),
                cacheControl:
                  entry.path === entrypoint.path ? "60" : "31536000",
                upsert: false,
              });
            if (error) throw error;
            uploadedPaths.push(filePath);
          }),
        );
      }

      const manifestPath = `${storagePrefix}/.oblix-preview-manifest.json`;
      const { error: manifestError } = await admin.storage
        .from("portfolio-sites")
        .upload(manifestPath, new Blob([JSON.stringify(manifest)]), {
          contentType: "application/json; charset=utf-8",
          cacheControl: "60",
          upsert: false,
        });
      if (manifestError) throw manifestError;
      uploadedPaths.push(manifestPath);
    } catch (uploadError) {
      await removePaths(admin, uploadedPaths).catch(() => {});
      console.error("[publish-portfolio] upload failed", {
        projectId: project.id,
        version,
        error:
          uploadError instanceof Error
            ? uploadError.message
            : String(uploadError),
      });
      return response({ error: "Falha ao salvar os arquivos do site." }, 500);
    }

    const contentUrl = `${publicAppOrigin(
      request,
    )}/portfolio-content/${project.public_key}/v${version}/`;
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await admin
      .from("portfolio_projects")
      .update({
        current_version: version,
        content_url: contentUrl,
        status: "published",
        published_at: now,
        updated_at: now,
      })
      .eq("id", project.id)
      .eq("current_version", project.current_version ?? 0)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      await removePaths(admin, uploadedPaths).catch(() => {});
      return response(
        {
          error:
            "Este projeto foi alterado em outra aba. Recarregue e publique novamente.",
        },
        409,
      );
    }

    const { error: versionError } = await admin
      .from("portfolio_versions")
      .insert({
        project_id: project.id,
        version,
        storage_prefix: storagePrefix,
        entrypoint: entrypoint.path,
        source_path: project.source_path,
        published_by: userData.user.id,
        published_at: now,
      });
    if (versionError) {
      console.warn("[publish-portfolio] version history failed", {
        projectId: project.id,
        version,
        error: versionError.message,
      });
    }

    return response({
      success: true,
      version,
      contentUrl,
      entrypoint: entrypoint.path,
      rewrittenFiles,
      removedOuterFolder: removedOuterFolder ?? null,
    });
  } catch (error) {
    console.error("[publish-portfolio] unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return response(
      { error: "Não foi possível publicar o projeto. Tente novamente." },
      500,
    );
  }
});
