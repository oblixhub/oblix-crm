import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewToken } from "../supabase/functions/publish-preview/token.js";
import { GET, parsePreviewPath } from "../api/preview-content/index.js";

const ORIGINAL_ENV = { ...process.env };
const previewOrigin = "https://xxvjmxjbqhbkesjcrudb.supabase.co";
const bucket = "preview-sites";
const secret = "unit-test-preview-secret";
const serviceRoleKey = "unit-test-service-role-key";
const slug = "catty";
const version = "v1";
const leadId = "lead-123";

const manifest = {
  version: "1",
  leadId,
  previewSlug: slug,
  entrypoint: {
    path: "Landing Page Catty Lopes.dc.html",
  },
  files: [
    { path: "Landing Page Catty Lopes.dc.html" },
    { path: "support.js" },
    { path: "assets/logo.svg" },
    { path: "images/avatar.png" },
    { path: "styles/main.css" },
  ],
};

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PREVIEW_REQUIRE_TOKEN;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.PREVIEW_TOKEN_SECRET;
  delete process.env.SUPABASE_URL;
});

const mockFetchWithManifest = (token = "") => {
  const storageBase = `${previewOrigin}/storage/v1/object/public/${bucket}`;
  const storageScope = token ? `${encodeURIComponent(token)}/` : "";
  const requests = [];
  global.fetch = async (url, init = {}) => {
    const resolved = new URL(url, "https://xxvjmxjbqhbkesjcrudb.supabase.co");
    requests.push({ method: init?.method ?? "GET", href: resolved.href });

    const decoded = decodeURIComponent(resolved.pathname);
    const pathname = decoded;
    if (pathname.includes("/rest/v1/leads")) {
      const leadRows = [
        {
          preview_slug: slug,
          preview_version: 1,
        },
      ];
      return new Response(JSON.stringify(leadRows), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (decoded.includes(".oblix-preview-manifest.json")) {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (
      resolved.href.includes(
        `${storageBase}/${storageScope}${slug}/v1/Landing%20Page%20Catty%20Lopes.dc.html`,
      )
    ) {
      return new Response("<!doctype html><html><body>catty</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (
      resolved.href.includes(`${storageBase}/${storageScope}${slug}/v1/support.js`)
    ) {
      return new Response("console.log('ok');", {
        status: 200,
        headers: { "Content-Type": "text/javascript; charset=utf-8" },
      });
    }

    if (
      resolved.href.includes(`${storageBase}/${storageScope}${slug}/v1/styles/main.css`)
    ) {
      return new Response("body{background:#fff;}", {
        status: 200,
        headers: { "Content-Type": "text/css; charset=utf-8" },
      });
    }

    if (
      resolved.href.includes(`${storageBase}/${storageScope}${slug}/v1/assets/logo.svg`)
    ) {
      return new Response("<svg></svg>", {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      });
    }

    if (
      resolved.href.includes(`${storageBase}/${storageScope}${slug}/v1/images/avatar.png`)
    ) {
      return new Response("", {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }

    if (resolved.href.includes(`${storageBase}/${storageScope}${slug}/v2/`)) {
      return new Response("", { status: 404 });
    }

    return new Response("arquivo nao encontrado", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  };

  return requests;
};

const mockFetchWithCustomLeadState = ({
  leadVersion = 1,
  leadSlug = slug,
  token,
}) => {
  const mocked = mockFetchWithManifest(token);
  const originalFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    const requestUrl = new URL(url, "https://xxvjmxjbqhbkesjcrudb.supabase.co");
    if (requestUrl.pathname.includes("/rest/v1/leads")) {
      const leadRows = [
        {
          preview_slug: leadSlug,
          preview_version: leadVersion,
        },
      ];
      return new Response(JSON.stringify(leadRows), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return originalFetch(url, init);
  };
  return mocked;
};

test("parse da rota /preview-content/{slug}/v{n}/ com barra final", () => {
  const parsed = parsePreviewPath(
    new URL("https://sites.oblixhub.com/preview-content/leticia/v3/"),
  );
  assert.equal(parsed.ok, true);
  assert.equal(parsed.slug, "leticia");
  assert.equal(parsed.version, "v3");
  assert.equal(parsed.hasTrailingSlash, true);
  assert.equal(parsed.token, null);
});

test("parse da rota com token no segmento e versao", async () => {
  const token = await createPreviewToken({
    slug: "catty",
    version: "v1",
    leadId,
    secret,
    expiresAt: Math.floor(Date.now() / 1000) + 1200,
  });
  const parsed = parsePreviewPath(
    new URL(
      `https://sites.oblixhub.com/preview-content/${token}/catty/v1/Landing%20Page%20Catty%20Lopes.dc.html`,
    ),
  );
  assert.equal(parsed.ok, true);
  assert.equal(parsed.slug, "catty");
  assert.equal(parsed.version, "v1");
  assert.equal(parsed.token, token);
  assert.equal(parsed.relativeParts.join("/"), "Landing Page Catty Lopes.dc.html");
});

test("rota sem barra no fim retorna redirecionamento para trailing slash", async () => {
  process.env.SUPABASE_URL = previewOrigin;
  process.env.PREVIEW_TOKEN_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const token = await createPreviewToken({
    slug,
    version,
    leadId,
    secret,
    expiresAt: Math.floor(Date.now() / 1000) + 1200,
  });
  mockFetchWithManifest(token);
  const response = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1`,
    ),
  );
  assert.equal(response.status, 308);
  const location = response.headers.get("Location");
  assert.equal(
    location,
    `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/`,
  );
});

test("acesso autorizado a HTML da versao correta", async () => {
  process.env.SUPABASE_URL = previewOrigin;
  process.env.PREVIEW_TOKEN_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const token = await createPreviewToken({
    slug,
    version,
    leadId,
    secret,
    expiresAt: Math.floor(Date.now() / 1000) + 1200,
  });
  mockFetchWithManifest(token);
  const response = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/`,
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const html = await response.text();
  assert.equal(html.includes("catty"), true);
});

test("acesso autorizado a CSS, JS e imagem", async () => {
  process.env.SUPABASE_URL = previewOrigin;
  process.env.PREVIEW_TOKEN_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const token = await createPreviewToken({
    slug,
    version,
    leadId,
    secret,
    expiresAt: Math.floor(Date.now() / 1000) + 1200,
  });
  mockFetchWithManifest(token);
  const css = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/styles/main.css`,
    ),
  );
  const js = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/support.js`,
    ),
  );
  const image = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/assets/logo.svg`,
    ),
  );
  assert.equal(css.status, 200);
  assert.equal(css.headers.get("content-type"), "text/css; charset=utf-8");
  assert.equal(js.status, 200);
  assert.equal(js.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/svg+xml");
});

test("acesso sem token retorna 401", async () => {
  process.env.SUPABASE_URL = previewOrigin;
  process.env.PREVIEW_TOKEN_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const response = await GET(
    new Request("https://sites.oblixhub.com/preview-content/catty/v1/"),
  );
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, "Token de acesso inexistente.");
});

test("acesso com token expirado retorna erro apropriado", async () => {
  process.env.SUPABASE_URL = previewOrigin;
  process.env.PREVIEW_TOKEN_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const token = await createPreviewToken({
    slug,
    version,
    leadId,
    secret,
    expiresAt: Math.floor(Date.now() / 1000) - 5,
  });
  mockFetchWithManifest(token);
  const response = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/`,
    ),
  );
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "Token expirado.");
});

test("token revogado (slug/versao inválidos após republicação) é bloqueado", async () => {
  process.env.SUPABASE_URL = previewOrigin;
  process.env.PREVIEW_TOKEN_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const token = await createPreviewToken({
    slug,
    version,
    leadId,
    secret,
    expiresAt: Math.floor(Date.now() / 1000) + 1200,
  });
  mockFetchWithCustomLeadState({
    leadVersion: 2,
    leadSlug: slug,
    token,
  });
  const response = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/`,
    ),
  );
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(
    body.error,
    "Este link foi desatualizado. Gere um novo preview antes de enviar ao cliente.",
  );
});

test("token de outra versao nao acessa esta rota (403)", async () => {
  process.env.SUPABASE_URL = previewOrigin;
  process.env.PREVIEW_TOKEN_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const token = await createPreviewToken({
    slug,
    version: "v2",
    leadId,
    secret,
    expiresAt: Math.floor(Date.now() / 1000) + 1200,
  });
  mockFetchWithManifest(token);
  const response = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/`,
    ),
  );
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "Token invalido para esta versao.");
});

test("token do slug diferente nao acessa (403)", async () => {
  process.env.SUPABASE_URL = previewOrigin;
  process.env.PREVIEW_TOKEN_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const token = await createPreviewToken({
    slug: "outra",
    version,
    leadId,
    secret,
    expiresAt: Math.floor(Date.now() / 1000) + 1200,
  });
  mockFetchWithManifest(token);
  const response = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/`,
    ),
  );
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "Token invalido para este lead.");
});

test("acesso inexistente retorna 404 para arquivo nao listado no manifest", async () => {
  process.env.SUPABASE_URL = previewOrigin;
  process.env.PREVIEW_TOKEN_SECRET = secret;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  const token = await createPreviewToken({
    slug,
    version,
    leadId,
    secret,
    expiresAt: Math.floor(Date.now() / 1000) + 1200,
  });
  mockFetchWithManifest(token);
  const response = await GET(
    new Request(
      `https://sites.oblixhub.com/preview-content/${encodeURIComponent(token)}/catty/v1/sem-arquivo.html`,
    ),
  );
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.error, "Arquivo nao encontrado no preview dessa versao.");
});
