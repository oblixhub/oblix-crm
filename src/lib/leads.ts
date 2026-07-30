import type { Lead } from "../types";

export const ALL_BATCHES = "Todos os lotes" as const;
export type BatchFilter = string | typeof ALL_BATCHES;

export function getBatchNames(leads: Lead[]) {
  return [...new Set(leads.map((lead) => lead.batchName))].sort((a, b) => {
    if (a === "Cadastro manual") return 1;
    if (b === "Cadastro manual") return -1;
    return a.localeCompare(b, "pt-BR", { numeric: true });
  });
}

export function matchesBatch(lead: Lead, batch: BatchFilter) {
  return batch === ALL_BATCHES || lead.batchName === batch;
}
