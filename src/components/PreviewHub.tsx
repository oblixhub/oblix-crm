import { Check, Eye, FileArchive, UploadCloud } from "lucide-react";
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
  const previewLeads = leads.filter((lead) => lead.preview.status !== "none");

  return (
    <div className="standard-page">
      <div className="page-heading">
        <h1>Previews</h1>
        <p>Versões publicadas, acessos e aprovações dos clientes.</p>
      </div>
      <div className="preview-summary">
        <div>
          <strong>{previewLeads.length}</strong>
          <span>Com preview</span>
        </div>
        <div>
          <strong>
            {previewLeads.filter((lead) => lead.preview.status === "viewed").length}
          </strong>
          <span>Visualizados</span>
        </div>
        <div>
          <strong>
            {previewLeads.filter((lead) => lead.preview.status === "approved").length}
          </strong>
          <span>Aprovados</span>
        </div>
      </div>
      <section className="panel preview-list">
        {previewLeads.map((lead) => (
          <article key={lead.id} className="preview-list-item">
            <span className="preview-file-icon">
              <FileArchive size={21} />
            </span>
            <div className="preview-list-copy">
              <strong>{lead.handle}</strong>
              <span>
                sites.oblixhub.com/{lead.preview.publicSlug}
              </span>
            </div>
            <div className="preview-list-status">
              {lead.preview.status === "approved" ? (
                <>
                  <Check size={16} />
                  Aprovado
                </>
              ) : (
                <>
                  <Eye size={16} />
                  Visualizado
                </>
              )}
            </div>
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
          </article>
        ))}
        {previewLeads.length === 0 && (
          <div className="large-empty-state">
            <UploadCloud size={31} />
            <h2>Nenhum preview publicado</h2>
            <p>Abra um lead para enviar o primeiro ZIP.</p>
          </div>
        )}
      </section>
    </div>
  );
}
