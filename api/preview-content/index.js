import { contentTypeFor } from "../../supabase/functions/publish-preview/engine.js";
import { verifyPreviewToken } from "../../supabase/functions/publish-preview/token.js";

const PREVIEW_BUCKET = process.env.PREVIEW_BUCKET || "preview-sites";
const MAX_PATH_SEGMENTS = 60;
const MAX_PATH_LENGTH = 3200;
const isTokenEnforced = () => process.env.PREVIEW_REQUIRE_TOKEN !== "false";
const getPreviewTokenSecret = () =>
  process.env.PREVIEW_TOKEN_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";
const getSupabaseUrl = () => process.env.SUPABASE_URL || "";
const getServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "private, no-store",
};

const JSON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  ...SECURITY_HEADERS,
};

const isMalformedEncoding = (value) =>
  /%2e|%2f|%5c|%3a/i.test(value);

const hasInvalidSegment = (segment) =>
  !segment ||
  segment === "." ||
  segment === ".." ||
  /%|\\/.test(segment) ||
  /[\x00-\x1f]/.test(segment);

const looksLikeToken = (segment) => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(segment);

const parsePathParts = (normalized, hadTrailingSlash) => {
  const parts = normalized
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);

  if (parts.length < 2) {
    return { ok: false, status: 404, error: "Versao do preview nao encontrada." };
  }
  if (parts.length > MAX_PATH_SEGMENTS) {
    return { ok: false, status: 400, error: "Path com muitos segmentos." };
  }

  let token = null;
  let slug;
  let version;
  let relativeParts;

  if (/^v\d+$/i.test(parts[0])) {
    return { ok: false, status: 400, error: "Path de preview invalido." };
  }

  if (/^v\d+$/i.test(parts[1])) {
    slug = parts[0];
    version = parts[1];
    relativeParts = parts.slice(2);
  } else if (parts.length > 2 && /^v\d+$/i.test(parts[2])) {
    token = parts[0];
    slug = parts[1];
    version = parts[2];
    relativeParts = parts.slice(3);
    if (!looksLikeToken(token)) {
      return { ok: false, status: 400, error: "Token de preview invalido." };
    }
  } else {
    return { ok: false, status: 404, error: "Versao do preview invalida." };
  }

  if (parts.some((part) => hasInvalidSegment(part))) {
    return { ok: false, status: 400, error: "Path com segmento invalido." };
  }

  return {
    ok: true,
    token,
    slug,
    version,
    parts,
    relativeParts,
    hasTrailingSlash: hadTrailingSlash,
    requiresToken: token === null,
    versionBase: `${token ? `${token}/` : ""}${slug}/${version}`,
  };
};

export const parsePreviewPath = (url) => {
  const raw = url.searchParams.has("path")
    ? url.searchParams.get("path") ?? ""
    : url.pathname.replace(/^\/(?:api\/)?preview-content\/?/, "");

  if (!raw) {
    return { ok: false, status: 400, error: "Caminho do preview nao informado." };
  }
  if (raw.length > MAX_PATH_LENGTH) {
    return { ok: false, status: 400, error: "Caminho do preview excede o limite." };
  }

  if (raw.startsWith("/") || raw.includes("\\") || raw.includes(":") || raw.startsWith("~")) {
    return { ok: false, status: 400, error: "Caminho do preview invalido." };
  }
  if (isMalformedEncoding(raw)) {
    return { ok: false, status: 400, error: "Caminho com codificacao invalida." };
  }

  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { ok: false, status: 400, error: "Caminho com encoding invalido." };
  }
  if (decoded.includes("\\") || decoded.includes(":") || decoded.includes("..")) {
    return { ok: false, status: 400, error: "Caminho do preview invalido." };
  }

  if (!decoded || decoded.length > MAX_PATH_LENGTH) {
    return { ok: false, status: 400, error: "Caminho do preview invalido." };
  }

  const normalized = decoded
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "");
  const normalizedHasTrailingSlash = normalized.endsWith("/");
  const normalizedNoTrailing = normalized
    .replace(/\/+$/, "")
    .replace(/^\.\//, "");

  if (!normalizedNoTrailing) {
    return { ok: false, status: 400, error: "Caminho do preview invalido." };
  }

  return parsePathParts(normalizedNoTrailing, normalizedHasTrailingSlash);
};

