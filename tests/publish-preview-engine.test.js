import assert from "node:assert/strict";
import test from "node:test";
import {
  parseZipEntries,
  contentTypeFor,
} from "../supabase/functions/publish-preview/engine.js";

const bytes = (value) => new TextEncoder().encode(value);

const createZipEntries = (items) => {
  const zipEntries = {};
  for (const [path, content] of items) {
    zipEntries[path] = bytes(content);
  }
  return zipEntries;
};

test("seleciona index.html na raiz", () => {
  const parsed = parseZipEntries({
    zipEntries: createZipEntries([
      ["index.html", "<html></html>"],
      ["support.js", "console.log('ok')"],
    ]),
  });

  assert.equal(parsed.error, undefined);
  assert.equal(parsed.entrypoint?.path, "index.html");
  assert.equal(parsed.removedOuterFolder, null);
  assert.equal(parsed.entries.length, 2);
});

test("seleciona index.htm quando não há index.html", () => {
  const parsed = parseZipEntries({
    zipEntries: createZipEntries([["index.htm", "<html></html>"]]),
  });

  assert.equal(parsed.error, undefined);
  assert.equal(parsed.entrypoint?.path, "index.htm");
});

test("seleciona .dc.html único da raiz", () => {
  const parsed = parseZipEntries({
    zipEntries: createZipEntries([
      ["Landing Page Catty Lopes.dc.html", "<html><body>catty</body></html>"],
      ["support.js", "console.log('ok')"],
    ]),
  });

  assert.equal(parsed.error, undefined);
  assert.equal(
    parsed.entrypoint?.path,
    "Landing Page Catty Lopes.dc.html",
  );
});

test("aceita root único quando não há index", () => {
  const parsed = parseZipEntries({
    zipEntries: createZipEntries([
      ["site-inicial.html", "<html></html>"],
      ["support.js", "console.log('ok')"],
    ]),
  });

  assert.equal(parsed.error, undefined);
  assert.equal(parsed.entrypoint?.path, "site-inicial.html");
});

test("remove uma pasta externa quando for único container", () => {
  const parsed = parseZipEntries({
    zipEntries: createZipEntries([
      ["landing/index.html", "<html></html>"],
      ["landing/support.js", "console.log('ok')"],
      ["landing/assets/logo.png", "png"],
    ]),
  });

  assert.equal(parsed.error, undefined);
  assert.equal(parsed.entrypoint?.path, "index.html");
  assert.equal(parsed.removedOuterFolder, "landing");
  assert.equal(parsed.entries[0].path, "index.html");
  assert.equal(parsed.entries.some((entry) => entry.path === "assets/logo.png"), true);
});

test("rejeita múltiplos HTML na raiz sem index", () => {
  const parsed = parseZipEntries({
    zipEntries: createZipEntries([
      ["home.html", "<html></html>"],
      ["landing.html", "<html></html>"],
      ["support.js", "console.log('ok')"],
    ]),
  });

  assert.ok(parsed.error);
  assert.match(parsed.error, /varios arquivos HTML/i);
  assert.equal(parsed.candidates.length, 2);
});

test("rejeita ZIP sem HTML", () => {
  const parsed = parseZipEntries({
    zipEntries: createZipEntries([["styles.css", "body {}"]]),
  });

  assert.equal(parsed.error, "O ZIP nao possui HTML principal.");
});

test("detecta caminho perigoso com ../", () => {
  const parsed = parseZipEntries({
    zipEntries: createZipEntries([["../evil.js", "alert(1)"]]),
  });

  assert.match(parsed.error, /Caminho invalido|inv/);
});

test("aceita espaços e acentos no nome do arquivo principal", () => {
  const parsed = parseZipEntries({
    zipEntries: createZipEntries([["Landing Page Catty Lopes.dc.html", "<html/>"]]),
  });

  assert.equal(parsed.error, undefined);
  assert.equal(parsed.entrypoint?.path, "Landing Page Catty Lopes.dc.html");
});

test("resolve MIME dos principais tipos de arquivo", () => {
  assert.equal(contentTypeFor("index.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeFor("main.htm"), "text/html; charset=utf-8");
  assert.equal(contentTypeFor("site.dc.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeFor("styles.css"), "text/css; charset=utf-8");
  assert.equal(contentTypeFor("script.js"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeFor("module.mjs"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeFor("asset.unknown"), "application/octet-stream");
});
