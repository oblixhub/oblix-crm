import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parsePortfolioContentPath } from "../api/portfolio-content/index.js";

const repoFile = (path) => new URL(`../${path}`, import.meta.url);

test("rota de conteúdo do portfólio aceita somente chave UUID e versão", () => {
  const valid = parsePortfolioContentPath(
    new URL(
      "https://sites.oblixhub.com/portfolio-content/7c298adc-edc9-4c19-baa4-fe27cb946844/v2/",
    ),
  );
  assert.equal(valid.ok, true);
  assert.equal(valid.publicKey, "7c298adc-edc9-4c19-baa4-fe27cb946844");
  assert.equal(valid.version, "v2");

  const traversal = parsePortfolioContentPath(
    new URL(
      "https://sites.oblixhub.com/portfolio-content/7c298adc-edc9-4c19-baa4-fe27cb946844/v2/%2e%2e/secret",
    ),
  );
  assert.equal(traversal.ok, false);

  const predictable = parsePortfolioContentPath(
    new URL("https://sites.oblixhub.com/portfolio-content/catty-lopes/v1/"),
  );
  assert.equal(predictable.ok, false);
});

test("iframe público executa o ZIP sem herdar a origem do CRM", async () => {
  const source = await readFile(
    repoFile("src/components/PublicPortfolio.tsx"),
    "utf8",
  );
  const sandbox = source.match(/sandbox="([^"]+)"/)?.[1] ?? "";
  assert.match(sandbox, /allow-scripts/);
  assert.match(sandbox, /allow-forms/);
  assert.match(sandbox, /allow-popups/);
  assert.match(sandbox, /allow-downloads/);
  assert.doesNotMatch(sandbox, /allow-same-origin/);
  assert.match(source, /referrerPolicy="no-referrer"/);
});

test("dados e arquivos do portfólio ficam protegidos por dono", async () => {
  const migration = await readFile(
    repoFile(
      "supabase/migrations/20260728162648_add_portfolio_publishing_system.sql",
    ),
    "utf8",
  );
  assert.match(migration, /portfolio_projects_owner_select/);
  assert.match(migration, /private\.is_owner\(\)/);
  assert.match(
    migration,
    /'portfolio-sites',\s*'portfolio-sites',\s*false/s,
  );
  assert.match(
    migration,
    /'portfolio-zips',\s*'portfolio-zips',\s*false/s,
  );
  assert.match(
    migration,
    /'portfolio-covers',\s*'portfolio-covers',\s*true/s,
  );
});

test("endpoint público projeta apenas metadados seguros", async () => {
  const source = await readFile(
    repoFile("supabase/functions/portfolio-public/index.ts"),
    "utf8",
  );
  const projection =
    source.match(/\.select\(\s*"([^"]+)"/s)?.[1] ?? "";
  assert.doesNotMatch(projection, /lead_id/);
  assert.doesNotMatch(projection, /source_path/);
  assert.doesNotMatch(projection, /authorization_note/);
  assert.doesNotMatch(projection, /created_by/);
  assert.match(source, /project\.show_live_link \? project\.live_url : null/);
});
