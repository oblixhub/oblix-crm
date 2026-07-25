import { Instagram, MessageSquareText } from "lucide-react";
import type { Lead } from "../types";
import { WhatsAppIcon } from "./WhatsAppIcon";

interface ContactActionsProps {
  lead: Lead;
  onOpenMessages: () => void;
  compact?: boolean;
}

export function ContactActions({
  lead,
  onOpenMessages,
  compact = false,
}: ContactActionsProps) {
  const whatsappUrl = lead.whatsappUrl || "https://web.whatsapp.com/";

  if (compact) {
    return (
      <div className="quick-contact-actions" aria-label="Atalhos de contato">
        <a
          className="quick-contact quick-contact--instagram"
          href={lead.instagramUrl}
          target="_blank"
          rel="noreferrer"
          title="Abrir Instagram"
          aria-label={`Abrir Instagram de ${lead.handle}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Instagram size={17} />
        </a>
        <a
          className="quick-contact quick-contact--whatsapp"
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          title={
            lead.whatsappUrl
              ? "Abrir conversa no WhatsApp"
              : "Abrir WhatsApp Web"
          }
          aria-label={`Abrir WhatsApp para ${lead.handle}`}
          onClick={(event) => event.stopPropagation()}
        >
          <WhatsAppIcon size={17} />
        </a>
        <button
          className="quick-contact quick-contact--scripts"
          title="Ver mensagens prontas"
          aria-label={`Ver mensagens prontas para ${lead.handle}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenMessages();
          }}
        >
          <MessageSquareText size={17} />
        </button>
      </div>
    );
  }

  return (
    <div className="contact-action-buttons">
      <a
        className="button contact-button contact-button--instagram"
        href={lead.instagramUrl}
        target="_blank"
        rel="noreferrer"
      >
        <Instagram size={18} />
        Instagram
      </a>
      <a
        className="button contact-button contact-button--whatsapp"
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
      >
        <WhatsAppIcon size={18} />
        WhatsApp
      </a>
      <button
        className="button contact-button contact-button--scripts"
        onClick={onOpenMessages}
      >
        <MessageSquareText size={18} />
        Mensagens prontas
      </button>
    </div>
  );
}
