import { Check, Eye, FileArchive, Layers3, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { ALL_BATCHES, getBatchNames, matchesBatch } from "../lib/leads";
import type { Lead } from "../types";

interface PreviewHubProps {
  leads: Lead[];
  onSelectLead: (id: number) => void;
  onOpenClientPreview: (id: number) => void;
}

export function PreviewHub({
  leads,
  onSelectLead,
  onOpenClientPreview,
}: PreviewHubProps) {
  const [batch, setBatch] = useState<string>(ALL_BATCHES);
  const batches = useMemo(() => getBatchNames(leads), [leads]);
  const previewLeads = useMemo(
    () =>
      leads.filter(
        (lead) => lead.preview.status !== "none" && matchesBatch(lead, batch),
      ),
    [batch, leads],
  );
  const previewSummary = useMemo(
    () =>
      previewLeads.reduce(
        (summary, lead) => {
          if (lead.preview.status === "viewed") summary.viewed += 1;
          if (lead.preview.status === "approved") summary.approved += 1;
          return summary;
        },
        { viewed: 0, approved: 0 },
      ),
    [previewLeads],
  );

  return (
    <div className="standard-page">
      <div className="page-heading">
        <h1>Sites</h1>
        <p>ZIPs publicados, acessos e aprovações dos clientes.</p>
      </div>
      <div className="preview-summary">
        <div>
          <strong>{previewLeads.length}</strong>
          <span>Com preview</span>
        </div>
        <div>
          <strong>{previewSummary.viewed}</strong>
          <span>Visualizados</span>
        </div>
        <div>
          <strong>{previewSummary.approved}</strong>
          <span>Aprovados</span>
        </div>
      </div>
      <div className="list-filterbar">
        <Layers3 size={18} />
        <label>
          <span>Filtrar por lote</span>
          <select value={batch} onChange={(event) => setBatch(event.target.value)}>
            <option>{ALL_BATCHES}</option>
            {batches.map((batchName) => (
              <option key={batchName}>{batchName}</option>
            ))}
          </select>
        </label>
      </div>
      <section className="panel preview-list">
        {previewLeads.map((lead) => (
          <article key={lead.id} className="preview-list-item">
            <span className="preview-file-icon">
              <FileArchive size={21} />
            </span>
            <div className="preview-list-copy">
              <strong>{lead.handle}</strong>
              <small className="batch-chip">
                <Layers3 size={12} />
                {lead.batchName}
              </small>
              <span>
                {lead.preview.publicUrl ??
                  `sites.oblixhub.com/${lead.preview.publicSlug}`}
              </span>
            </div>
            <div className="preview-list-status">
              {lead.preview.status === "approved" ? (
                <>
                  <Check size={16} />
                  Aprovado
                </>
              ) : lead.preview.status === "viewed" ? (
                <>
                  <Eye size={16} />
                  Visualizado
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  Publicado
                </>
              )}
            </div>
            <div className="preview-list-actions">
              <button
                className="button button--quiet"
                onClick={() => onOpenClientPreview(lead.id)}
              >
                <Eye size={17} />
                Ver acesso
              </button>
              <button
                className="button button--secondary"
                onClick={() => onSelectLead(lead.id)}
              >
                Gerenciar
              </button>
            </div>
          </article>
        ))}
        {previewLeads.length === 0 && (
          <div className="large-empty-state">
            <UploadCloud size={31} />
            <h2>Nenhum site publicado</h2>
            <p>
              {batch === ALL_BATCHES
                ? "Abra um lead na etapa Materiais para enviar um novo ZIP."
                : "Nenhum site publicado neste lote."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
