import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPreviewPublicSlug,
  resolveLeadPreviewSource,
} from "../src/lib/preview-links.ts";

test("lead antigo sem siteUrl exige republicação", () => {
  const decision = resolveLeadPreviewSource({
    publicUrl: "https://sites.oblixhub.com/preview/catty-preview",
  });

  assert.equal(decision.url, null);
  assert.equal(decision.source, null);
  assert.equal(decision.valid, false);
  assert.match(
    decision.message ?? "",
    /republique o ZIP|republicar/i,
  );
});

test("lead com siteUrl protegido é aceito", () => {
  const decision = resolveLeadPreviewSource({
    siteUrl: "https://example.com/preview-content/catty/v3/",
  });
  assert.equal(decision.url, "/preview-content/catty/v3/");
  assert.equal(decision.source, "siteUrl");
  assert.equal(decision.valid, true);
});

test("publicUrl antigo não é aceito como fallback", () => {
  const decision = resolveLeadPreviewSource({
    publicUrl: "https://example.com/preview/catty/",
  });

  assert.equal(decision.url, null);
  assert.equal(decision.valid, false);
});

test("publicUrl protegido pode ser aceito se não houver siteUrl", () => {
  const decision = resolveLeadPreviewSource({
    publicUrl: "https://example.com/preview-content/catty/v3/",
  });
  assert.equal(decision.url, "/preview-content/catty/v3/");
  assert.equal(decision.source, "publicUrl");
  assert.equal(decision.valid, true);
});

test("link do cliente sempre usa o portal curto e nunca expõe o token técnico", () => {
  const publicSlug = buildPreviewPublicSlug(
    "treinadorahanna-neri",
    "7c298adc-edc9-4c19-baa4-fe27cb946844",
  );
  const decision = resolveLeadPreviewSource(
    {
      requiresLogin: false,
      publicSlug,
      siteUrl:
        "https://sites.oblixhub.com/preview-content/token-longo/treinadorahanna-neri/v1/",
    },
    { forClient: true },
  );

  assert.match(publicSlug, /^treinadorahanna-neri-[a-z0-9]{5}$/);
  assert.equal(decision.url, `/preview/${publicSlug}/`);
  assert.equal(decision.url.includes("preview-content"), false);
});

test("o mesmo lead mantém o mesmo endereço curto", () => {
  const first = buildPreviewPublicSlug("catty-lopes", "lead-id-estavel");
  const second = buildPreviewPublicSlug("catty-lopes", "lead-id-estavel");
  assert.equal(first, second);
});
