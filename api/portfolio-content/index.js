import { contentTypeFor } from "../../supabase/functions/publish-preview/engine.js";

const BUCKET = process.env.PORTFOLIO_SITES_BUCKET || "portfolio-sites";
const MAX_PATH_SEGMENTS = 60;
const MAX_PATH_LENGTH = 3200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getSupabaseUrl = () => process.env.SUPABASE_URL || "";
const getServiceKey = () =>
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Content-Security-Policy":
    "default-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; media-src 'self' data: blob: https:; connect-src https:; frame-src https:; form-action https:; base-uri 'self'; frame-ancestors 'self' https://sites.oblixhub.com https://*.vercel.app http://127.0.0.1:*",
};

const JSON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=30, s-maxage=60",
  ...SECURITY_HEADERS,
};

const makeResponse = (status, body, headers = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });

const encodePath = (path) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const parsePath = (requestUrl) => {
  const raw = requestUrl.searchParams.has("path")
    ? requestUrl.searchParams.get("path") ?? ""
    : requestUrl.pathname.replace(/^\/(?:api\/)?portfolio-content\/?/, "");
  if (!raw || raw.length > MAX_PATH_LENGTH || raw.includes("\\")) {
    return { ok: false, status: 400, error: "Caminho inválido." };
  }
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { ok: false, status: 400, error: "Caminho inválido." };
  }
  if (
    decoded.startsWith("/") ||
    decoded.includes("\\") ||
    decoded.includes(":") ||
    decoded.includes("..") ||
    /[\x00-\x1f]/.test(decoded)
  ) {
    return { ok: false, status: 400, error: "Caminho inválido." };
  }
  const trailingSlash = decoded.endsWith("/");
  const parts = decoded
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (
    parts.length < 2 ||
    parts.length > MAX_PATH_SEGMENTS ||
    !UUID_PATTERN.test(parts[0]) ||
    !/^v\d+$/i.test(parts[1]) ||
    parts.some((part) => !part || part === "." || part === ".." || /%|\\/.test(part))
  ) {
    return { ok: false, status: 404, error: "Versão não encontrada." };
  }
  return {
    ok: true,
    publicKey: parts[0],
    version: parts[1].toLowerCase(),
    relativeParts: parts.slice(2),
    trailingSlash,
    storagePrefix: `${parts[0]}/${parts[1].toLowerCase()}`,
  };
};

export const parsePortfolioContentPath = parsePath;

const serviceFetch = async (path, options = {}) => {
  const supabaseUrl = getSupabaseUrl().replace(/\/+$/, "");
  const serviceKey = getServiceKey();
  return fetch(
    `${supabaseUrl}/storage/v1/object/${BUCKET}/${encodePath(path)}`,
    {
      ...options,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(options.headers || {}),
      },
    },
  );
};

const getProject = async ({ publicKey, version }) => {
  const supabaseUrl = getSupabaseUrl().replace(/\/+$/, "");
  const serviceKey = getServiceKey();
  const versionNumber = Number.parseInt(version.replace(/^v/, ""), 10);
  const requestUrl = new URL(`${supabaseUrl}/rest/v1/portfolio_projects`);
  requestUrl.searchParams.set(
    "select",
    "id,public_key,current_version,status",
  );
  requestUrl.searchParams.set("public_key", `eq.${publicKey}`);
  requestUrl.searchParams.set("limit", "1");
  const upstream = await fetch(requestUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!upstream.ok) return { ok: false, status: 502 };
  const rows = await upstream.json();
  const project = Array.isArray(rows) ? rows[0] : null;
  if (!project) return { ok: false, status: 404 };
  if (
    project.status !== "published" ||
    Number(project.current_version) !== versionNumber
  ) {
    return { ok: false, status: 404 };
  }
  return { ok: true, project };
};

const readManifest = async (storagePrefix) => {
  const response = await serviceFetch(
    `${storagePrefix}/.oblix-preview-manifest.json`,
  );
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const manifestFiles = (manifest) =>
  new Set(
    Array.isArray(manifest?.files)
      ? manifest.files.map((file) => file?.path).filter(Boolean)
      : [],
  );

const resolveCandidates = ({ manifest, relativeParts, trailingSlash }) => {
  if (relativeParts.length === 0) {
    return [manifest?.entrypoint?.path || "index.html"];
  }
  const current = relativeParts.join("/");
  return trailingSlash
    ? [`${current}/index.html`, `${current}/index.htm`]
    : [current];
};

const passThroughHeaders = [
  "accept-ranges",
  "content-length",
  "content-range",
  "etag",
  "last-modified",
  "content-encoding",
];

const createHandler = () => async (request) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return makeResponse(405, { error: "Método não permitido." }, {
      Allow: "GET, HEAD, OPTIONS",
    });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }
  if (!getSupabaseUrl() || !getServiceKey()) {
    return makeResponse(500, { error: "Publicação indisponível." });
  }

  const parsed = parsePath(new URL(request.url));
  if (!parsed.ok) return makeResponse(parsed.status, { error: parsed.error });

  const projectState = await getProject(parsed);
  if (!projectState.ok) {
    return makeResponse(projectState.status, {
      error: "Projeto não encontrado ou fora de publicação.",
    });
  }

  if (!parsed.trailingSlash && parsed.relativeParts.length === 0) {
    const requestUrl = new URL(request.url);
    const location = `${requestUrl.origin}/portfolio-content/${parsed.storagePrefix}/`;
    return new Response(null, {
      status: 308,
      headers: { ...JSON_HEADERS, Location: location },
    });
  }

  const manifest = await readManifest(parsed.storagePrefix);
  if (!manifest) {
    return makeResponse(502, { error: "Manifesto do projeto indisponível." });
  }
  const allowed = manifestFiles(manifest);
  const candidates = resolveCandidates({ ...parsed, manifest }).filter(
    (candidate) => allowed.size === 0 || allowed.has(candidate),
  );
  if (candidates.length === 0) {
    return makeResponse(404, { error: "Arquivo não encontrado." });
  }

  let upstream = null;
  let requestedPath = candidates[0];
  for (const candidate of candidates) {
    const result = await serviceFetch(`${parsed.storagePrefix}/${candidate}`, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers: request.headers.get("range")
        ? { Range: request.headers.get("range") }
        : {},
    });
    if (result.ok || result.status === 206) {
      upstream = result;
      requestedPath = candidate;
      break;
    }
  }
  if (!upstream) return makeResponse(404, { error: "Arquivo não encontrado." });

  const responseHeaders = new Headers(SECURITY_HEADERS);
  for (const name of passThroughHeaders) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("Content-Type", contentTypeFor(requestedPath));
  responseHeaders.set("Content-Disposition", "inline");
  responseHeaders.set(
    "Cache-Control",
    /\.(?:html?|json)$/i.test(requestedPath)
      ? "public, max-age=60, s-maxage=300"
      : "public, max-age=31536000, immutable",
  );

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};

export const GET = createHandler();
export const HEAD = createHandler();
export const OPTIONS = createHandler();
