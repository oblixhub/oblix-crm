import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260728142434_crm_operations_foundation.sql",
  import.meta.url,
);
const publishPreviewPath = new URL(
  "../supabase/functions/publish-preview/index.ts",
  import.meta.url,
);
const appPath = new URL("../src/App.tsx", import.meta.url);

test("dados comerciais, parcelas e projetos ficam sob política de dono", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const policy of [
    "lead_commercial_owner_all",
    "payment_installments_owner_all",
    "lead_projects_owner_all",
  ]) {
    assert.match(sql, new RegExp(`create policy ${policy}`));
  }
  assert.match(sql, /using \(private\.is_owner\(\)\)/);
});

test("vendedor não recebe permissão de excluir leads ou publicar ZIP", async () => {
  const [sql, edgeFunction] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(publishPreviewPath, "utf8"),
  ]);
  assert.match(sql, /create policy leads_owner_delete/);
  assert.match(
    sql,
    /bucket_id = 'preview-zips'[\s\S]*private\.is_owner\(\)/,
  );
  assert.match(edgeFunction, /publisherProfile\?\.role !== "owner"/);
});

test("validação em lote distribui contatos pela capacidade diária", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /batchSlotIso\(index, crmSettings\.dailyContactGoal\)/);
  assert.match(app, /Distribuído automaticamente na capacidade diária/);
});