const toPublicPath = (relativePath) =>
  relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const storageUrlFor = (relativePath, bucket = PREVIEW_BUCKET) => {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${toPublicPath(relativePath)}`;
};

const storageCandidatesFor = (relativePath) => {
  const single = relativePath;
  const double = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(encodeURIComponent(segment)))
    .join("/");
  return single === double ? [single] : [single, double];
};

const fetchManifest = async (versionBase) => {
  const manifestPath = `${versionBase}/.oblix-preview-manifest.json`;
  let lastResponse = null;
  for (const encoded of storageCandidatesFor(manifestPath)) {
    const storageUrl = storageUrlFor(encoded);
    if (!storageUrl) return { ok: false, status: 500 };
    try {
      const response = await fetch(storageUrl, { method: "GET" });
      if (response.status === 404) {
        lastResponse = response;
        continue;
      }
      if (!response.ok) {
        lastResponse = response;
        continue;
      }
      const manifest = await response.json();
      return { ok: true, manifest };
    } catch {
      lastResponse = { status: 502 };
    }
  }
  return { ok: false, status: lastResponse?.status === 200 ? 404 : 502 };
};

const makeResponse = (status, body, headers = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });

const manifestToSet = (manifest) => {
  if (!manifest || typeof manifest !== "object") {
    return { files: null, entrypoint: null };
  }
  return {
    entrypoint: manifest.entrypoint?.path ?? null,
    files: Array.isArray(manifest.files)
      ? new Set(
          manifest.files
            .map((file) => file?.path)
            .filter((file) => Boolean(file))
            .map((path) => String(path)),
        )
      : null,
  };
};

const resolveCandidates = (state, hasTrailingSlash) => {
  const { manifest, relativeParts } = state;
  if (!hasTrailingSlash) {
    if (relativeParts.length === 0) {
      if (manifest?.entrypoint) return [manifest.entrypoint];
      return ["index.html"];
    }
    return [relativeParts.join("/")];
  }

  const current = relativeParts.join("/");
  const directory = current ? `${current}/` : "";
  if (!current) {
    return manifest?.entrypoint ? [manifest.entrypoint] : ["index.html"];
  }
  return [`${directory}index.html`, `${directory}index.htm`];
};

const isCandidateAllowed = (manifest, candidate) => {
  if (!manifest?.files) return true;
  return manifest.files.has(candidate);
};

const fetchFromStorage = async (versionBase, candidates, requestMethod, rangeHeader) => {
  let lastStatus = 500;
  const requestHeaders = {};
  if (rangeHeader) requestHeaders.Range = rangeHeader;

  for (const candidate of candidates) {
    const prefixed = `${versionBase}/${candidate}`.replace(/\/{2,}/g, "/");
    const encodedCandidates = storageCandidatesFor(prefixed);

    for (const candidateEncoded of encodedCandidates) {
      const storageUrl = storageUrlFor(candidateEncoded);
      if (!storageUrl) return { status: 500 };
      try {
        const upstream = await fetch(storageUrl, {
          method: requestMethod,
          headers: requestHeaders,
        });
        if (upstream.status === 404) {
          lastStatus = 404;
          continue;
        }
        if (!upstream.ok && upstream.status !== 206 && requestMethod === "GET") {
          lastStatus = upstream.status;
          continue;
        }
        return { upstream, candidate };
      } catch {
        lastStatus = 500;
      }
    }
  }
  return { status: lastStatus, candidate: candidates[0] ?? null };
};

const passThroughHeaders = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "etag",
  "last-modified",
  "content-encoding",
];

const proxyResponse = (upstream, request, requestedPath) => {
  const responseHeaders = new Headers();
  for (const headerName of passThroughHeaders) {
    const value = upstream.headers.get(headerName);
    if (value) responseHeaders.set(headerName, value);
  }
  responseHeaders.set("Content-Type", contentTypeFor(requestedPath));
  responseHeaders.set("Content-Disposition", "inline");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  Object.entries(SECURITY_HEADERS).forEach(([headerName, value]) => {
    responseHeaders.set(headerName, value);
  });

  if (request.method === "HEAD") {
    responseHeaders.delete("Content-Length");
    return new Response(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};

const getCurrentLeadState = async ({ slug, version }) => {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    return {
      ok: false,
      status: 500,
      reason: "Variáveis de serviço indisponíveis para validação da versão.",
    };
  }
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      reason: "Chave de serviço indisponível para validação da versão do preview.",
    };
  }

  const encodedSlug = encodeURIComponent(slug);
  const requestUrl = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/leads?select=preview_slug,preview_version&preview_slug=eq.${encodedSlug}&limit=1`;
  const response = await fetch(requestUrl, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      reason: "Não foi possível validar a versão atual do preview.",
    };
  }

  const rows = await response.json();
  const lead = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!lead) {
    return { ok: false, status: 404, reason: "Lead do preview não encontrado." };
  }

  const currentVersion = Number.parseInt(`${lead.preview_version}`.replace(/^v/i, ""), 10);
  const requestedVersion = Number.parseInt(version.replace(/^v/i, ""), 10);
  if (
    Number.isNaN(currentVersion) ||
    Number.isNaN(requestedVersion) ||
    currentVersion !== requestedVersion
  ) {
    return {
      ok: false,
      status: 403,
      reason:
        "Este link foi desatualizado. Gere um novo preview antes de enviar ao cliente.",
    };
  }

  if (`${lead.preview_slug}` !== `${slug}`) {
    return { ok: false, status: 403, reason: "Slug inválido para esta preview." };
  }

  return { ok: true };
};

