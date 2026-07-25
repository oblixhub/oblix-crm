import { Check, Copy, Instagram, MessageSquareText } from "lucide-react";
import { useMemo, useState } from "react";
import type { Lead, MessageTemplate } from "../types";
import { WhatsAppIcon } from "./WhatsAppIcon";

interface MessageLibraryProps {
  lead: Lead;
  templates: MessageTemplate[];
  onCopied: (title: string) => void;
  onManage: () => void;
}

export function MessageLibrary({
  lead,
  templates,
  onCopied,
  onManage,
}: MessageLibraryProps) {
  const categories = useMemo(
    () => [...new Set(templates.map((template) => template.category))],
    [templates],
  );
  const [activeCategory, setActiveCategory] = useState(
    categories[0] ?? "Todas",
  );
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const whatsappUrl = lead.whatsappUrl || "https://web.whatsapp.com/";

  const copyMessage = async (template: MessageTemplate) => {
    try {
      await navigator.clipboard.writeText(template.message);
    } catch {
      const field = document.createElement("textarea");
      field.value = template.message;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopiedId(template.id);
    onCopied(template.title);
  };

  const visibleTemplates =
    activeCategory === "Todas"
      ? templates
      : templates.filter(
          (template) => template.category === activeCategory,
        );

  return (
    <div className="message-library">
      <div className="message-library-intro">
        <span className="message-library-icon">
          <MessageSquareText size={22} />
        </span>
        <div>
          <strong>Escolha, copie e envie</strong>
          <p>
            Copie uma mensagem para {lead.handle} e substitua os campos entre
            colchetes antes de enviar.
          </p>
        </div>
        <div className="message-library-channels">
          <a
            className="button contact-button contact-button--instagram"
            href={lead.instagramUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Instagram size={17} />
            Instagram
          </a>
          <a
            className="button contact-button contact-button--whatsapp"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsAppIcon size={17} />
            WhatsApp
          </a>
          <button className="button button--secondary" onClick={onManage}>
            Editar mensagens
          </button>
        </div>
      </div>

      <div className="script-tabs" role="tablist" aria-label="Tipos de mensagem">
        <button
          className={activeCategory === "Todas" ? "active" : ""}
          role="tab"
          aria-selected={activeCategory === "Todas"}
          onClick={() => setActiveCategory("Todas")}
        >
          Todas
        </button>
        {categories.map((category) => (
          <button
            key={category}
            className={activeCategory === category ? "active" : ""}
            role="tab"
            aria-selected={activeCategory === category}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="script-list">
        {visibleTemplates.map((template) => (
          <article className="script-card" key={template.id}>
            <div className="script-card-heading">
              <div>
                <h3>{template.title}</h3>
                <p>{template.category}</p>
              </div>
              <button
                className={`button script-copy-button ${
                  copiedId === template.id ? "is-copied" : ""
                }`}
                onClick={() => copyMessage(template)}
              >
                {copiedId === template.id ? (
                  <>
                    <Check size={17} />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy size={17} />
                    Copiar
                  </>
                )}
              </button>
            </div>
            <p className="script-message">{template.message}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
