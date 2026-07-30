import assert from "node:assert/strict";
import test from "node:test";
import {
  createPreviewToken,
  parsePreviewToken,
  verifyPreviewToken,
} from "../supabase/functions/publish-preview/token.js";

const input = {
  slug: "cliente-teste",
  version: "v1",
  leadId: "lead-123",
  expiresAt: Math.floor(Date.now() / 1000) + 1200,
  secret: "preview-test-secret",
};

test("cada publicação recebe um token criptograficamente aleatório", async () => {
  const first = await createPreviewToken(input);
  const second = await createPreviewToken(input);

  assert.notEqual(first, second);
  assert.notEqual(
    parsePreviewToken(first)?.payload.n,
    parsePreviewToken(second)?.payload.n,
  );
});

test("token determinístico continua verificável em teste", async () => {
  const token = await createPreviewToken({
    ...input,
    nonce: "nonce-controlado",
  });
  const verification = await verifyPreviewToken({
    token,
    slug: input.slug,
    version: input.version,
    leadId: input.leadId,
    secret: input.secret,
  });

  assert.equal(verification.ok, true);
  assert.equal(parsePreviewToken(token)?.payload.n, "nonce-controlado");
});