const verifyRequestAccess = async ({ token, slug, version }) => {
  if (!isTokenEnforced()) return { ok: true };
  if (!token) {
    return { ok: false, status: 401, reason: "Token de acesso inexistente." };
  }

  const result = await verifyPreviewToken({
    token,
    slug,
    version,
    secret: getPreviewTokenSecret(),
  });
  if (!result.ok) {
    return { ok: false, status: 403, reason: result.reason ?? "Acesso negado." };
  }

  const versionCheck = await getCurrentLeadState({ slug, version });
  if (!versionCheck.ok) {
    return {
      ok: false,
      status: versionCheck.status ?? 403,
      reason: versionCheck.reason ?? "Acesso negado.",
    };
  }

  return { ok: true, result };
};

const createHandler = () => async (request) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return makeResponse(405, { error: "Metodo nao permitido." }, { Allow: "GET, HEAD, OPTIONS" });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  const parsed = parsePreviewPath(new URL(request.url));
  if (!parsed.ok) {
    return makeResponse(parsed.status, { error: parsed.error });
  }

  if (!getSupabaseUrl()) {
    return makeResponse(500, { error: "Variaveis do storage nao configuradas." });
  }

  const { version, relativeParts, slug, hasTrailingSlash, versionBase, token, requiresToken } = parsed;

  if (isTokenEnforced() && requiresToken) {
    return makeResponse(401, { error: "Token de acesso inexistente." });
  }

  const authorization = await verifyRequestAccess({ token, slug, version });
  if (!authorization.ok) {
    return makeResponse(authorization.status, { error: authorization.reason });
  }

  const relativeCount = relativeParts.length;
  if (!hasTrailingSlash && relativeCount === 0) {
    const requestUrl = new URL(request.url);
    const redirectTo = `${requestUrl.origin}/preview-content/${versionBase}/`;
    const search = new URLSearchParams(requestUrl.searchParams);
    search.delete("path");
    const nextQuery = search.toString();
    return new Response(null, {
      status: 308,
      headers: {
        ...JSON_HEADERS,
        Location: nextQuery ? `${redirectTo}?${nextQuery}` : redirectTo,
      },
    });
  }

  const manifestResult = await fetchManifest(versionBase);
  if (!manifestResult.ok && manifestResult.status >= 500) {
    return makeResponse(manifestResult.status, {
      error: "Nao foi possivel carregar manifest do preview.",
    });
  }

  const manifest = manifestToSet(manifestResult.ok ? manifestResult.manifest : null);
  const state = { manifest, relativeParts };
  let candidates = resolveCandidates(state, hasTrailingSlash);
  candidates = [...new Set(candidates)];

  const allowedCandidates = candidates.filter((candidate) =>
    isCandidateAllowed(manifest, candidate),
  );
  if (allowedCandidates.length === 0) {
    return makeResponse(404, {
      error: "Arquivo nao encontrado no preview dessa versao.",
    });
  }

  const method = request.method === "HEAD" ? "HEAD" : "GET";
  const upstreamResponse = await fetchFromStorage(
    versionBase,
    allowedCandidates,
    method,
    request.headers.get("range") || undefined,
  );

  if (!upstreamResponse.upstream) {
    const status = upstreamResponse.status === 404 || upstreamResponse.status === 206
      ? 404
      : 502;
    return makeResponse(status, {
      error: "Arquivo nao encontrado.",
    });
  }

  const requestedPath = upstreamResponse.candidate ?? relativeParts.join("/");
  return proxyResponse(upstreamResponse.upstream, request, requestedPath);
};

export const GET = createHandler();
export const HEAD = createHandler();
export const OPTIONS = createHandler();
