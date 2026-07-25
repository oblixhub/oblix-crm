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
      <div className="client-preview-security">
        <LockKeyhole size={15} />
        Preview protegido · versão {lead.preview.version ?? 1}
      </div>

      <div className="sample-site client-site-preview">
        <nav>
          <strong>{lead.category}</strong>
          <span>Início &nbsp; Serviços &nbsp; Contato</span>
        </nav>
        <div>
          <span className="sample-site-kicker">Atendimento profissional</span>
          <h2>Um site claro para apresentar seu trabalho</h2>
          <p>
            Conheça os serviços, tire suas dúvidas e fale diretamente pelo
            WhatsApp.
          </p>
          <button>Falar no WhatsApp</button>
        </div>
        <section className="sample-site-services">
          <article>
            <strong>Atendimento personalizado</strong>
            <p>Uma experiência pensada para cada necessidade.</p>
          </article>
          <article>
            <strong>Contato fácil</strong>
            <p>Informações objetivas e acesso rápido ao WhatsApp.</p>
          </article>
          <article>
            <strong>Apresentação profissional</strong>
            <p>Serviços organizados para facilitar a decisão.</p>
          </article>
        </section>
      </div>

      <aside className="client-review-widget" aria-label="Avaliação do site">
        <span>O que achou do site?</span>
        <div>
          <button className="review-change-button" onClick={onRequestChanges}>
            <MessageSquareText size={19} />
            <span>Pedir revisão</span>
          </button>
          <button className="review-approve-button" onClick={onApprove}>
            <BadgeCheck size={20} />
            <span>Aprovar site</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
