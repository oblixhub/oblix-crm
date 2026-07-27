import assert from "node:assert/strict";
import test from "node:test";
import { resolveLeadPreviewSource } from "../src/lib/preview-links.ts";

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
