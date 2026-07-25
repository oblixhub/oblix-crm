import { BadgeCheck, LockKeyhole, MessageSquareText } from "lucide-react";
import type { Lead } from "../types";

interface ClientPreviewProps {
  lead: Lead;
  onApprove: () => void;
  onRequestChanges: () => void;
}

export function ClientPreview({
  lead,
  onApprove,
  onRequestChanges,
}: ClientPreviewProps) {
  return (
    <div className="client-preview">
      <header className="client-preview-bar">
        <div>
          <LockKeyhole size={17} />
          Acesso protegido
        </div>
        <span>Versão {lead.preview.version ?? 1}</span>
      </header>
      <div className="preview-browser">
        <div className="preview-browser-bar">
          <span />
          <span />
          <span />
          <small>sites.oblixhub.com/{lead.preview.publicSlug}</small>
        </div>
        <div className="sample-site">
          <nav>
            <strong>{lead.category}</strong>
            <span>Início &nbsp; Serviços &nbsp; Contato</span>
          </nav>
          <div>
            <h2>Um site claro para apresentar seu trabalho</h2>
            <p>
              Área de demonstração do preview enviado para {lead.handle}.
            </p>
            <button>Falar no WhatsApp</button>
          </div>
        </div>
      </div>
      <footer className="client-approval-bar">
        <div>
          <strong>Este preview está pronto para sua avaliação.</strong>
          <span>A aprovação fica vinculada a esta versão.</span>
        </div>
        <button className="button button--secondary" onClick={onRequestChanges}>
          <MessageSquareText size={18} />
          Solicitar ajustes
        </button>
        <button className="button button--primary" onClick={onApprove}>
          <BadgeCheck size={18} />
          Aprovar esta versão
        </button>
      </footer>
    </div>
  );
}
