import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { unzipSync } from "npm:fflate@0.8.2";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 45 * 1024 * 1024;
const MAX_FILES = 300;

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const normalizeHandle = (value: string) =>
  `@${value.trim().replace(/^@+/, "").toLowerCase()}`;

const toSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const isSafePath = (path: string) =>
  Boolean(path) &&
  !path.startsWith("/") &&
  !path.startsWith("\\") &&
  !path.includes("\\") &&
  !path.includes(":") &&
  !path.split("/").some((part) => part === ".." || part === ".");

const contentTypeFor = (path: string) => {
  const extension = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
  };
  return types[extension ?? ""] ?? "application/octet-stream";
};

type Entry = { path: string; bytes: Uint8Array };

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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );
    const token = authorization.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return response({ error: "Sessão inválida. Entre no CRM novamente." }, 401);
    }

    if (!sourcePath.startsWith(`${leadId}/source/`)) {
      return response({ error: "Arquivo não pertence ao lead selecionado." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
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
    if (zipFile.size > MAX_ZIP_BYTES) {
      return response({ error: "O ZIP pode ter no máximo 20 MB." }, 400);
    }

    let extracted: Record<string, Uint8Array>;
    try {
      extracted = unzipSync(new Uint8Array(await zipFile.arrayBuffer()));
    } catch {
      return response({ error: "Não foi possível abrir este ZIP. Exporte novamente pelo Claude Design." }, 400);
    }

    const entries: Entry[] = Object.entries(extracted)
      .filter(([path, bytes]) =>
        isSafePath(path) &&
        !path.startsWith("__MACOSX/") &&
        !path.endsWith("/") &&
        bytes.byteLength > 0,
      )
      .map(([path, bytes]) => ({ path, bytes }));

    const totalBytes = entries.reduce((total, entry) => total + entry.bytes.byteLength, 0);
    if (entries.length === 0) {
      return response({ error: "O ZIP não possui arquivos de site para publicar." }, 400);
    }
    if (entries.length > MAX_FILES || totalBytes > MAX_UNCOMPRESSED_BYTES) {
      return response({ error: "O ZIP tem arquivos demais ou é grande demais após descompactar." }, 400);
    }

    const htmlEntries = entries.filter((entry) => /\.html?$/i.test(entry.path));
    const mainEntry =
      htmlEntries
        .filter((entry) => /(^|\/)index\.html?$/i.test(entry.path))
        .sort((a, b) => a.path.length - b.path.length)[0] ??
      htmlEntries.sort((a, b) => a.path.length - b.path.length)[0];
    if (!mainEntry) {
      return response({ error: "O ZIP precisa conter um arquivo HTML principal." }, 400);
    }

    const mainDirectory = mainEntry.path.includes("/")
      ? mainEntry.path.slice(0, mainEntry.path.lastIndexOf("/") + 1)
      : "";
    const entriesForPublish = entries
      .filter((entry) => !mainDirectory || entry.path.startsWith(mainDirectory))
      .map((entry) => ({
        ...entry,
        path: entry.path.slice(mainDirectory.length),
      }));

    const publishedMainPath = /(^|\/)index\.html?$/i.test(mainEntry.path)
      ? "index.html"
      : "index.html";
    const normalizedEntries = entriesForPublish.map((entry) =>
      entry.path === mainEntry.path.slice(mainDirectory.length)
        ? { ...entry, path: publishedMainPath }
        : entry,
    );

    const decodedHtml = new TextDecoder().decode(mainEntry.bytes);
    const usesAbsoluteAssetPaths = /(?:src|href)=["']\/(?!\/)|url\(["']?\/(?!\/)/i.test(decodedHtml);
    const version = (lead.preview_version ?? 0) + 1;
    const previewSlug = lead.preview_slug || toSlug(normalizeHandle(lead.handle));
    if (!previewSlug) {
      return response({ error: "Não foi possível criar o endereço do preview." }, 400);
    }
    const sitePrefix = `${previewSlug}/v${version}`;

    for (const entry of normalizedEntries) {
      const { error: uploadError } = await admin.storage
        .from("preview-sites")
        .upload(`${sitePrefix}/${entry.path}`, new Blob([entry.bytes]), {
          contentType: contentTypeFor(entry.path),
          cacheControl: entry.path === "index.html" ? "60" : "31536000",
          upsert: false,
        });
      if (uploadError) throw uploadError;
    }

    const siteUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/preview-sites/${sitePrefix}/index.html`;
    const previewUrl = `https://oblix-crm.vercel.app/preview/${previewSlug}`;
    const { error: updateError } = await admin
      .from("leads")
      .update({
        stage: "Preview",
        next_action: "Enviar acesso ao cliente",
        preview_url: previewUrl,
        preview_site_url: siteUrl,
        preview_source_path: sourcePath,
        preview_slug: previewSlug,
        preview_file_name: sourcePath.split("/").pop()?.replace(/^\d+-/, "") ?? "site.zip",
        preview_version: version,
        preview_published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
    if (updateError) throw updateError;

    return response({
      success: true,
      previewUrl,
      siteUrl,
      version,
      hasIndex: /(^|\/)index\.html?$/i.test(mainEntry.path),
      relativePaths: !usesAbsoluteAssetPaths,
      fileCount: normalizedEntries.length,
    });
  } catch (error) {
    console.error(error);
    return response({ error: "Não foi possível publicar o preview. Tente novamente." }, 500);
  }
});
