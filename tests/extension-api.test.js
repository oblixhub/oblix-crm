import assert from "node:assert/strict";
import test from "node:test";
import { createHealthHandler } from "../api/extension/health.js";
import { createLeadHandler } from "../api/extension/leads.js";

const env = {
  OBLIX_EXTENSION_TOKEN_HUGO: "hugo-test-token-with-enough-entropy",
  OBLIX_EXTENSION_TOKEN_SOCIA: "socia-test-token-with-enough-entropy",
  OBLIX_EXTENSION_DEFAULT_COUNTRY: "55",
  OBLIX_EXTENSION_RATE_LIMIT_HOURLY: "120",
};

const validPayload = {
  instagramUsername: "alineestetica",
  instagramUrl: "https://www.instagram.com/alineestetica/",
  whatsappRaw: "https://wa.me/5573999999999?text=Olá",
  whatsappNumber: "5573999999999",
  whatsappUrl: "https://wa.me/5573999999999",
  priority: "normal",
  websiteStatus: "unknown",
  notes: "",
  source: "chrome_extension",
  extensionVersion: "1.0.0",
};

function requestFor(payload = validPayload, token = env.OBLIX_EXTENSION_TOKEN_HUGO) {
  return new Request("https://sites.oblixhub.com/api/extension/leads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function createRepository(overrides = {}) {
  return {
    findByUsername: async () => null,
    countRecentCaptures: async () => 0,
    getExtensionBatchId: async () => "batch-extension",
    createLead: async (payload) => ({ id: "lead-1", handle: payload.handle }),
    ...overrides,
  };
}

test("health aceita token válido e identifica o operador", async () => {
  const handler = createHealthHandler({ env });
  const response = await handler(
    new Request("https://sites.oblixhub.com/api/extension/health", {
      headers: { Authorization: `Bearer ${env.OBLIX_EXTENSION_TOKEN_HUGO}` },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, operator: "Hugo" });
});

test("health e leads rejeitam token inválido", async () => {
  const health = createHealthHandler({ env });
  const healthResponse = await health(
    new Request("https://sites.oblixhub.com/api/extension/health", {
      headers: { Authorization: "Bearer errado" },
    }),
  );
  assert.equal(healthResponse.status, 401);

  const leads = createLeadHandler({
    env,
    repositoryFactory: () => createRepository(),
  });
  assert.equal((await leads(requestFor(validPayload, "errado"))).status, 401);
});

test("cria lead válido com operador, origem e campos normalizados", async () => {
  let inserted = null;
  const handler = createLeadHandler({
    env,
    now: () => new Date("2026-07-27T15:00:00.000Z"),
    repositoryFactory: () =>
      createRepository({
        createLead: async (payload) => {
          inserted = payload;
          return { id: "lead-1", handle: payload.handle };
        },
      }),
  });

  const response = await handler(requestFor());
  assert.equal(response.status, 201);
  assert.equal(inserted.handle, "@alineestetica");
  assert.equal(inserted.owner, "Você");
  assert.equal(inserted.source_type, "chrome_extension");
  assert.equal(inserted.whatsapp_number, "5573999999999");
  assert.equal(inserted.batch_id, "batch-extension");
});

test("rejeita Instagram inválido", async () => {
  const handler = createLeadHandler({
    env,
    repositoryFactory: () => createRepository(),
  });
  const response = await handler(
    requestFor({
      ...validPayload,
      instagramUsername: "direct",
      instagramUrl: "https://www.instagram.com/direct/inbox/",
    }),
  );
  assert.equal(response.status, 400);
});

test("aceita lead sem WhatsApp e ignora WhatsApp inválido", async () => {
  const insertedRows = [];
  const handler = createLeadHandler({
    env,
    repositoryFactory: () =>
      createRepository({
        createLead: async (payload) => {
          insertedRows.push(payload);
          return { id: `lead-${insertedRows.length}` };
        },
      }),
  });

  const noWhatsapp = await handler(
    requestFor({ ...validPayload, whatsappRaw: "", whatsappNumber: "", whatsappUrl: "" }),
  );
  assert.equal(noWhatsapp.status, 201);
  assert.equal(insertedRows[0].whatsapp_number, null);

  const invalidWhatsapp = await handler(
    requestFor({
      ...validPayload,
      instagramUsername: "outroperfil",
      instagramUrl: "https://www.instagram.com/outroperfil/",
      whatsappRaw: "fale conosco",
      whatsappNumber: "",
      whatsappUrl: "",
    }),
  );
  assert.equal(invalidWhatsapp.status, 201);
  assert.equal(insertedRows[1].whatsapp_number, null);
  assert.deepEqual((await invalidWhatsapp.json()).warnings, ["whatsapp_ignored"]);
});

test("retorna duplicidade existente", async () => {
  const handler = createLeadHandler({
    env,
    repositoryFactory: () =>
      createRepository({
        findByUsername: async () => ({ id: "existing-lead" }),
      }),
  });
  const response = await handler(requestFor());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).leadId, "existing-lead");
});

test("aplica limite horário persistente", async () => {
  const handler = createLeadHandler({
    env: { ...env, OBLIX_EXTENSION_RATE_LIMIT_HOURLY: "2" },
    repositoryFactory: () =>
      createRepository({
        countRecentCaptures: async () => 2,
      }),
  });
  const response = await handler(requestFor());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "3600");
});

test("controla erro do banco sem expor detalhes", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const handler = createLeadHandler({
      env,
      repositoryFactory: () =>
        createRepository({
          createLead: async () => {
            const error = new Error("secret database detail");
            error.code = "XX000";
            throw error;
          },
        }),
    });
    const response = await handler(requestFor());
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(JSON.stringify(body).includes("secret database detail"), false);
  } finally {
    console.error = originalError;
  }
});

test("constraint única protege tentativas simultâneas", async () => {
  const created = new Set();
  const repository = createRepository({
    findByUsername: async (username) =>
      created.has(username) ? { id: "lead-race" } : null,
    createLead: async (payload) => {
      await Promise.resolve();
      const username = payload.handle.replace(/^@/, "");
      if (created.has(username)) {
        const error = new Error("duplicate");
        error.code = "23505";
        throw error;
      }
      created.add(username);
      return { id: "lead-race" };
    },
  });

  const handler = createLeadHandler({
    env,
    repositoryFactory: () => repository,
  });
  const [first, second] = await Promise.all([
    handler(requestFor()),
    handler(requestFor()),
  ]);
  assert.deepEqual(
    [first.status, second.status].sort((a, b) => a - b),
    [201, 409],
  );
});
